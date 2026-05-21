import * as vscode from 'vscode';
import { registerExcludeWatcher } from './excludeWatcher';
import { addResourceToIgnore, explainIgnoredResource, openIgnoreFile } from './gitIgnoreManager';
import { createOutputChannelLogger } from './logger';

export function activate(context: vscode.ExtensionContext) {
	const outputChannel = vscode.window.createOutputChannel('Git Ignore Manager');
	const logger = createOutputChannelLogger(outputChannel);

	context.subscriptions.push(outputChannel);
	registerExcludeWatcher(context, logger);

	context.subscriptions.push(
		vscode.commands.registerCommand('git-ignore-manager.addToGitignore', async (
			resource?: vscode.Uri,
			selectedResources?: vscode.Uri[],
		) => {
			await addResourceToIgnore(resource, selectedResources, 'gitignore', logger);
		}),
		vscode.commands.registerCommand('git-ignore-manager.addToExclude', async (
			resource?: vscode.Uri,
			selectedResources?: vscode.Uri[],
		) => {
			await addResourceToIgnore(resource, selectedResources, 'exclude', logger);
		}),
		vscode.commands.registerCommand('git-ignore-manager.openGitignore', async (resource?: vscode.Uri) => {
			await openIgnoreFile(resource, 'gitignore', logger);
		}),
		vscode.commands.registerCommand('git-ignore-manager.openExclude', async (resource?: vscode.Uri) => {
			await openIgnoreFile(resource, 'exclude', logger);
		}),
		vscode.commands.registerCommand('git-ignore-manager.whyIgnored', async (resource?: vscode.Uri) => {
			await explainIgnoredResource(resource, logger);
		}),
	);
}

export function deactivate() {}
