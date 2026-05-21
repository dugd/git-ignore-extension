import * as assert from 'assert';
import * as path from 'node:path';
import { createIgnorePattern, getGitRootSearchPath, normalizePathSeparators } from '../../pathUtils';

suite('pathUtils', () => {
	test('creates repository-relative file patterns', () => {
		const repoRoot = path.join('workspace', 'repo');
		const filePath = path.join(repoRoot, 'src', 'config.local.json');

		assert.strictEqual(createIgnorePattern(repoRoot, filePath, false), 'src/config.local.json');
	});

	test('creates folder patterns with a trailing slash', () => {
		const repoRoot = path.join('workspace', 'repo');
		const folderPath = path.join(repoRoot, 'tmp', 'cache');

		assert.strictEqual(createIgnorePattern(repoRoot, folderPath, true), 'tmp/cache/');
	});

	test('does not duplicate a folder trailing slash', () => {
		assert.strictEqual(createIgnorePattern('/repo', '/repo/tmp/cache/', true), 'tmp/cache/');
	});

	test('throws for resources outside the repository', () => {
		assert.throws(() => createIgnorePattern('/repo', '/other/file.txt', false), /inside the Git repository/);
	});

	test('throws for the repository root itself', () => {
		assert.throws(() => createIgnorePattern('/repo', '/repo', true), /inside the Git repository/);
	});

	test('normalizes Windows separators', () => {
		assert.strictEqual(normalizePathSeparators('src\\config\\local.json'), 'src/config/local.json');
	});

	test('starts Git root lookup from the selected folder', () => {
		const resourcePath = path.join('workspace', 'outer-repo', 'nested-repo');

		assert.strictEqual(getGitRootSearchPath(resourcePath, true), resourcePath);
	});

	test('starts Git root lookup from the selected file parent folder', () => {
		const resourcePath = path.join('workspace', 'outer-repo', 'nested-repo', 'src', 'config.local.json');

		assert.strictEqual(getGitRootSearchPath(resourcePath, false), path.dirname(resourcePath));
	});
});
