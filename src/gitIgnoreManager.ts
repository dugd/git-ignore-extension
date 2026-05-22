import * as path from 'node:path';
import * as vscode from 'vscode';
import type { IgnoreExplanation } from './git';
import { checkIgnore, findGitRoot, hasTrackedFilesInDirectory, isTrackedByGit, untrackFromGit } from './git';
import { appendPatternsIfMissing, ensureTextFile } from './ignoreFile';
import type { Logger } from './logger';
import { noopLogger } from './logger';
import { createIgnorePattern, getGitRootSearchPath, normalizePathSeparators } from './pathUtils';
import type { UserPrompts } from './userPrompts';
import { vscodeUserPrompts } from './userPrompts';

type IgnoreTarget = 'gitignore' | 'exclude';
const openRuleAction = 'Open Rule';
const addAnywayAction = 'Add Anyway';
const untrackAndIgnoreAction = 'Untrack and Ignore';
const skipTrackedAction = 'Skip Tracked';
const cancelAction = 'Cancel';

interface IgnoreCandidate {
	repoRoot: string;
	pattern: string;
	isDirectory: boolean;
}

export interface AddIgnoreSummary {
	added: number;
	existing: number;
	skippedTracked: number;
	untracked: number;
	untrackFailed: number;
	failed: number;
	targetCount: number;
}

interface TrackedFilterResult {
	candidates: IgnoreCandidate[];
	trackedCandidatesToUntrack: IgnoreCandidate[];
	skippedTracked: number;
}

const targetLabels: Record<IgnoreTarget, string> = {
	gitignore: '.gitignore',
	exclude: '.git/info/exclude',
};

export async function addResourceToIgnore(
	resource: vscode.Uri | undefined,
	selectedResources: readonly vscode.Uri[] | undefined,
	target: IgnoreTarget,
	logger: Logger = noopLogger,
	prompts: UserPrompts = vscodeUserPrompts,
): Promise<void> {
	const resources = await resolveSelectedResources(resource, selectedResources);
	logger.info(`Add to ${targetLabels[target]} started: ${resources.length} resource(s)`);

	if (resources.length === 0) {
		logger.warn('Add command failed: no selected resource');
		prompts.showErrorMessage('Select a file or folder to ignore.');
		return;
	}

	if (resources.length === 1) {
		await addSingleResourceToIgnore(resources[0], target, logger, prompts);
		return;
	}

	await addBatchResourcesToIgnore(resources, target, logger, prompts);
}

async function addSingleResourceToIgnore(resource: vscode.Uri, target: IgnoreTarget, logger: Logger, prompts: UserPrompts): Promise<void> {
	const candidate = await createIgnoreCandidate(resource, true, logger, prompts);
	if (!candidate) {
		return;
	}

	if (await hasTrackedContent(candidate.repoRoot, candidate.pattern, candidate.isDirectory)) {
		logger.warn(`Resource is tracked or contains tracked files: ${candidate.pattern}`);
		const choice = await prompts.showWarningMessage(
			createTrackedWarningMessage(candidate.pattern, candidate.isDirectory),
			addAnywayAction,
			untrackAndIgnoreAction,
			cancelAction,
		);
		logger.info(`Tracked warning decision: ${choice ?? 'dismissed'}`);

		if (choice === cancelAction || choice === undefined) {
			return;
		}

		const result = await appendSingleCandidate(candidate, target, logger);
		if (choice === untrackAndIgnoreAction) {
			const untrackSummary = await untrackCandidates([candidate], logger);
			showSingleAddAndUntrackResult(candidate.pattern, target, result, untrackSummary, prompts);
			return;
		}

		showSingleAddResult(candidate.pattern, target, result, prompts);
		return;
	}

	const result = await appendSingleCandidate(candidate, target, logger);
	showSingleAddResult(candidate.pattern, target, result, prompts);
}

async function appendSingleCandidate(candidate: IgnoreCandidate, target: IgnoreTarget, logger: Logger): Promise<{ added: number; existing: number }> {
	const ignoreFile = getIgnoreFileUri(candidate.repoRoot, target);
	logger.info(`Target ignore file: ${ignoreFile.fsPath}`);
	const result = await appendPatternsIfMissing(ignoreFile, [candidate.pattern]);
	if (result.added > 0) {
		logger.info(`Pattern added: ${candidate.pattern}`);
	} else {
		logger.info(`Pattern already exists: ${candidate.pattern}`);
	}

	return result;
}

