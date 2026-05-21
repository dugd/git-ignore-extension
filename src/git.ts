import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface IgnoreExplanation {
	source: string;
	line: number;
	pattern: string;
	path: string;
}

export async function findGitRoot(cwd: string): Promise<string> {
	const { stdout } = await execFileAsync('git', ['-C', cwd, 'rev-parse', '--show-toplevel']);
	return stdout.trim();
}

export async function isTrackedByGit(repoRoot: string, repoRelativePath: string): Promise<boolean> {
	try {
		await execFileAsync('git', ['-C', repoRoot, 'ls-files', '--error-unmatch', '--', repoRelativePath]);
		return true;
	} catch {
		return false;
	}
}

export async function hasTrackedFilesInDirectory(repoRoot: string, repoRelativeDirectory: string): Promise<boolean> {
	const { stdout } = await execFileAsync('git', ['-C', repoRoot, 'ls-files', '--', repoRelativeDirectory]);
	return stdout.trim().length > 0;
}

export async function checkIgnore(repoRoot: string, repoRelativePath: string): Promise<IgnoreExplanation | undefined> {
	try {
		const { stdout } = await execFileAsync('git', ['-C', repoRoot, 'check-ignore', '-v', '--', repoRelativePath]);
		return parseCheckIgnoreOutput(stdout);
	} catch (error) {
		if (isExitCode(error, 1)) {
			return undefined;
		}

		throw error;
	}
}

export function parseCheckIgnoreOutput(output: string): IgnoreExplanation {
	const line = output.trimEnd().split(/\r?\n/, 1)[0];
	const match = /^(.*):(\d+):([^\t]*)\t(.+)$/.exec(line);

	if (!match) {
		throw new Error(`Unexpected git check-ignore output: ${output}`);
	}

	return {
		source: match[1],
		line: Number(match[2]),
		pattern: match[3],
		path: match[4],
	};
}

function isExitCode(error: unknown, exitCode: number): boolean {
	return typeof error === 'object'
		&& error !== null
		&& 'code' in error
		&& (error as { code: unknown }).code === exitCode;
}
