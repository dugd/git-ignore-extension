import * as assert from 'assert';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { addResourceToIgnore } from '../../gitIgnoreManager';
import { noopLogger } from '../../logger';
import { createTempGitRepo, createTempGitRepoHandle } from '../helpers/tempGitRepo';

suite('add ignore integration', () => {
	test('adds an untracked file to root .gitignore', async () => {
		const repo = await createTempGitRepo();

		try {
			const file = await repo.writeFile('src/config.local.json');

			await addResourceToIgnore(file, undefined, 'gitignore', noopLogger);

			assert.strictEqual(await repo.readFile('.gitignore'), 'src/config.local.json\n');
		} finally {
			await repo.cleanup();
		}
	});

	test('adds an untracked folder to root .gitignore with a trailing slash', async () => {
		const repo = await createTempGitRepo();

		try {
			await repo.writeFile('tmp/cache/file.txt');
			const folder = repo.uri('tmp/cache');

			await addResourceToIgnore(folder, undefined, 'gitignore', noopLogger);

			assert.strictEqual(await repo.readFile('.gitignore'), 'tmp/cache/\n');
		} finally {
			await repo.cleanup();
		}
	});

	test('adds an untracked file to .git/info/exclude', async () => {
		const repo = await createTempGitRepo();

		try {
			const file = await repo.writeFile('local-notes.md');

			await addResourceToIgnore(file, undefined, 'exclude', noopLogger);

			const excludeContent = await repo.readFile('.git/info/exclude');
			assert.match(excludeContent, /local-notes\.md\n$/);
		} finally {
			await repo.cleanup();
		}
	});

	test('does not append duplicate patterns twice', async () => {
		const repo = await createTempGitRepo();

		try {
			const folder = await repo.mkdir('dist');

			await addResourceToIgnore(folder, undefined, 'gitignore', noopLogger);
			await addResourceToIgnore(folder, undefined, 'gitignore', noopLogger);

			assert.strictEqual(await repo.readFile('.gitignore'), 'dist/\n');
		} finally {
			await repo.cleanup();
		}
	});

	test('batch adds a file and folder in the same repository', async () => {
		const repo = await createTempGitRepo();

		try {
			const file = await repo.writeFile('src/config.local.json');
			const folder = await repo.mkdir('tmp/cache');

			await addResourceToIgnore(file, [file, folder], 'gitignore', noopLogger);

			assert.strictEqual(await repo.readFile('.gitignore'), 'src/config.local.json\ntmp/cache/\n');
		} finally {
			await repo.cleanup();
		}
	});

	test('batch duplicate selected resources write one pattern', async () => {
		const repo = await createTempGitRepo();

		try {
			const file = await repo.writeFile('scratch.txt');

			await addResourceToIgnore(file, [file, file], 'gitignore', noopLogger);

			assert.strictEqual(await repo.readFile('.gitignore'), 'scratch.txt\n');
		} finally {
			await repo.cleanup();
		}
	});

	test('batch multi-repo writes to each repository ignore file', async () => {
		const first = await createTempGitRepo('first-repo');
		const secondRoot = path.join(path.dirname(first.root), 'second-repo');
		const second = createTempGitRepoHandle(path.dirname(first.root), secondRoot);

		try {
			await second.git(['init']);
			const firstFile = await first.writeFile('first.local');
			const secondFile = await second.writeFile('second.local');

			await addResourceToIgnore(firstFile, [firstFile, secondFile], 'gitignore', noopLogger);

			assert.strictEqual(await first.readFile('.gitignore'), 'first.local\n');
			assert.strictEqual(await second.readFile('.gitignore'), 'second.local\n');
		} finally {
			await first.cleanup();
		}
	});

	test('nested repo add writes to inner .gitignore, not outer .gitignore', async () => {
		const outer = await createTempGitRepo('outer-repo');
		const innerRoot = path.join(outer.root, 'nested-repo');
		const inner = createTempGitRepoHandle(path.dirname(outer.root), innerRoot);

		try {
			await inner.git(['init']);
			const innerFile = await inner.writeFile('src/config.local.json');

			await addResourceToIgnore(innerFile, undefined, 'gitignore', noopLogger);

			assert.strictEqual(await inner.readFile('.gitignore'), 'src/config.local.json\n');
			await assert.rejects(async () => {
				await vscode.workspace.fs.readFile(outer.uri('.gitignore'));
			});
		} finally {
			await outer.cleanup();
		}
	});
});
