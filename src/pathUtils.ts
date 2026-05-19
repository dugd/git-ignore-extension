import * as path from 'node:path';

export function createIgnorePattern(repoRoot: string, resourcePath: string, isDirectory: boolean): string {
	const relativePath = path.relative(repoRoot, resourcePath);

	if (relativePath.length === 0 || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
		throw new Error('Resource must be inside the Git repository.');
	}

	const normalizedPath = normalizePathSeparators(relativePath);
	return isDirectory && !normalizedPath.endsWith('/') ? `${normalizedPath}/` : normalizedPath;
}

export function normalizePathSeparators(value: string): string {
	return value.replace(/\\/g, '/');
}
