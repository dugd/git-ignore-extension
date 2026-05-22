import * as vscode from 'vscode';

export interface UserPrompts {
	showInformationMessage(message: string, ...items: string[]): Promise<string | undefined>;
	showWarningMessage(message: string, ...items: string[]): Promise<string | undefined>;
	showErrorMessage(message: string): Promise<string | undefined>;
}

export const vscodeUserPrompts: UserPrompts = {
	showInformationMessage: async (message, ...items) => vscode.window.showInformationMessage(message, ...items),
	showWarningMessage: async (message, ...items) => vscode.window.showWarningMessage(message, ...items),
	showErrorMessage: async (message) => vscode.window.showErrorMessage(message),
};
