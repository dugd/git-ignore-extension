import * as assert from 'assert';
import * as path from 'node:path';
import { createIgnorePattern, normalizePathSeparators } from '../pathUtils';

suite('Path utilities', () => {
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

	test('normalizes Windows separators', () => {
		assert.strictEqual(normalizePathSeparators('src\\config\\local.json'), 'src/config/local.json');
	});
});
