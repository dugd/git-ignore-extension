import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { promisify } from 'node:util';
import * as vscode from 'vscode';

const execFileAsync = promisify(execFile);
const textDecoder = new TextDecoder();
const textEncoder = new TextEncoder();

export interface TempGitRepo {
	root: string;
	cleanup(): Promise<void>;
	git(args: readonly string[], cwd?: string): Promise<string>;
	uri(relativePath?: string): vscode.Uri;
	writeFile(relativePath: string, content?: string): Promise<vscode.Uri>;
	readFile(relativePath: string): Promise<string>;
	mkdir(relativePath: string): Promise<vscode.Uri>;
}

export async function createTempGitRepo(name = 'repo'): Promise<TempGitRepo> {
	const tempDirectory = await mkdtemp(path.join(os.tmpdir(), 'git-ignore-manager-'));
	const root = path.join(tempDirectory, name);
	const repo = createTempGitRepoHandle(tempDirectory, root);

	await vscode.workspace.fs.createDirectory(vscode.Uri.file(root));
	await repo.git(['init']);
	return repo;
}

export function createTempGitRepoHandle(tempDirectory: string, root: string): TempGitRepo {
	return {
		root,
		cleanup: async () => {
			await rm(tempDirectory, { recursive: true, force: true });
		},
		git: async (args, cwd = root) => {
			if (args[0] === 'init') {
				await vscode.workspace.fs.createDirectory(vscode.Uri.file(cwd));
			}

			const { stdout } = await execFileAsync('git', ['-C', cwd, ...args]);
			return stdout.trim();
		},
		uri: (relativePath = '') => {
			return vscode.Uri.file(path.join(root, relativePath));
		},
		writeFile: async (relativePath, content = '') => {
			const fileUri = vscode.Uri.file(path.join(root, relativePath));
			await vscode.workspace.fs.createDirectory(vscode.Uri.file(path.dirname(fileUri.fsPath)));
			await vscode.workspace.fs.writeFile(fileUri, textEncoder.encode(content));
			return fileUri;
		},
		readFile: async (relativePath) => {
			const bytes = await vscode.workspace.fs.readFile(vscode.Uri.file(path.join(root, relativePath)));
			return textDecoder.decode(bytes);
		},
		mkdir: async (relativePath) => {
			const directoryUri = vscode.Uri.file(path.join(root, relativePath));
			await vscode.workspace.fs.createDirectory(directoryUri);
			return directoryUri;
		},
	};
}
