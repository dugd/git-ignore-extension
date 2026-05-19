import * as assert from 'assert';
import * as path from 'node:path';
import { createTrackedWarningMessage } from '../gitIgnoreManager';
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

suite('Tracked warnings', () => {
	test('describes tracked files', () => {
		assert.strictEqual(
			createTrackedWarningMessage('src/config.local.json', false),
			'"src/config.local.json" is already tracked by Git. Ignoring it will not stop Git from tracking changes.',
		);
	});

	test('describes tracked folder contents', () => {
		assert.strictEqual(
			createTrackedWarningMessage('tmp/cache/', true),
			'"tmp/cache/" contains files already tracked by Git. Ignoring this folder will not stop Git from tracking those files.',
		);
	});
});
