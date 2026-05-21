import * as path from 'node:path';
import * as vscode from 'vscode';

const textDecoder = new TextDecoder();
const textEncoder = new TextEncoder();

export interface AppendPatternResult {
	added: number;
	existing: number;
}

export async function appendPatternIfMissing(fileUri: vscode.Uri, pattern: string): Promise<AppendPatternResult> {
	return appendPatternsIfMissing(fileUri, [pattern]);
}

export async function appendPatternsIfMissing(fileUri: vscode.Uri, patterns: readonly string[]): Promise<AppendPatternResult> {
	const content = await readTextFileOrEmpty(fileUri);
	const lines = content.split(/\r?\n/);
	const existingPatterns = new Set(lines
		.map((line) => line.trim())
		.filter((line) => line.length > 0 && !line.startsWith('#')));

	const missingPatterns: string[] = [];
	let existing = 0;

	for (const pattern of patterns) {
		if (existingPatterns.has(pattern) || missingPatterns.includes(pattern)) {
			existing++;
		} else {
			missingPatterns.push(pattern);
		}
	}

	if (missingPatterns.length === 0) {
		return { added: 0, existing };
	}

	const prefix = content.length === 0 || content.endsWith('\n') ? content : `${content}\n`;
	await writeTextFile(fileUri, `${prefix}${missingPatterns.join('\n')}\n`);
	return { added: missingPatterns.length, existing };
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