function showSingleAddResult(pattern: string, target: IgnoreTarget, result: { added: number }, prompts: UserPrompts): void {
	if (result.added > 0) {
		prompts.showInformationMessage(`Added "${pattern}" to ${targetLabels[target]}.`);
	} else {
		prompts.showInformationMessage(`"${pattern}" already exists in ${targetLabels[target]}.`);
	}
}

function showSingleAddAndUntrackResult(
	pattern: string,
	target: IgnoreTarget,
	result: { added: number },
	untrackSummary: { untracked: number; untrackFailed: number },
	prompts: UserPrompts,
): void {
	const prefix = result.added > 0
		? `Added "${pattern}" to ${targetLabels[target]}`
		: `"${pattern}" already exists in ${targetLabels[target]}`;

	if (untrackSummary.untracked > 0) {
		prompts.showInformationMessage(`${prefix} and untracked it from Git.`);
		return;
	}

	prompts.showWarningMessage(`${prefix}, but failed to untrack it from Git. See Git Ignore Manager output for details.`);
}

async function addBatchResourcesToIgnore(resources: readonly vscode.Uri[], target: IgnoreTarget, logger: Logger, prompts: UserPrompts): Promise<void> {
	const candidates: IgnoreCandidate[] = [];
	let failed = 0;

	for (const selectedResource of resources) {
		const candidate = await createIgnoreCandidate(selectedResource, false, logger, prompts);
		if (candidate) {
			candidates.push(candidate);
		} else {
			logger.warn(`Failed to process selected resource: ${selectedResource.fsPath}`);
			failed++;
		}
	}

	if (candidates.length === 0) {
		showAddSummary({
			added: 0,
			existing: 0,
			skippedTracked: 0,
			untracked: 0,
			untrackFailed: 0,
			failed,
			targetCount: resources.length,
		}, target, logger, prompts);
		return;
	}

	const trackedCandidates = await findTrackedCandidates(candidates);
	const filterResult = await filterTrackedCandidates(candidates, trackedCandidates, logger, prompts);
	if (!filterResult) {
		return;
	}

	const summary = await appendCandidates(filterResult.candidates, target, logger);
	const untrackSummary = await untrackCandidates(filterResult.trackedCandidatesToUntrack, logger);
	showAddSummary({
		...summary,
		skippedTracked: filterResult.skippedTracked,
		...untrackSummary,
		failed,
		targetCount: resources.length,
	}, target, logger, prompts);
}

async function createIgnoreCandidate(
	resource: vscode.Uri,
	showError: boolean,
	logger: Logger,
	prompts: UserPrompts,
): Promise<IgnoreCandidate | undefined> {
	const repoRoot = await resolveGitRoot(resource, showError, logger, prompts);
	if (!repoRoot) {
		return undefined;
	}

	try {
		const stat = await vscode.workspace.fs.stat(resource);
		const isDirectory = stat.type === vscode.FileType.Directory;
		const pattern = createIgnorePattern(repoRoot, resource.fsPath, isDirectory);
		logger.info(`Generated pattern: ${pattern}`);

		return { repoRoot, pattern, isDirectory };
	} catch (error) {
		logger.error(`Failed to read selected resource ${resource.fsPath}: ${getErrorMessage(error)}`);
		if (showError) {
			prompts.showErrorMessage('Selected resource does not exist or cannot be read.');
		}

		return undefined;
	}
}

export function createTrackedWarningMessage(pattern: string, isDirectory: boolean): string {
	if (isDirectory) {
		return `"${pattern}" contains files already tracked by Git. Ignoring this folder will not stop Git from tracking those files.`;
	}

	return `"${pattern}" is already tracked by Git. Ignoring it will not stop Git from tracking changes.`;
}

export function createBatchTrackedWarningMessage(trackedCount: number, totalCount: number): string {
	if (trackedCount === 1 && totalCount === 1) {
		return 'The selected resource is already tracked by Git or contains tracked files. Ignoring it will not stop Git from tracking those files.';
	}

	return `${trackedCount} of ${totalCount} selected resources are already tracked by Git or contain tracked files. Ignoring them will not stop Git from tracking those files.`;
}

