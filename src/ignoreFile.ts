import * as path from 'node:path';
import * as vscode from 'vscode';

const textDecoder = new TextDecoder();
const textEncoder = new TextEncoder();

export interface AppendPatternResult {
	added: boolean;
}

export async function appendPatternIfMissing(fileUri: vscode.Uri, pattern: string): Promise<AppendPatternResult> {
	const content = await readTextFileOrEmpty(fileUri);
	const lines = content.split(/\r?\n/);
	const exists = lines.some((line) => {
		const trimmed = line.trim();
		return trimmed === pattern && !trimmed.startsWith('#');
	});

	if (exists) {
		return { added: false };
	}

	const prefix = content.length === 0 || content.endsWith('\n') ? content : `${content}\n`;
	await writeTextFile(fileUri, `${prefix}${pattern}\n`);
	return { added: true };
}

export async function ensureTextFile(fileUri: vscode.Uri): Promise<void> {
	try {
		await vscode.workspace.fs.stat(fileUri);
	} catch {
		await writeTextFile(fileUri, '');
	}
}

async function readTextFileOrEmpty(fileUri: vscode.Uri): Promise<string> {
	try {
		const bytes = await vscode.workspace.fs.readFile(fileUri);
		return textDecoder.decode(bytes);
	} catch {
		return '';
	}
}

async function writeTextFile(fileUri: vscode.Uri, content: string): Promise<void> {
	const parentUri = vscode.Uri.file(path.dirname(fileUri.fsPath));
	await vscode.workspace.fs.createDirectory(parentUri);
	await vscode.workspace.fs.writeFile(fileUri, textEncoder.encode(content));
}
