import * as assert from 'assert';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { checkIgnore, findGitRoot, hasTrackedFilesInDirectory, isTrackedByGit, untrackFromGit } from '../../git';
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

	test('untracks files without deleting them from disk', async () => {
		const repo = await createTempGitRepo();

		try {
			await repo.writeFile('tracked.txt', 'content');
			await repo.git(['add', 'tracked.txt']);

			await untrackFromGit(repo.root, 'tracked.txt', false);

			assert.strictEqual(await isTrackedByGit(repo.root, 'tracked.txt'), false);
			assert.strictEqual(await repo.readFile('tracked.txt'), 'content');
		} finally {
			await repo.cleanup();
		}
	});

	test('untracks directories recursively without deleting files from disk', async () => {
		const repo = await createTempGitRepo();

		try {
			await repo.writeFile('src/tracked.txt', 'content');
			await repo.git(['add', 'src/tracked.txt']);

			await untrackFromGit(repo.root, 'src/', true);

			assert.strictEqual(await hasTrackedFilesInDirectory(repo.root, 'src/'), false);
			assert.strictEqual(await repo.readFile('src/tracked.txt'), 'content');
		} finally {
			await repo.cleanup();
		}
	});

	test('explains root .gitignore matches', async () => {
		const repo = await createTempGitRepo();

		try {
			await repo.writeFile('.gitignore', 'dist/\n');
			await repo.writeFile('dist/file.txt');

			const explanation = await checkIgnore(repo.root, 'dist/file.txt');

			assert.deepStrictEqual(explanation, {
				source: '.gitignore',
				line: 1,
				pattern: 'dist/',
				path: 'dist/file.txt',
			});
		} finally {
			await repo.cleanup();
		}
	});

	test('explains nested .gitignore matches', async () => {
		const repo = await createTempGitRepo();

		try {
			await repo.writeFile('src/.gitignore', '*.local.json\n');
			await repo.writeFile('src/config.local.json');

			const explanation = await checkIgnore(repo.root, 'src/config.local.json');

			assert.deepStrictEqual(explanation, {
				source: 'src/.gitignore',
				line: 1,
				pattern: '*.local.json',
				path: 'src/config.local.json',
			});
		} finally {
			await repo.cleanup();
		}
	});

	test('explains .git/info/exclude matches', async () => {
		const repo = await createTempGitRepo();

		try {
			await repo.writeFile('.git/info/exclude', 'local-notes.md\n');
			await repo.writeFile('local-notes.md');

			const explanation = await checkIgnore(repo.root, 'local-notes.md');

			assert.deepStrictEqual(explanation, {
				source: '.git/info/exclude',
				line: 1,
				pattern: 'local-notes.md',
				path: 'local-notes.md',
			});
		} finally {
			await repo.cleanup();
		}
	});

	test('returns undefined for files not ignored by Git', async () => {
		const repo = await createTempGitRepo();

		try {
			await repo.writeFile('src/app.ts');

			assert.strictEqual(await checkIgnore(repo.root, 'src/app.ts'), undefined);
		} finally {
			await repo.cleanup();
		}
	});

	test('explains files inside ignored directories', async () => {
		const repo = await createTempGitRepo();

		try {
			await repo.writeFile('.gitignore', 'cache/\n');
			await repo.writeFile('cache/data.bin');

			const explanation = await checkIgnore(repo.root, 'cache/data.bin');

			assert.deepStrictEqual(explanation, {
				source: '.gitignore',
				line: 1,
				pattern: 'cache/',
				path: 'cache/data.bin',
			});
		} finally {
			await repo.cleanup();
		}
	});
});