export function formatAddSummary(summary: AddIgnoreSummary, target: IgnoreTarget): string {
	const parts: string[] = [];

	if (summary.added > 0) {
		parts.push(`Added ${summary.added} ${pluralize(summary.added, 'pattern')} to ${targetLabels[target]}`);
	}

	if (summary.existing > 0) {
		parts.push(`${summary.existing} already ${summary.existing === 1 ? 'existed' : 'existed'}`);
	}

	if (summary.skippedTracked > 0) {
		parts.push(`${summary.skippedTracked} skipped because ${summary.skippedTracked === 1 ? 'it is' : 'they are'} tracked`);
	}

	if (summary.untracked > 0) {
		parts.push(`${summary.untracked} untracked from Git`);
	}

	if (summary.untrackFailed > 0) {
		parts.push(`${summary.untrackFailed} failed to untrack`);
	}

	if (summary.failed > 0) {
		parts.push(`${summary.failed} failed`);
	}

	if (parts.length === 0) {
		return `No patterns were added to ${targetLabels[target]}.`;
	}

	return `${parts.join('. ')}.`;
}

export async function openIgnoreFile(
	resource: vscode.Uri | undefined,
	target: IgnoreTarget,
	logger: Logger = noopLogger,
	prompts: UserPrompts = vscodeUserPrompts,
): Promise<void> {
	const baseResource = await resolveResourceForRepo(resource);
	if (!baseResource) {
		logger.warn(`Open ${targetLabels[target]} failed: no workspace folder or selected resource`);
		prompts.showErrorMessage('Open a workspace folder or file first.');
		return;
	}

	const repoRoot = await resolveGitRoot(baseResource, true, logger, prompts);
	if (!repoRoot) {
		return;
	}

	const ignoreFile = getIgnoreFileUri(repoRoot, target);
	await ensureTextFile(ignoreFile);
	logger.info(`Opened ignore file: ${ignoreFile.fsPath}`);

	const document = await vscode.workspace.openTextDocument(ignoreFile);
	await vscode.window.showTextDocument(document);
}

export async function explainIgnoredResource(
	resource: vscode.Uri | undefined,
	logger: Logger = noopLogger,
	prompts: UserPrompts = vscodeUserPrompts,
): Promise<void> {
	logger.info('Why Is This Ignored? started');
	const selectedResource = await resolveSelectedResource(resource);
	if (!selectedResource) {
		logger.warn('Explain ignored command failed: no selected resource');
		prompts.showErrorMessage('Select a file or folder to inspect.');
		return;
	}

	const repoRoot = await resolveGitRoot(selectedResource, true, logger, prompts);
	if (!repoRoot) {
		return;
	}

	const repoRelativePath = createRepoRelativePath(repoRoot, selectedResource.fsPath);
	logger.info(`Checking ignore explanation for: ${repoRelativePath}`);

	try {
		const explanation = await checkIgnore(repoRoot, repoRelativePath);
		if (!explanation) {
			logger.info(`Not ignored: ${repoRelativePath}`);
			prompts.showInformationMessage(`"${repoRelativePath}" is not ignored by Git.`);
			return;
		}

		logger.info(`Ignored by ${explanation.source}:${explanation.line} pattern="${explanation.pattern}" path="${explanation.path}"`);
		const choice = await prompts.showInformationMessage(formatIgnoreExplanationMessage(explanation), openRuleAction);

		if (choice === openRuleAction) {
			await openIgnoreRule(repoRoot, explanation.source, explanation.line, logger);
		}
	} catch (error) {
		logger.error(`Failed to explain ignore status for ${repoRelativePath}: ${getErrorMessage(error)}`);
		prompts.showErrorMessage('Failed to check Git ignore status. See Git Ignore Manager output for details.');
	}
}

async function resolveSelectedResources(
	resource: vscode.Uri | undefined,
	selectedResources: readonly vscode.Uri[] | undefined,
): Promise<vscode.Uri[]> {
	const resources = [...(selectedResources ?? [])];

	if (resource && !resources.some((selectedResource) => selectedResource.fsPath === resource.fsPath)) {
		resources.unshift(resource);
	}

	if (resources.length > 0) {
		return uniqueResources(resources);
	}

	const selectedResource = await resolveSelectedResource(resource);
	return selectedResource ? [selectedResource] : [];
}

async function resolveSelectedResource(resource: vscode.Uri | undefined): Promise<vscode.Uri | undefined> {
	if (resource) {
		return resource;
	}

	return vscode.window.activeTextEditor?.document.uri;
}

