import * as path from 'node:path';
import * as vscode from 'vscode';
import { findGitRoot } from './git';
import type { Logger } from './logger';

const refreshDelayMs = 150;

export function registerExcludeWatcher(context: vscode.ExtensionContext, logger: Logger): void {
	const registry = new ExcludeWatcherRegistry(logger);

	context.subscriptions.push(
		registry,
		vscode.workspace.onDidChangeWorkspaceFolders(() => {
			void registry.reset();
		}),
	);

	void registry.reset();
}

class ExcludeWatcherRegistry implements vscode.Disposable {
	private readonly disposables: vscode.Disposable[] = [];
	private refreshTimer: NodeJS.Timeout | undefined;
	private resetGeneration = 0;

	constructor(private readonly logger: Logger) {}

	async reset(): Promise<void> {
		const generation = ++this.resetGeneration;
		this.clearWatchers();

		const repoRoots = await resolveWorkspaceRepoRoots(this.logger);
		if (generation !== this.resetGeneration) {
			return;
		}

		for (const repoRoot of repoRoots) {
			this.watchExcludeFile(repoRoot);
		}
	}

	dispose(): void {
		this.clearWatchers();

		if (this.refreshTimer) {
			clearTimeout(this.refreshTimer);
			this.refreshTimer = undefined;
		}
	}

	private clearWatchers(): void {
		while (this.disposables.length > 0) {
			this.disposables.pop()?.dispose();
		}
	}

	private watchExcludeFile(repoRoot: string): void {
		const gitInfoUri = vscode.Uri.file(path.join(repoRoot, '.git', 'info'));
		const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(gitInfoUri, 'exclude'));
		const refresh = () => {
			this.logger.info(`Local exclude changed: ${path.join(repoRoot, '.git', 'info', 'exclude')}`);
			this.scheduleRefresh();
		};

		this.logger.info(`Watching local exclude: ${path.join(repoRoot, '.git', 'info', 'exclude')}`);

		this.disposables.push(
			watcher,
			watcher.onDidCreate(refresh),
			watcher.onDidChange(refresh),
			watcher.onDidDelete(refresh),
		);
	}

	private scheduleRefresh(): void {
		if (this.refreshTimer) {
			clearTimeout(this.refreshTimer);
		}

		this.refreshTimer = setTimeout(() => {
			this.refreshTimer = undefined;
			void refreshVsCodeGitState(this.logger);
		}, refreshDelayMs);
	}
}

async function resolveWorkspaceRepoRoots(logger: Logger): Promise<string[]> {
	const workspaceFolders = vscode.workspace.workspaceFolders ?? [];
	const repoRoots = new Set<string>();

	await Promise.all(workspaceFolders.map(async (folder) => {
		try {
			const repoRoot = await findGitRoot(folder.uri.fsPath);
			logger.info(`Resolved watcher Git root for ${folder.uri.fsPath} -> ${repoRoot}`);
			repoRoots.add(repoRoot);
		} catch {
			logger.info(`Skipped local exclude watcher for non-Git workspace folder: ${folder.uri.fsPath}`);
		}
	}));

	return Array.from(repoRoots);
}

async function refreshVsCodeGitState(logger: Logger): Promise<void> {
	logger.info('Refresh requested: git.refresh, workbench.files.action.refreshFilesExplorer');
	await Promise.all([
		executeCommandIfAvailable('git.refresh', logger),
		executeCommandIfAvailable('workbench.files.action.refreshFilesExplorer', logger),
	]);
}

async function executeCommandIfAvailable(command: string, logger: Logger): Promise<void> {
	try {
		await vscode.commands.executeCommand(command);
	} catch (error) {
		logger.warn(`Refresh command failed: ${command}: ${getErrorMessage(error)}`);
	}
}

function getErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
