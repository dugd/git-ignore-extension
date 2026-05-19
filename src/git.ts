import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

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
