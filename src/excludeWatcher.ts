import * as path from 'node:path';
import * as vscode from 'vscode';
import { findGitRoot } from './git';

const refreshDelayMs = 150;

export function registerExcludeWatcher(context: vscode.ExtensionContext): void {
	const registry = new ExcludeWatcherRegistry();

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

	async reset(): Promise<void> {
		const generation = ++this.resetGeneration;
		this.clearWatchers();

		const repoRoots = await resolveWorkspaceRepoRoots();
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
			this.scheduleRefresh();
		};

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
			void refreshVsCodeGitState();
		}, refreshDelayMs);
	}
}

async function resolveWorkspaceRepoRoots(): Promise<string[]> {
	const workspaceFolders = vscode.workspace.workspaceFolders ?? [];
	const repoRoots = new Set<string>();

	await Promise.all(workspaceFolders.map(async (folder) => {
		try {
			repoRoots.add(await findGitRoot(folder.uri.fsPath));
		} catch {
			// Non-Git workspace folders are valid; they simply have no local exclude file to watch.
		}
	}));

	return Array.from(repoRoots);
}

async function refreshVsCodeGitState(): Promise<void> {
	await Promise.all([
		executeCommandIfAvailable('git.refresh'),
		executeCommandIfAvailable('workbench.files.action.refreshFilesExplorer'),
	]);
}

async function executeCommandIfAvailable(command: string): Promise<void> {
	try {
		await vscode.commands.executeCommand(command);
	} catch {
		// These commands are best-effort refresh hooks. The watcher itself must keep working if
		// the built-in Git or Explorer command is unavailable in a specific VS Code environment.
	}
}
