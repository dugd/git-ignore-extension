import * as vscode from 'vscode';

export interface Logger {
	info(message: string): void;
	warn(message: string): void;
	error(message: string): void;
}

export const noopLogger: Logger = {
	info: () => {},
	warn: () => {},
	error: () => {},
};

export function createOutputChannelLogger(channel: vscode.OutputChannel): Logger {
	return {
		info: (message) => {
			channel.appendLine(formatLogMessage('info', message));
		},
		warn: (message) => {
			channel.appendLine(formatLogMessage('warn', message));
		},
		error: (message) => {
			channel.appendLine(formatLogMessage('error', message));
		},
	};
}

function formatLogMessage(level: string, message: string): string {
	return `[${new Date().toISOString()}] [${level}] ${message}`;
}
