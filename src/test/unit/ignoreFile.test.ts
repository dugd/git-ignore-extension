import * as assert from 'assert';
import { createTempGitRepo } from '../helpers/tempGitRepo';
import { appendPatternsIfMissing, ensureTextFile } from '../../ignoreFile';

suite('ignoreFile', () => {
	test('appends a pattern to an empty file', async () => {
		const repo = await createTempGitRepo();

		try {
			const ignoreFile = repo.uri('.gitignore');
			const result = await appendPatternsIfMissing(ignoreFile, ['dist/']);

			assert.deepStrictEqual(result, { added: 1, existing: 0 });
			assert.strictEqual(await repo.readFile('.gitignore'), 'dist/\n');
		} finally {
			await repo.cleanup();
		}
	});

	test('adds a newline before appending when the file has no trailing newline', async () => {
		const repo = await createTempGitRepo();

		try {
			await repo.writeFile('.gitignore', 'dist/');
			const result = await appendPatternsIfMissing(repo.uri('.gitignore'), ['coverage/']);

			assert.deepStrictEqual(result, { added: 1, existing: 0 });
			assert.strictEqual(await repo.readFile('.gitignore'), 'dist/\ncoverage/\n');
		} finally {
			await repo.cleanup();
		}
	});

	test('prevents exact duplicates', async () => {
		const repo = await createTempGitRepo();

		try {
			await repo.writeFile('.gitignore', 'dist/\n');
			const result = await appendPatternsIfMissing(repo.uri('.gitignore'), ['dist/']);

			assert.deepStrictEqual(result, { added: 0, existing: 1 });
			assert.strictEqual(await repo.readFile('.gitignore'), 'dist/\n');
		} finally {
			await repo.cleanup();
		}
	});

	test('prevents trimmed duplicates', async () => {
		const repo = await createTempGitRepo();

		try {
			await repo.writeFile('.gitignore', '  dist/  \n');
			const result = await appendPatternsIfMissing(repo.uri('.gitignore'), ['dist/']);

			assert.deepStrictEqual(result, { added: 0, existing: 1 });
		} finally {
			await repo.cleanup();
		}
	});

	test('does not treat commented patterns as duplicates', async () => {
		const repo = await createTempGitRepo();

		try {
			await repo.writeFile('.gitignore', '# dist/\n');
			const result = await appendPatternsIfMissing(repo.uri('.gitignore'), ['dist/']);

			assert.deepStrictEqual(result, { added: 1, existing: 0 });
			assert.strictEqual(await repo.readFile('.gitignore'), '# dist/\ndist/\n');
		} finally {
			await repo.cleanup();
		}
	});

	test('writes duplicate batch input once', async () => {
		const repo = await createTempGitRepo();

		try {
			const result = await appendPatternsIfMissing(repo.uri('.gitignore'), ['dist/', 'out/', 'dist/']);

			assert.deepStrictEqual(result, { added: 2, existing: 1 });
			assert.strictEqual(await repo.readFile('.gitignore'), 'dist/\nout/\n');
		} finally {
			await repo.cleanup();
		}
	});

	test('creates parent directories when ensuring a text file', async () => {
		const repo = await createTempGitRepo();

		try {
			await ensureTextFile(repo.uri('nested/path/file.txt'));

			assert.strictEqual(await repo.readFile('nested/path/file.txt'), '');
		} finally {
			await repo.cleanup();
		}
	});
});
