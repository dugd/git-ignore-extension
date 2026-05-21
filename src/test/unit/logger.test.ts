import * as assert from 'assert';
import * as vscode from 'vscode';
import { createOutputChannelLogger, noopLogger } from '../../logger';

suite('logger', () => {
	test('output channel logger writes leveled messages', () => {
		const lines: string[] = [];
		const channel = {
			appendLine: (value: string) => {
				lines.push(value);
			},
		} as vscode.OutputChannel;
		const logger = createOutputChannelLogger(channel);

		logger.info('one');
		logger.warn('two');
		logger.error('three');

		assert.match(lines[0], /\[info\] one$/);
		assert.match(lines[1], /\[warn\] two$/);
		assert.match(lines[2], /\[error\] three$/);
	});

	test('noop logger methods are callable', () => {
		assert.doesNotThrow(() => {
			noopLogger.info('one');
			noopLogger.warn('two');
			noopLogger.error('three');
		});
	});
});
