import * as path from 'node:path';
import * as vscode from 'vscode';
import { findGitRoot, isTrackedByGit } from './git';
import { appendPatternIfMissing, ensureTextFile } from './ignoreFile';
import { createIgnorePattern } from './pathUtils';

type IgnoreTarget = 'gitignore' | 'exclude';

const targetLabels: Record<IgnoreTarget, string> = {
	gitignore: '.gitignore',
	exclude: '.git/info/exclude',
};

export async function addResourceToIgnore(resource: vscode.Uri | undefined, target: IgnoreTarget): Promise<void> {
	const selectedResource = await resolveSelectedResource(resource);
	if (!selectedResource) {
		vscode.window.showErrorMessage('Select a file or folder to ignore.');
		return;
	}

	const repoRoot = await resolveGitRoot(selectedResource);
	if (!repoRoot) {
		return;
	}

	const stat = await vscode.workspace.fs.stat(selectedResource);
	const pattern = createIgnorePattern(repoRoot, selectedResource.fsPath, stat.type === vscode.FileType.Directory);

	if (await isTrackedByGit(repoRoot, pattern)) {
		const choice = await vscode.window.showWarningMessage(
			`"${pattern}" is already tracked by Git. Ignoring it will not stop Git from tracking changes.`,
			'Add Anyway',
			'Cancel',
		);

		if (choice !== 'Add Anyway') {
			return;
		}
	}

	const ignoreFile = getIgnoreFileUri(repoRoot, target);
	const result = await appendPatternIfMissing(ignoreFile, pattern);

	if (result.added) {
		vscode.window.showInformationMessage(`Added "${pattern}" to ${targetLabels[target]}.`);
	} else {
		vscode.window.showInformationMessage(`"${pattern}" already exists in ${targetLabels[target]}.`);
	}
}

export async function openIgnoreFile(resource: vscode.Uri | undefined, target: IgnoreTarget): Promise<void> {
	const baseResource = await resolveResourceForRepo(resource);
	if (!baseResource) {
		vscode.window.showErrorMessage('Open a workspace folder or file first.');
		return;
	}

	const repoRoot = await resolveGitRoot(baseResource);
	if (!repoRoot) {
		return;
	}

	const ignoreFile = getIgnoreFileUri(repoRoot, target);
	await ensureTextFile(ignoreFile);

	const document = await vscode.workspace.openTextDocument(ignoreFile);
	await vscode.window.showTextDocument(document);
}

async function resolveSelectedResource(resource: vscode.Uri | undefined): Promise<vscode.Uri | undefined> {
	if (resource) {
		return resource;
	}

	return vscode.window.activeTextEditor?.document.uri;
}

async function resolveResourceForRepo(resource: vscode.Uri | undefined): Promise<vscode.Uri | undefined> {
	const selectedResource = await resolveSelectedResource(resource);
	if (selectedResource) {
		return selectedResource;
	}

	const workspaceFolders = vscode.workspace.workspaceFolders ?? [];
	if (workspaceFolders.length === 1) {
		return workspaceFolders[0].uri;
	}

	if (workspaceFolders.length > 1) {
		const picked = await vscode.window.showQuickPick(
			workspaceFolders.map((folder) => ({ label: folder.name, folder })),
			{ placeHolder: 'Select a workspace folder' },
		);

		return picked?.folder.uri;
	}

	return undefined;
}

async function resolveGitRoot(resource: vscode.Uri): Promise<string | undefined> {
	const workspaceFolder = vscode.workspace.getWorkspaceFolder(resource);
	const cwd = workspaceFolder?.uri.fsPath ?? path.dirname(resource.fsPath);

	try {
		return await findGitRoot(cwd);
	} catch {
		vscode.window.showErrorMessage('Selected resource is not inside a Git repository.');
		return undefined;
	}
}

function getIgnoreFileUri(repoRoot: string, target: IgnoreTarget): vscode.Uri {
	if (target === 'gitignore') {
		return vscode.Uri.file(path.join(repoRoot, '.gitignore'));
	}

	return vscode.Uri.file(path.join(repoRoot, '.git', 'info', 'exclude'));
}
