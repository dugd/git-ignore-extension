import * as assert from 'assert';
import {
	createBatchTrackedWarningMessage,
	createTrackedWarningMessage,
	formatAddSummary,
	formatIgnoreExplanationMessage,
	getIgnoreSourcePath,
} from '../../gitIgnoreManager';

suite('messages', () => {
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

	test('formats added-only summaries', () => {
		assert.strictEqual(
			formatAddSummary(createSummary({ added: 1, targetCount: 1 }), 'gitignore'),
			'Added 1 pattern to .gitignore.',
		);
	});

	test('formats existing-only summaries', () => {
		assert.strictEqual(
			formatAddSummary(createSummary({ existing: 2, targetCount: 2 }), 'exclude'),
			'2 already existed.',
		);
	});

	test('formats skipped tracked summaries', () => {
		assert.strictEqual(
			formatAddSummary(createSummary({ skippedTracked: 2, targetCount: 2 }), 'gitignore'),
			'2 skipped because they are tracked.',
		);
	});

	test('formats failed summaries', () => {
		assert.strictEqual(
			formatAddSummary(createSummary({ failed: 2, targetCount: 2 }), 'exclude'),
			'2 failed.',
		);
	});

	test('formats untracked summaries', () => {
		assert.strictEqual(
			formatAddSummary(createSummary({ untracked: 2, targetCount: 2 }), 'gitignore'),
			'2 untracked from Git.',
		);
	});

	test('formats failed untrack summaries', () => {
		assert.strictEqual(
			formatAddSummary(createSummary({ untrackFailed: 1, targetCount: 1 }), 'gitignore'),
			'1 failed to untrack.',
		);
	});

	test('formats mixed batch results', () => {
		assert.strictEqual(
			formatAddSummary(createSummary({
				added: 3,
				existing: 2,
				skippedTracked: 1,
				untracked: 1,
				untrackFailed: 1,
				failed: 1,
				targetCount: 9,
			}), 'exclude'),
			'Added 3 patterns to .git/info/exclude. 2 already existed. 1 skipped because it is tracked. 1 untracked from Git. 1 failed to untrack. 1 failed.',
		);
	});

	test('formats empty batch results', () => {
		assert.strictEqual(
			formatAddSummary(createSummary({}), 'gitignore'),
			'No patterns were added to .gitignore.',
		);
	});

	test('formats effective ignore rule explanations', () => {
		assert.strictEqual(
			formatIgnoreExplanationMessage({
				source: 'src/.gitignore',
				line: 7,
				pattern: '*.local.json',
				path: 'src/config.local.json',
			}),
			'Ignored by src/.gitignore:7 using pattern "*.local.json".',
		);
	});

	test('resolves repository-relative ignore sources', () => {
		assert.strictEqual(getIgnoreSourcePath('/repo', 'src/.gitignore'), '/repo/src/.gitignore');
	});

	test('keeps absolute ignore sources unchanged', () => {
		assert.strictEqual(getIgnoreSourcePath('/repo', '/home/user/.gitignore_global'), '/home/user/.gitignore_global');
	});
});

function createSummary(overrides: Partial<Parameters<typeof formatAddSummary>[0]>): Parameters<typeof formatAddSummary>[0] {
	return {
		added: 0,
		existing: 0,
		skippedTracked: 0,
		untracked: 0,
		untrackFailed: 0,
		failed: 0,
		targetCount: 0,
		...overrides,
	};
}
