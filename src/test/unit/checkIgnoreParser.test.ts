import * as assert from 'assert';
import { parseCheckIgnoreOutput } from '../../git';

suite('check-ignore parser', () => {
	test('parses root .gitignore output', () => {
		assert.deepStrictEqual(parseCheckIgnoreOutput('.gitignore:3:dist/\tdist/file.txt\n'), {
			source: '.gitignore',
			line: 3,
			pattern: 'dist/',
			path: 'dist/file.txt',
		});
	});

	test('parses nested .gitignore output', () => {
		assert.deepStrictEqual(parseCheckIgnoreOutput('src/.gitignore:7:*.local.json\tsrc/config.local.json\n'), {
			source: 'src/.gitignore',
			line: 7,
			pattern: '*.local.json',
			path: 'src/config.local.json',
		});
	});

	test('parses .git/info/exclude output', () => {
		assert.deepStrictEqual(parseCheckIgnoreOutput('.git/info/exclude:12:scratch/\tscratch/file.txt\n'), {
			source: '.git/info/exclude',
			line: 12,
			pattern: 'scratch/',
			path: 'scratch/file.txt',
		});
	});

	test('parses sources that contain colons', () => {
		assert.deepStrictEqual(parseCheckIgnoreOutput('/tmp/repo:with:colon/.gitignore:4:*.log\tdebug.log\n'), {
			source: '/tmp/repo:with:colon/.gitignore',
			line: 4,
			pattern: '*.log',
			path: 'debug.log',
		});
	});

	test('throws on unexpected output', () => {
		assert.throws(() => parseCheckIgnoreOutput('not valid'), /Unexpected git check-ignore output/);
	});
});
