import * as vscode from 'vscode';
import { addResourceToIgnore, openIgnoreFile } from './gitIgnoreManager';

export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(
		vscode.commands.registerCommand('git-ignore-manager.addToGitignore', async (resource?: vscode.Uri) => {
			await addResourceToIgnore(resource, 'gitignore');
		}),
		vscode.commands.registerCommand('git-ignore-manager.addToExclude', async (resource?: vscode.Uri) => {
			await addResourceToIgnore(resource, 'exclude');
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