async function resolveResourceForRepo(resource: vscode.Uri | undefined): Promise<vscode.Uri | undefined> {
	const selectedResource = await resolveSelectedResource(resource);
	if (selectedResource) {
		return selectedResource;
	}

	const workspaceFolders = vscode.workspace.workspaceFolders ?? [];
	if (workspaceFolders.length === 1) {
		return workspaceFolders[0].uri;
	}

	if (workspaceFolders.length > 1) {
		const picked = await vscode.window.showQuickPick(
			workspaceFolders.map((folder) => ({ label: folder.name, folder })),
			{ placeHolder: 'Select a workspace folder' },
		);

		return picked?.folder.uri;
	}

	return undefined;
}

async function resolveGitRoot(
	resource: vscode.Uri,
	showError: boolean,
	logger: Logger,
	prompts: UserPrompts,
): Promise<string | undefined> {
	try {
		const isDirectory = await isDirectoryResource(resource);
		const searchPath = getGitRootSearchPath(resource.fsPath, isDirectory);
		const repoRoot = await findGitRoot(searchPath);
		logger.info(`Resolved Git root for ${resource.fsPath} -> ${repoRoot}`);
		return repoRoot;
	} catch (error) {
		logger.warn(`Git root resolution failed for ${resource.fsPath}: ${getErrorMessage(error)}`);
		if (showError) {
			prompts.showErrorMessage('Selected resource is not inside a Git repository.');
		}

		return undefined;
	}
}

async function isDirectoryResource(resource: vscode.Uri): Promise<boolean> {
	try {
		const stat = await vscode.workspace.fs.stat(resource);
		return stat.type === vscode.FileType.Directory;
	} catch {
		return false;
	}
}

async function findTrackedCandidates(candidates: readonly IgnoreCandidate[]): Promise<IgnoreCandidate[]> {
	const trackedCandidates = await Promise.all(candidates.map(async (candidate) => {
		return await hasTrackedContent(candidate.repoRoot, candidate.pattern, candidate.isDirectory) ? candidate : undefined;
	}));

	return trackedCandidates.filter((candidate): candidate is IgnoreCandidate => candidate !== undefined);
}

async function filterTrackedCandidates(
	candidates: readonly IgnoreCandidate[],
	trackedCandidates: readonly IgnoreCandidate[],
	logger: Logger,
	prompts: UserPrompts,
): Promise<TrackedFilterResult | undefined> {
	if (trackedCandidates.length === 0) {
		return { candidates: [...candidates], trackedCandidatesToUntrack: [], skippedTracked: 0 };
	}

	const choice = await prompts.showWarningMessage(
		candidates.length === 1 && trackedCandidates.length === 1
			? createTrackedWarningMessage(trackedCandidates[0].pattern, trackedCandidates[0].isDirectory)
			: createBatchTrackedWarningMessage(trackedCandidates.length, candidates.length),
		addAnywayAction,
		skipTrackedAction,
		untrackAndIgnoreAction,
		cancelAction,
	);
	logger.info(`Tracked warning decision: ${choice ?? 'dismissed'}`);

	if (choice === cancelAction || choice === undefined) {
		return undefined;
	}

	if (choice === skipTrackedAction) {
		const trackedKeys = new Set(trackedCandidates.map(getCandidateKey));
		return {
			candidates: candidates.filter((candidate) => !trackedKeys.has(getCandidateKey(candidate))),
			trackedCandidatesToUntrack: [],
			skippedTracked: trackedCandidates.length,
		};
	}

	return {
		candidates: [...candidates],
		trackedCandidatesToUntrack: choice === untrackAndIgnoreAction ? [...trackedCandidates] : [],
		skippedTracked: 0,
	};
}

async function appendCandidates(
	candidates: readonly IgnoreCandidate[],
	target: IgnoreTarget,
	logger: Logger,
): Promise<Omit<AddIgnoreSummary, 'skippedTracked' | 'untracked' | 'untrackFailed' | 'failed' | 'targetCount'>> {
	let added = 0;
	let existing = 0;
	const candidatesByRepoRoot = groupCandidatesByRepoRoot(candidates);

	for (const [repoRoot, repoCandidates] of candidatesByRepoRoot) {
		const ignoreFile = getIgnoreFileUri(repoRoot, target);
		logger.info(`Target ignore file: ${ignoreFile.fsPath}`);
		const result = await appendPatternsIfMissing(ignoreFile, repoCandidates.map((candidate) => candidate.pattern));
		added += result.added;
		existing += result.existing;
		logger.info(`Updated ignore file: added=${result.added} existing=${result.existing} file=${ignoreFile.fsPath}`);
	}

	return { added, existing };
}

