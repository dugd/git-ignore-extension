import * as assert from 'assert';
import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { promisify } from 'node:util';
import * as vscode from 'vscode';
import { findGitRoot } from '../git';
import { createBatchTrackedWarningMessage, createTrackedWarningMessage, formatAddSummary } from '../gitIgnoreManager';
import { appendPatternsIfMissing } from '../ignoreFile';
import { createIgnorePattern, getGitRootSearchPath, normalizePathSeparators } from '../pathUtils';

const execFileAsync = promisify(execFile);

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

	test('starts Git root lookup from the selected folder instead of the workspace root', () => {
		const resourcePath = path.join('workspace', 'outer-repo', 'nested-repo');

		assert.strictEqual(getGitRootSearchPath(resourcePath, true), resourcePath);
	});

	test('starts Git root lookup from the selected file parent folder', () => {
		const resourcePath = path.join('workspace', 'outer-repo', 'nested-repo', 'src', 'config.local.json');

		assert.strictEqual(getGitRootSearchPath(resourcePath, false), path.dirname(resourcePath));
	});
});

suite('Git root resolution', () => {
	test('resolves the inner Git repository for a file inside a nested repository', async () => {
		const tempDirectory = await mkdtemp(path.join(os.tmpdir(), 'git-ignore-manager-'));
		const outerRepo = path.join(tempDirectory, 'outer-repo');
		const innerRepo = path.join(outerRepo, 'nested-repo');
		const innerFile = path.join(innerRepo, 'src', 'config.local.json');

		try {
			await vscode.workspace.fs.createDirectory(vscode.Uri.file(path.dirname(innerFile)));
			await execFileAsync('git', ['init', outerRepo]);
			await execFileAsync('git', ['init', innerRepo]);

			const searchPath = getGitRootSearchPath(innerFile, false);

			assert.strictEqual(await findGitRoot(searchPath), innerRepo);
		} finally {
			await rm(tempDirectory, { recursive: true, force: true });
		}
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

	test('describes tracked batch resources', () => {
		assert.strictEqual(
			createBatchTrackedWarningMessage(2, 5),
			'2 of 5 selected resources are already tracked by Git or contain tracked files. Ignoring them will not stop Git from tracking those files.',
		);
	});
});

suite('Ignore file writes', () => {
	test('appends missing patterns once and reports existing patterns', async () => {
		const tempDirectory = await mkdtemp(path.join(os.tmpdir(), 'git-ignore-manager-'));
		const ignoreFile = vscode.Uri.file(path.join(tempDirectory, '.gitignore'));

		try {
			let result = await appendPatternsIfMissing(ignoreFile, ['dist/', 'out/', 'dist/']);

			assert.deepStrictEqual(result, { added: 2, existing: 1 });

			result = await appendPatternsIfMissing(ignoreFile, ['dist/', 'coverage/']);

			assert.deepStrictEqual(result, { added: 1, existing: 1 });

			const content = Buffer.from(await vscode.workspace.fs.readFile(ignoreFile)).toString('utf8');
			assert.strictEqual(content, 'dist/\nout/\ncoverage/\n');
		} finally {
			await rm(tempDirectory, { recursive: true, force: true });
		}
	});
});

suite('Add summaries', () => {
	test('formats mixed batch results', () => {
		assert.strictEqual(
			formatAddSummary({ added: 3, existing: 2, skippedTracked: 1, failed: 1, targetCount: 7 }, 'exclude'),
			'Added 3 patterns to .git/info/exclude. 2 already existed. 1 skipped because it is tracked. 1 failed.',
		);
	});

	test('formats empty batch results', () => {
		assert.strictEqual(
			formatAddSummary({ added: 0, existing: 0, skippedTracked: 0, failed: 0, targetCount: 0 }, 'gitignore'),
			'No patterns were added to .gitignore.',
		);
	});
});
