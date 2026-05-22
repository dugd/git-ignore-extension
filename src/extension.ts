import * as vscode from 'vscode';
import { registerExcludeWatcher } from './excludeWatcher';
import { addResourceToIgnore, explainIgnoredResource, openIgnoreFile } from './gitIgnoreManager';
import { createOutputChannelLogger } from './logger';
import { vscodeUserPrompts } from './userPrompts';

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
			await addResourceToIgnore(resource, selectedResources, 'gitignore', logger, vscodeUserPrompts);
		}),
		vscode.commands.registerCommand('git-ignore-manager.addToExclude', async (
			resource?: vscode.Uri,
			selectedResources?: vscode.Uri[],
		) => {
			await addResourceToIgnore(resource, selectedResources, 'exclude', logger, vscodeUserPrompts);
		}),
		vscode.commands.registerCommand('git-ignore-manager.openGitignore', async (resource?: vscode.Uri) => {
			await openIgnoreFile(resource, 'gitignore', logger, vscodeUserPrompts);
		}),
		vscode.commands.registerCommand('git-ignore-manager.openExclude', async (resource?: vscode.Uri) => {
			await openIgnoreFile(resource, 'exclude', logger, vscodeUserPrompts);
		}),
		vscode.commands.registerCommand('git-ignore-manager.whyIgnored', async (resource?: vscode.Uri) => {
			await explainIgnoredResource(resource, logger, vscodeUserPrompts);
		}),
	);
}

export function deactivate() {}