function groupCandidatesByRepoRoot(candidates: readonly IgnoreCandidate[]): Map<string, IgnoreCandidate[]> {
	const candidatesByRepoRoot = new Map<string, IgnoreCandidate[]>();

	for (const candidate of candidates) {
		const repoCandidates = candidatesByRepoRoot.get(candidate.repoRoot) ?? [];
		repoCandidates.push(candidate);
		candidatesByRepoRoot.set(candidate.repoRoot, repoCandidates);
	}

	return candidatesByRepoRoot;
}

function showAddSummary(summary: AddIgnoreSummary, target: IgnoreTarget, logger: Logger, prompts: UserPrompts): void {
	const message = formatAddSummary(summary, target);
	logger.info(`Add complete: added=${summary.added} existing=${summary.existing} skippedTracked=${summary.skippedTracked} untracked=${summary.untracked} untrackFailed=${summary.untrackFailed} failed=${summary.failed} target=${targetLabels[target]}`);

	if (summary.added === 0 && summary.failed > 0) {
		prompts.showWarningMessage(message);
	} else {
		prompts.showInformationMessage(message);
	}
}

async function hasTrackedContent(repoRoot: string, pattern: string, isDirectory: boolean): Promise<boolean> {
	if (isDirectory) {
		return hasTrackedFilesInDirectory(repoRoot, pattern);
	}

	return isTrackedByGit(repoRoot, pattern);
}

function uniqueResources(resources: readonly vscode.Uri[]): vscode.Uri[] {
	const seen = new Set<string>();
	const unique: vscode.Uri[] = [];

	for (const resource of resources) {
		if (!seen.has(resource.fsPath)) {
			seen.add(resource.fsPath);
			unique.push(resource);
		}
	}

	return unique;
}

function getCandidateKey(candidate: IgnoreCandidate): string {
	return `${candidate.repoRoot}\0${candidate.pattern}`;
}

async function untrackCandidates(candidates: readonly IgnoreCandidate[], logger: Logger): Promise<{ untracked: number; untrackFailed: number }> {
	let untracked = 0;
	let untrackFailed = 0;

	for (const candidate of candidates) {
		try {
			logger.info(`Untracking from Git: ${candidate.pattern}`);
			await untrackFromGit(candidate.repoRoot, candidate.pattern, candidate.isDirectory);
			untracked++;
		} catch (error) {
			logger.error(`Failed to untrack ${candidate.pattern}: ${getErrorMessage(error)}`);
			untrackFailed++;
		}
	}

	return { untracked, untrackFailed };
}

function pluralize(count: number, singular: string): string {
	return count === 1 ? singular : `${singular}s`;
}

function getErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

function createRepoRelativePath(repoRoot: string, resourcePath: string): string {
	return normalizePathSeparators(path.relative(repoRoot, resourcePath));
}

export function formatIgnoreExplanationMessage(explanation: IgnoreExplanation): string {
	return `Ignored by ${explanation.source}:${explanation.line} using pattern "${explanation.pattern}".`;
}

async function openIgnoreRule(repoRoot: string, source: string, line: number, logger: Logger): Promise<void> {
	const sourceUri = vscode.Uri.file(getIgnoreSourcePath(repoRoot, source));
	const document = await vscode.workspace.openTextDocument(sourceUri);
	const editor = await vscode.window.showTextDocument(document);
	const position = new vscode.Position(Math.max(line - 1, 0), 0);

	editor.selection = new vscode.Selection(position, position);
	editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
	logger.info(`Opened ignore rule: ${sourceUri.fsPath}:${line}`);
}

export function getIgnoreSourcePath(repoRoot: string, source: string): string {
	if (path.isAbsolute(source)) {
		return source;
	}

	return path.join(repoRoot, source);
}

function getIgnoreFileUri(repoRoot: string, target: IgnoreTarget): vscode.Uri {
	if (target === 'gitignore') {
		return vscode.Uri.file(path.join(repoRoot, '.gitignore'));
	}

	return vscode.Uri.file(path.join(repoRoot, '.git', 'info', 'exclude'));
}
