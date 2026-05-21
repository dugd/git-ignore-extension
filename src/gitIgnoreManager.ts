import * as path from 'node:path';
import * as vscode from 'vscode';
import { findGitRoot, hasTrackedFilesInDirectory, isTrackedByGit } from './git';
import { appendPatternsIfMissing, ensureTextFile } from './ignoreFile';
import { createIgnorePattern } from './pathUtils';

type IgnoreTarget = 'gitignore' | 'exclude';

interface IgnoreCandidate {
	repoRoot: string;
	pattern: string;
	isDirectory: boolean;
}

export interface AddIgnoreSummary {
	added: number;
	existing: number;
	skippedTracked: number;
	failed: number;
	targetCount: number;
}

interface TrackedFilterResult {
	candidates: IgnoreCandidate[];
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
): Promise<void> {
	const resources = await resolveSelectedResources(resource, selectedResources);
	if (resources.length === 0) {
		vscode.window.showErrorMessage('Select a file or folder to ignore.');
		return;
	}

	if (resources.length === 1) {
		await addSingleResourceToIgnore(resources[0], target);
		return;
	}

	await addBatchResourcesToIgnore(resources, target);
}

async function addSingleResourceToIgnore(resource: vscode.Uri, target: IgnoreTarget): Promise<void> {
	const candidate = await createIgnoreCandidate(resource, true);
	if (!candidate) {
		return;
	}

	if (await hasTrackedContent(candidate.repoRoot, candidate.pattern, candidate.isDirectory)) {
		const choice = await vscode.window.showWarningMessage(
			createTrackedWarningMessage(candidate.pattern, candidate.isDirectory),
			'Add Anyway',
			'Cancel',
		);

		if (choice !== 'Add Anyway') {
			return;
		}
	}

	const ignoreFile = getIgnoreFileUri(candidate.repoRoot, target);
	const result = await appendPatternsIfMissing(ignoreFile, [candidate.pattern]);

	if (result.added > 0) {
		vscode.window.showInformationMessage(`Added "${candidate.pattern}" to ${targetLabels[target]}.`);
	} else {
		vscode.window.showInformationMessage(`"${candidate.pattern}" already exists in ${targetLabels[target]}.`);
	}
}

async function addBatchResourcesToIgnore(resources: readonly vscode.Uri[], target: IgnoreTarget): Promise<void> {
	const candidates: IgnoreCandidate[] = [];
	let failed = 0;

	for (const selectedResource of resources) {
		const candidate = await createIgnoreCandidate(selectedResource, false);
		if (candidate) {
			candidates.push(candidate);
		} else {
			failed++;
		}
	}

	if (candidates.length === 0) {
		showAddSummary({ added: 0, existing: 0, skippedTracked: 0, failed, targetCount: resources.length }, target);
		return;
	}

	const trackedCandidates = await findTrackedCandidates(candidates);
	const filterResult = await filterTrackedCandidates(candidates, trackedCandidates);
	if (!filterResult) {
		return;
	}

	const summary = await appendCandidates(filterResult.candidates, target);
	showAddSummary({
		...summary,
		skippedTracked: filterResult.skippedTracked,
		failed,
		targetCount: resources.length,
	}, target);
}

async function createIgnoreCandidate(resource: vscode.Uri, showError: boolean): Promise<IgnoreCandidate | undefined> {
	const repoRoot = await resolveGitRoot(resource, showError);
	if (!repoRoot) {
		return undefined;
	}

	try {
		const stat = await vscode.workspace.fs.stat(resource);
		const isDirectory = stat.type === vscode.FileType.Directory;
		const pattern = createIgnorePattern(repoRoot, resource.fsPath, isDirectory);

		return { repoRoot, pattern, isDirectory };
	} catch {
		if (showError) {
			vscode.window.showErrorMessage('Selected resource does not exist or cannot be read.');
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

	if (summary.failed > 0) {
		parts.push(`${summary.failed} failed`);
	}

	if (parts.length === 0) {
		return `No patterns were added to ${targetLabels[target]}.`;
	}

	return `${parts.join('. ')}.`;
}

export async function openIgnoreFile(resource: vscode.Uri | undefined, target: IgnoreTarget): Promise<void> {
	const baseResource = await resolveResourceForRepo(resource);
	if (!baseResource) {
		vscode.window.showErrorMessage('Open a workspace folder or file first.');
		return;
	}

	const repoRoot = await resolveGitRoot(baseResource, true);
	if (!repoRoot) {
		return;
	}

	const ignoreFile = getIgnoreFileUri(repoRoot, target);
	await ensureTextFile(ignoreFile);

	const document = await vscode.workspace.openTextDocument(ignoreFile);
	await vscode.window.showTextDocument(document);
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

async function resolveGitRoot(resource: vscode.Uri, showError: boolean): Promise<string | undefined> {
	const workspaceFolder = vscode.workspace.getWorkspaceFolder(resource);
	const cwd = workspaceFolder?.uri.fsPath ?? path.dirname(resource.fsPath);

	try {
		return await findGitRoot(cwd);
	} catch {
		if (showError) {
			vscode.window.showErrorMessage('Selected resource is not inside a Git repository.');
		}

		return undefined;
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
): Promise<TrackedFilterResult | undefined> {
	if (trackedCandidates.length === 0) {
		return { candidates: [...candidates], skippedTracked: 0 };
	}

	const choice = await vscode.window.showWarningMessage(
		candidates.length === 1 && trackedCandidates.length === 1
			? createTrackedWarningMessage(trackedCandidates[0].pattern, trackedCandidates[0].isDirectory)
			: createBatchTrackedWarningMessage(trackedCandidates.length, candidates.length),
		'Add Anyway',
		'Skip Tracked',
		'Cancel',
	);

	if (choice === 'Cancel' || choice === undefined) {
		return undefined;
	}

	if (choice === 'Skip Tracked') {
		const trackedKeys = new Set(trackedCandidates.map(getCandidateKey));
		return {
			candidates: candidates.filter((candidate) => !trackedKeys.has(getCandidateKey(candidate))),
			skippedTracked: trackedCandidates.length,
		};
	}

	return { candidates: [...candidates], skippedTracked: 0 };
}

async function appendCandidates(
	candidates: readonly IgnoreCandidate[],
	target: IgnoreTarget,
): Promise<Omit<AddIgnoreSummary, 'skippedTracked' | 'failed' | 'targetCount'>> {
	let added = 0;
	let existing = 0;
	const candidatesByRepoRoot = groupCandidatesByRepoRoot(candidates);

	for (const [repoRoot, repoCandidates] of candidatesByRepoRoot) {
		const ignoreFile = getIgnoreFileUri(repoRoot, target);
		const result = await appendPatternsIfMissing(ignoreFile, repoCandidates.map((candidate) => candidate.pattern));
		added += result.added;
		existing += result.existing;
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

function showAddSummary(summary: AddIgnoreSummary, target: IgnoreTarget): void {
	const message = formatAddSummary(summary, target);

	if (summary.added === 0 && summary.failed > 0) {
		vscode.window.showWarningMessage(message);
	} else {
		vscode.window.showInformationMessage(message);
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

function pluralize(count: number, singular: string): string {
	return count === 1 ? singular : `${singular}s`;
}

function getIgnoreFileUri(repoRoot: string, target: IgnoreTarget): vscode.Uri {
	if (target === 'gitignore') {
		return vscode.Uri.file(path.join(repoRoot, '.gitignore'));
	}

	return vscode.Uri.file(path.join(repoRoot, '.git', 'info', 'exclude'));
}
