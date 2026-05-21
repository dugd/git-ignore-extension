import * as assert from 'assert';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { findGitRoot, hasTrackedFilesInDirectory, isTrackedByGit } from '../../git';
import { getGitRootSearchPath } from '../../pathUtils';
import { createTempGitRepo, createTempGitRepoHandle } from '../helpers/tempGitRepo';

suite('git integration', () => {
	test('resolves a simple Git repository root', async () => {
		const repo = await createTempGitRepo();

		try {
			assert.strictEqual(await findGitRoot(repo.root), repo.root);
		} finally {
			await repo.cleanup();
		}
	});

	test('resolves the inner Git repository for a file inside a nested repository', async () => {
		const outer = await createTempGitRepo('outer-repo');
		const innerRoot = path.join(outer.root, 'nested-repo');
		const inner = createTempGitRepoHandle(path.dirname(outer.root), innerRoot);

		try {
			await vscode.workspace.fs.createDirectory(vscode.Uri.file(path.join(innerRoot, 'src')));
			await inner.git(['init']);
			const innerFile = path.join(innerRoot, 'src', 'config.local.json');
			const searchPath = getGitRootSearchPath(innerFile, false);

			assert.strictEqual(await findGitRoot(searchPath), innerRoot);
		} finally {
			await outer.cleanup();
		}
	});

	test('detects tracked and untracked files', async () => {
		const repo = await createTempGitRepo();

		try {
			await repo.writeFile('tracked.txt');
			await repo.writeFile('untracked.txt');
			await repo.git(['add', 'tracked.txt']);

			assert.strictEqual(await isTrackedByGit(repo.root, 'tracked.txt'), true);
			assert.strictEqual(await isTrackedByGit(repo.root, 'untracked.txt'), false);
		} finally {
			await repo.cleanup();
		}
	});

	test('detects tracked files inside directories', async () => {
		const repo = await createTempGitRepo();

		try {
			await repo.writeFile('src/tracked.txt');
			await repo.git(['add', 'src/tracked.txt']);

			assert.strictEqual(await hasTrackedFilesInDirectory(repo.root, 'src/'), true);
			assert.strictEqual(await hasTrackedFilesInDirectory(repo.root, 'tmp/'), false);
		} finally {
			await repo.cleanup();
		}
	});
});
