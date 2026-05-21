import * as vscode from 'vscode';
import { registerExcludeWatcher } from './excludeWatcher';
import { addResourceToIgnore, openIgnoreFile } from './gitIgnoreManager';

export function activate(context: vscode.ExtensionContext) {
	registerExcludeWatcher(context);

	context.subscriptions.push(
		vscode.commands.registerCommand('git-ignore-manager.addToGitignore', async (
			resource?: vscode.Uri,
			selectedResources?: vscode.Uri[],
		) => {
			await addResourceToIgnore(resource, selectedResources, 'gitignore');
		}),
		vscode.commands.registerCommand('git-ignore-manager.addToExclude', async (
			resource?: vscode.Uri,
			selectedResources?: vscode.Uri[],
		) => {
			await addResourceToIgnore(resource, selectedResources, 'exclude');
		}),
		vscode.commands.registerCommand('git-ignore-manager.openGitignore', async (resource?: vscode.Uri) => {
			await openIgnoreFile(resource, 'gitignore');
		}),
		vscode.commands.registerCommand('git-ignore-manager.openExclude', async (resource?: vscode.Uri) => {
			await openIgnoreFile(resource, 'exclude');
		}),
	);
}

export function deactivate() {}
