import { defineConfig } from '@vscode/test-cli';

export default defineConfig({
	files: [
		'out/test/unit/**/*.test.js',
		'out/test/integration/**/*.test.js',
	],
});
