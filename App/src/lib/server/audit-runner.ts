import { runAudit } from '$lib/server/audit';
import {
	attachMetricScreenshots,
	buildNormalizedAuditItems,
	getNormalizedSectionDefinitions,
	type AuditResult
} from '$lib/server/audit-normalize';
import { runAuditCaptureRequest, type AuditCaptureRequest } from '$lib/server/audit-capture';
import {
	createAuditFindingRecord,
	createAuditScreenshotRecord,
	deleteAuditFindingsByRunId,
	getOrCreateAuditFindingTypeRecord,
	getOrCreateRunRecord,
	getWorkflow,
	listAuditReportTemplates,
	type AuditReportTemplateRecord,
	updateAuditRecord,
	updateRunRecord,
	updateWorkflowRecord
} from '$lib/server/pocketbase';

type QueuePayload = {
	workflowId: string;
	auditId: string;
	url: string;
	token?: string;
};

type AuditRunnerState = {
	activeWorkflows: Set<string>;
};

type AuditSummaryResult = AuditResult;

type ScreenshotPayload = {
	contentType?: string;
	imageBase64?: string;
};

type ScreenshotJob = {
	auditId: string;
	findingTypeId: string;
	runId: string;
	reportTemplateKey: string;
	title: string;
	page_url?: string;
	request: AuditCaptureRequest;
};

type ScreenshotQueueState = {
	chain: Promise<void>;
	queuedKeys: Set<string>;
	activeKeys: Set<string>;
	completedKeys: Set<string>;
};

type CaptureEntry = Record<string, unknown> & { page: string };
type NormalizedAuditItem = ReturnType<typeof buildNormalizedAuditItems>[number];

type WorkflowRecordLike = {
	id?: string;
	status?: string;
	started_at?: string;
	audit?: string;
	expand?: {
		audit?: {
			id?: string;
			expand?: {
				website?: {
					url?: string;
				};
			};
		};
	};
};

const state = ((
	globalThis as typeof globalThis & { __auditRunnerState?: AuditRunnerState }
).__auditRunnerState ??= {
	activeWorkflows: new Set<string>()
});

const screenshotQueueState = ((
	globalThis as typeof globalThis & { __auditScreenshotQueueState?: ScreenshotQueueState }
).__auditScreenshotQueueState ??= {
	chain: Promise.resolve(),
	queuedKeys: new Set<string>(),
	activeKeys: new Set<string>(),
	completedKeys: new Set<string>()
});

const STALE_RUNNING_WORKFLOW_MS = Number(process.env.AUDIT_STALE_RUNNING_WORKFLOW_MS || 60 * 1000);
const SCREENSHOT_JOB_TIMEOUT_MS = Number(process.env.AUDIT_SCREENSHOT_JOB_TIMEOUT_MS || 90 * 1000);
const SCREENSHOT_PHASE_TIMEOUT_MS = Number(
	process.env.AUDIT_SCREENSHOT_PHASE_TIMEOUT_MS || 3 * 60 * 1000
);

function timestamp() {
	return new Date().toISOString();
}

function appendLog(existing: string | undefined, message: string) {
	const line = `[${timestamp()}] ${message}`;
	return existing?.trim() ? `${existing}\n${line}` : line;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string) {
	let timeout: NodeJS.Timeout | undefined;
	const timeoutPromise = new Promise<never>((_, reject) => {
		timeout = setTimeout(() => {
			reject(new Error(`${label} timed out after ${timeoutMs}ms`));
		}, timeoutMs);
		timeout.unref?.();
	});

	return Promise.race([promise, timeoutPromise]).finally(() => {
		if (timeout) clearTimeout(timeout);
	});
}

function buildSummary(audit: AuditSummaryResult) {
	return {
		domain: audit.domain,
		auditedAt: audit.auditedAt,
		summary: audit.summary,
		pageSpeed: audit.pageSpeed,
		openPageRank: audit.openPageRank
	};
}

function stripScreenshots(value: unknown): unknown {
	if (!value || typeof value !== 'object') return value;
	if (Array.isArray(value)) return value.map((item) => stripScreenshots(item));

	const source = value as Record<string, unknown>;
	const target: Record<string, unknown> = {};
	for (const [key, nestedValue] of Object.entries(source)) {
		if (key === 'screenshot' || key === 'screenshotRequest') continue;
		target[key] = stripScreenshots(nestedValue);
	}
	return target;
}

function auditJson(audit: AuditSummaryResult) {
	return JSON.stringify(stripScreenshots(audit));
}

function formatAuditError(error: unknown) {
	if (!(error instanceof Error)) {
		return 'Unknown audit failure.';
	}

	const response = (error as Error & { response?: unknown }).response;
	if (response && typeof response === 'object') {
		return `${error.message}: ${JSON.stringify(response)}`;
	}

	return error.message;
}

function formatPocketBaseError(error: unknown) {
	if (!(error instanceof Error)) return String(error);
	const response = (error as Error & { response?: unknown }).response;
	return response ? `${error.message}: ${JSON.stringify(response)}` : error.message;
}

function isUniqueConstraintError(error: unknown) {
	const response = (error as { response?: { status?: number; data?: unknown } })?.response;
	if (response?.status !== 400) return false;
	return JSON.stringify(response.data || '').includes('validation_not_unique');
}

function getRecord(value: unknown): Record<string, unknown> | null {
	return value && typeof value === 'object' && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: null;
}

function getScreenshotRequests(value: unknown): AuditCaptureRequest[] {
	if (Array.isArray(value)) {
		return value.filter((item) => getRecord(item)?.kind).map((item) => item as AuditCaptureRequest);
	}

	const record = getRecord(value);
	return record?.kind ? [record as AuditCaptureRequest] : [];
}

function extractScreenshotFromMeta(metaJson: string) {
	if (!metaJson) {
		return {
			meta_json: metaJson,
			screenshot: null as ScreenshotPayload | null,
			screenshotRequest: null as AuditCaptureRequest | null,
			screenshotRequests: [] as AuditCaptureRequest[]
		};
	}

	try {
		const meta = JSON.parse(metaJson) as Record<string, unknown>;
		const nestedMeta = getRecord(meta.meta);
		const directScreenshot = getRecord(meta.screenshot);
		const nestedScreenshot = getRecord(nestedMeta?.screenshot);
		const screenshotRequests = [
			...getScreenshotRequests(meta.screenshotRequest),
			...getScreenshotRequests(nestedMeta?.screenshotRequest),
			...getScreenshotRequests(meta.screenshotRequests),
			...getScreenshotRequests(nestedMeta?.screenshotRequests)
		];
		const screenshotSource = directScreenshot || nestedScreenshot;
		const screenshot = screenshotSource as ScreenshotPayload | null;

		if (directScreenshot) {
			delete meta.screenshot;
		}
		if (nestedScreenshot && nestedMeta) {
			delete nestedMeta.screenshot;
			meta.meta = nestedMeta;
		}

		if (meta.screenshotRequest) {
			delete meta.screenshotRequest;
		}
		if (meta.screenshotRequests) {
			delete meta.screenshotRequests;
		}
		if (nestedMeta?.screenshotRequest) {
			delete nestedMeta.screenshotRequest;
			meta.meta = nestedMeta;
		}
		if (nestedMeta?.screenshotRequests) {
			delete nestedMeta.screenshotRequests;
			meta.meta = nestedMeta;
		}

		return {
			meta_json: JSON.stringify(meta),
			screenshot:
				screenshot?.contentType && screenshot?.imageBase64
					? {
							contentType: screenshot.contentType,
							imageBase64: screenshot.imageBase64
						}
					: null,
			screenshotRequest: screenshotRequests[0] || null,
			screenshotRequests
		};
	} catch {
		return {
			meta_json: metaJson,
			screenshot: null as ScreenshotPayload | null,
			screenshotRequest: null as AuditCaptureRequest | null,
			screenshotRequests: [] as AuditCaptureRequest[]
		};
	}
}

async function persistScreenshotIfPresent(
	input: {
		auditId: string;
		findingTypeId: string;
		runId: string;
		reportTemplateKey: string;
		title: string;
		page_url?: string;
		screenshot: ScreenshotPayload | null;
	},
	token?: string
) {
	if (!input.screenshot?.contentType || !input.screenshot.imageBase64) return false;

	try {
		await createAuditScreenshotRecord(
			{
				audit: input.auditId,
				audit_finding_type: input.findingTypeId,
				run: input.runId,
				report_template_key: input.reportTemplateKey,
				title: input.title,
				page_url: input.page_url,
				content_type: input.screenshot.contentType,
				image_base64: input.screenshot.imageBase64
			},
			token
		);
		return true;
	} catch (error) {
		if (isUniqueConstraintError(error)) {
			return true;
		}

		console.warn(
			`[audit-runner] screenshot persistence skipped for ${input.title} (${input.screenshot.imageBase64.length} base64 chars): ${formatPocketBaseError(error)}`
		);
		return false;
	}
}

function screenshotJobKey(
	input: Pick<ScreenshotJob, 'auditId' | 'findingTypeId' | 'runId' | 'reportTemplateKey'>
) {
	return `${input.auditId}:${input.findingTypeId}:${input.runId}:${input.reportTemplateKey}`;
}

async function processScreenshotJob(input: ScreenshotJob, token?: string) {
	const key = screenshotJobKey(input);
	if (
		screenshotQueueState.queuedKeys.has(key) ||
		screenshotQueueState.activeKeys.has(key) ||
		screenshotQueueState.completedKeys.has(key)
	) {
		return;
	}

	screenshotQueueState.activeKeys.add(key);
	try {
		const screenshot = await withTimeout(
			runAuditCaptureRequest(input.request),
			SCREENSHOT_JOB_TIMEOUT_MS,
			`Screenshot job for ${input.title}`
		);
		const persisted = await persistScreenshotIfPresent(
			{
				auditId: input.auditId,
				findingTypeId: input.findingTypeId,
				runId: input.runId,
				reportTemplateKey: input.reportTemplateKey,
				title: input.title,
				page_url: input.page_url,
				screenshot
			},
			token
		);
		if (persisted) {
			screenshotQueueState.completedKeys.add(key);
		}
	} catch (error) {
		console.warn(
			`[audit-runner] screenshot job failed for ${input.title}: ${formatPocketBaseError(error)}`
		);
	} finally {
		screenshotQueueState.activeKeys.delete(key);
	}
}

export function hasPendingScreenshotJobs(auditId?: string) {
	const matchesAudit = (key: string) => !auditId || key.startsWith(`${auditId}:`);
	for (const key of screenshotQueueState.queuedKeys) {
		if (matchesAudit(key)) return true;
	}
	for (const key of screenshotQueueState.activeKeys) {
		if (matchesAudit(key)) return true;
	}
	return false;
}

export function clearScreenshotQueueStateForAudit(auditId: string) {
	const matchesAudit = (key: string) => key.startsWith(`${auditId}:`);
	for (const key of screenshotQueueState.queuedKeys) {
		if (matchesAudit(key)) screenshotQueueState.queuedKeys.delete(key);
	}
	for (const key of screenshotQueueState.completedKeys) {
		if (matchesAudit(key)) screenshotQueueState.completedKeys.delete(key);
	}
}

function normalizedPageKey(value: string) {
	try {
		const url = new URL(value);
		url.hash = '';
		url.search = '';
		url.hostname = url.hostname.toLowerCase();
		const pathname = url.pathname.replace(/\/+$/, '') || '/';
		return `${url.protocol}//${url.hostname}${pathname}`;
	} catch {
		return String(value || '')
			.trim()
			.replace(/\/+$/, '');
	}
}

function isValidPageUrl(value: unknown): value is string {
	if (typeof value !== 'string' || !value.trim()) return false;
	try {
		const url = new URL(value);
		return url.protocol === 'http:' || url.protocol === 'https:';
	} catch {
		return false;
	}
}

function isHomepageUrl(value: string) {
	try {
		const url = new URL(value);
		const pathname = url.pathname.replace(/\/+$/, '') || '/';
		return pathname === '/';
	} catch {
		return false;
	}
}

function extractFirstHttpUrl(value: unknown) {
	if (typeof value !== 'string') return '';
	const match = value.match(/https?:\/\/[^\s)]+/);
	if (!match) return '';

	try {
		return new URL(match[0]).href;
	} catch {
		return '';
	}
}

function parseJsonRecord(value: string) {
	try {
		const parsed = JSON.parse(value);
		return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
			? (parsed as Record<string, unknown>)
			: {};
	} catch {
		return {};
	}
}

function homeLast(urls: string[]) {
	return [
		...urls.filter((url) => !isHomepageUrl(url)),
		...urls.filter((url) => isHomepageUrl(url))
	];
}

function uniquePageUrls(values: unknown[]) {
	const seen = new Set<string>();
	const urls: string[] = [];

	for (const value of values) {
		if (!isValidPageUrl(value)) continue;
		const key = normalizedPageKey(value);
		if (seen.has(key)) continue;
		seen.add(key);
		urls.push(value);
	}

	return urls;
}

function uniqueCaptureEntries(entries: CaptureEntry[]) {
	const seen = new Set<string>();
	const result: CaptureEntry[] = [];

	for (const entry of entries) {
		if (!isValidPageUrl(entry.page)) continue;
		const key = JSON.stringify([
			normalizedPageKey(entry.page),
			entry.issue || '',
			entry.value || '',
			entry.image || '',
			entry.property || '',
			entry.pattern || ''
		]);
		if (seen.has(key)) continue;
		seen.add(key);
		result.push(entry);
	}

	return result;
}

function requestEntryPages(request: AuditCaptureRequest) {
	if (
		request.kind === 'headings' ||
		request.kind === 'image-alts' ||
		request.kind === 'meta-tags' ||
		request.kind === 'canonicals' ||
		request.kind === 'internal-links' ||
		request.kind === 'lazy-loading' ||
		request.kind === 'open-graph' ||
		request.kind === 'content-quality' ||
		request.kind === 'shopify-urls'
	) {
		return uniquePageUrls(request.entries.map((entry) => entry.page));
	}

	return [];
}

function requestPageCandidates(request: AuditCaptureRequest) {
	const entryPages = requestEntryPages(request);
	const explicitCandidates = homeLast(
		uniquePageUrls([...(request.captureCandidatePageUrls || []), ...entryPages])
	);
	if (explicitCandidates.length) return explicitCandidates;

	if (request.kind === 'pagespeed') {
		return uniquePageUrls([request.pageUrl]);
	}

	if (request.kind === 'open-page-rank') {
		return uniquePageUrls([request.pageUrl]);
	}

	if (request.kind === 'robots') {
		return homeLast(uniquePageUrls([request.robotsUrl, request.storefrontUrl]));
	}

	return [];
}

function chooseScreenshotPage(candidates: string[], usedPageKeys: Set<string>) {
	return (
		candidates.find(
			(candidate) => !isHomepageUrl(candidate) && !usedPageKeys.has(normalizedPageKey(candidate))
		) ||
		candidates.find((candidate) => !isHomepageUrl(candidate)) ||
		candidates.find((candidate) => !usedPageKeys.has(normalizedPageKey(candidate))) ||
		candidates[0]
	);
}

function screenshotAllocationPriority(request: AuditCaptureRequest) {
	if (requestEntryPages(request).length) return 0;
	if (request.kind === 'pagespeed' || request.kind === 'open-page-rank') return 1;
	return 2;
}

function isCaptureEntry(entry: unknown): entry is CaptureEntry {
	return Boolean(
		entry &&
			typeof entry === 'object' &&
			'page' in entry &&
			typeof (entry as { page?: unknown }).page === 'string'
	);
}

function reorderEntriesBySelectedPage<TRequest extends AuditCaptureRequest>(
	request: TRequest,
	selectedPage: string | undefined
): TRequest {
	if (!selectedPage || !('entries' in request) || !Array.isArray(request.entries)) return request;
	const requestEntries = (request.entries as unknown[]).filter(isCaptureEntry);
	if (!requestEntries.length) return request;
	const selectedKey = normalizedPageKey(selectedPage);
	const candidateEntries = Array.isArray(request.captureCandidateEntries)
		? request.captureCandidateEntries
		: [];
	const selectedCandidate = candidateEntries.find(
		(entry) => normalizedPageKey(entry.page) === selectedKey
	);
	const selectedGroup =
		selectedCandidate && selectedCandidate.value
			? candidateEntries.filter(
					(entry) =>
						entry.issue === selectedCandidate.issue && entry.value === selectedCandidate.value
				)
			: selectedCandidate
				? [selectedCandidate]
				: [];
	const entries = uniqueCaptureEntries([...selectedGroup, ...requestEntries]);

	return {
		...request,
		entries: entries.sort((first, second) => {
			const firstMatches = normalizedPageKey(first.page) === selectedKey;
			const secondMatches = normalizedPageKey(second.page) === selectedKey;
			if (firstMatches === secondMatches) return 0;
			return firstMatches ? -1 : 1;
		})
	};
}

function allocateScreenshotPages(jobs: ScreenshotJob[]) {
	const usedPageKeys = new Set<string>();
	const allocatedJobs = new Map<ScreenshotJob, ScreenshotJob>();
	const allocationOrder = [...jobs].sort(
		(first, second) =>
			screenshotAllocationPriority(first.request) - screenshotAllocationPriority(second.request)
	);

	for (const job of allocationOrder) {
		const candidates = requestPageCandidates(job.request);
		const selectedPage = chooseScreenshotPage(candidates, usedPageKeys);

		if (!selectedPage) {
			allocatedJobs.set(job, job);
			continue;
		}

		const selectedKey = normalizedPageKey(selectedPage);
		usedPageKeys.add(selectedKey);
		const fallbackCapturePageUrls = candidates.filter(
			(candidate) => normalizedPageKey(candidate) !== selectedKey
		);

		const allocatedJob = {
			...job,
			request: reorderEntriesBySelectedPage(
				{
					...job.request,
					capturePageUrl: selectedPage,
					fallbackCapturePageUrls
				},
				selectedPage
			)
		};
		allocatedJobs.set(job, allocatedJob);
	}

	return jobs.map((job) => allocatedJobs.get(job) || job);
}

type NormalizedFinding = ReturnType<typeof buildNormalizedAuditItems>[number]['findings'][number];

function findingMatchesCaptureRequest(request: AuditCaptureRequest, finding: NormalizedFinding) {
	const detail = String(finding.detail || '');
	const templateKey = request.reportTemplateKey || request.kind;

	if (templateKey === 'missing-h1-tags') return detail === 'Missing H1 tag';
	if (templateKey === 'multiple-h1-tags') {
		const normalizedDetail = detail.toLowerCase();
		return normalizedDetail.includes('multiple h1') || normalizedDetail.includes('empty or multiple');
	}
	if (templateKey === 'meta-titles-too-long-unoptimized') {
		return detail === 'Meta title too long' || detail === 'Missing meta title';
	}
	if (templateKey === 'duplicated-page-titles') return detail === 'Duplicate meta title detected';
	if (templateKey === 'duplicated-meta-descriptions') {
		return detail === 'Duplicate meta description detected';
	}
	if (templateKey === 'overly-long-meta-descriptions') {
		return detail === 'Meta description too long';
	}
	if (templateKey === 'images-with-missing-alt-text') return detail === 'Image missing alt text';
	if (templateKey === 'unoptimized-shopify-url-structure') {
		return detail === 'Shopify URL pattern detected';
	}

	const issues =
		'entries' in request && Array.isArray(request.entries)
			? new Set(request.entries.map((entry) => String(entry.issue || '')).filter(Boolean))
			: new Set<string>();

	return issues.size > 0 && issues.has(detail);
}

function pageUrlFromFinding(finding: NormalizedFinding, source: Record<string, unknown>) {
	const sourcePageUrl = typeof source.page_url === 'string' ? source.page_url : '';
	if (isValidPageUrl(sourcePageUrl)) return sourcePageUrl;

	if (isValidPageUrl(finding.page_url)) return finding.page_url;

	const sourceTitleUrl = extractFirstHttpUrl(source.title);
	if (sourceTitleUrl) return sourceTitleUrl;

	return extractFirstHttpUrl(finding.title) || extractFirstHttpUrl(finding.detail);
}

function captureEntryFromFinding(
	request: AuditCaptureRequest,
	finding: NormalizedFinding
): CaptureEntry | null {
	const source = parseJsonRecord(finding.meta_json);
	const nestedMeta = getRecord(source.meta) || {};
	const page = pageUrlFromFinding(finding, source);
	if (!isValidPageUrl(page)) return null;

	const issue = String(source.detail || finding.detail || 'Audit issue');

	if (request.kind === 'image-alts') {
		const image = isValidPageUrl(source.title) ? String(source.title) : finding.page_url;
		return { page, issue, image };
	}

	if (request.kind === 'meta-tags') {
		const value =
			typeof nestedMeta.duplicateValue === 'string'
				? nestedMeta.duplicateValue
				: typeof source.value === 'string'
					? source.value
					: '';
		return value ? { page, issue, value } : { page, issue };
	}

	if (request.kind === 'canonicals') {
		const value = typeof source.title === 'string' ? source.title : '';
		return value && value !== page ? { page, issue, value } : { page, issue };
	}

	if (request.kind === 'internal-links') {
		const countMatch = String(source.title || finding.title || '').match(/\((\d+)\s+links?\)/i);
		return { page, issue, count: countMatch ? Number(countMatch[1]) : undefined };
	}

	if (request.kind === 'content-quality') {
		const countMatch = String(source.title || finding.title || '').match(/\((\d+)\s+words?\)/i);
		return { page, issue, wordCount: countMatch ? Number(countMatch[1]) : undefined };
	}

	if (request.kind === 'shopify-urls') {
		return {
			page,
			issue,
			pattern: '/collections/{collection}/products/{product}'
		};
	}

	if (
		request.kind === 'headings' ||
		request.kind === 'missing-product-schema' ||
		request.kind === 'missing-faq-schema' ||
		request.kind === 'missing-organization-schema' ||
		request.kind === 'unlinked-blog' ||
		request.kind === 'lazy-loading' ||
		request.kind === 'open-graph'
	) {
		return { page, issue };
	}

	return null;
}

function enrichCaptureRequestWithCandidates(
	request: AuditCaptureRequest,
	findings: NormalizedFinding[]
): AuditCaptureRequest {
	if (!('entries' in request) || !Array.isArray(request.entries)) return request;
	const existingEntries = (request.entries as unknown[]).filter(isCaptureEntry);
	if (!existingEntries.length) return request;

	const candidateEntries = uniqueCaptureEntries(
		findings
			.filter((finding) => finding.status === 'warn' || finding.status === 'fail')
			.filter((finding) => findingMatchesCaptureRequest(request, finding))
			.map((finding) => captureEntryFromFinding(request, finding))
			.filter((entry): entry is CaptureEntry => Boolean(entry))
	);
	const existingCandidateEntries = Array.isArray(request.captureCandidateEntries)
		? request.captureCandidateEntries
		: [];
	const captureCandidateEntries = uniqueCaptureEntries([
		...existingCandidateEntries,
		...candidateEntries
	]);
	const captureCandidatePageUrls = homeLast(
		uniquePageUrls([
			...(request.captureCandidatePageUrls || []),
			...captureCandidateEntries.map((entry) => entry.page),
			...existingEntries.map((entry) => entry.page)
		])
	);

	return {
		...request,
		captureCandidatePageUrls,
		captureCandidateEntries
	};
}

function templateFindingTypeKey(template: AuditReportTemplateRecord) {
	return String(template.expand?.audit_finding_type?.key || '');
}

function templateIssueMatcher(pattern: string | undefined) {
	if (!pattern?.trim()) return undefined;

	try {
		const regex = new RegExp(pattern, 'i');
		return (finding: NormalizedFinding) =>
			regex.test(`${finding.title || ''} ${finding.detail || ''}`);
	} catch {
		return undefined;
	}
}

function issueFindingsForTemplate(item: NormalizedAuditItem, template: AuditReportTemplateRecord) {
	const matcher = templateIssueMatcher(template.match_pattern);
	return item.findings.filter((finding) => {
		if (finding.status !== 'warn' && finding.status !== 'fail') return false;
		return matcher ? matcher(finding) : true;
	});
}

function domainFromAuditUrl(audit: AuditSummaryResult, url: string) {
	if (audit.domain) return audit.domain;

	try {
		return new URL(url).hostname;
	} catch {
		return 'this domain';
	}
}

function issueText(finding: NormalizedFinding, fallback: string) {
	return String(finding.detail || finding.title || fallback);
}

function findingPage(finding: NormalizedFinding) {
	return pageUrlFromFinding(finding, parseJsonRecord(finding.meta_json));
}

function findingEntryValue(finding: NormalizedFinding) {
	const source = parseJsonRecord(finding.meta_json);
	const nestedMeta = getRecord(source.meta) || {};
	const candidates = [
		source.value,
		nestedMeta.value,
		nestedMeta.duplicateValue,
		source.duplicateValue,
		source.metaTitle,
		source.metaDescription
	];

	for (const candidate of candidates) {
		if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
	}

	return '';
}

function templateCaptureRequest(
	template: AuditReportTemplateRecord,
	item: NormalizedAuditItem,
	findings: NormalizedFinding[],
	audit: AuditSummaryResult,
	url: string
): AuditCaptureRequest | null {
	const domain = domainFromAuditUrl(audit, url);
	const title = template.title || item.label;
	const reportTemplateKey = template.key;

	if (item.key === 'pageSpeed' && audit.pageSpeed && item.status !== 'pass') {
		return {
			kind: 'pagespeed',
			reportTemplateKey,
			title,
			domain,
			pageUrl: url,
			pageSpeed: audit.pageSpeed as Record<string, unknown>
		};
	}

	if (item.key === 'openPageRank' && audit.openPageRank && item.status !== 'pass') {
		return {
			kind: 'open-page-rank',
			reportTemplateKey,
			title,
			domain,
			pageUrl: url,
			openPageRank: audit.openPageRank as Record<string, unknown>
		};
	}

	if (!findings.length) return null;

	if (item.key === 'missing-h1-tags' || item.key === 'multiple-h1-tags' || item.key === 'h1Tags') {
		const entries = findings
			.map((finding) => {
				const page = findingPage(finding);
				return isValidPageUrl(page) ? { page, issue: issueText(finding, title) } : null;
			})
			.filter((entry): entry is { page: string; issue: string } => Boolean(entry));

		return entries.length
			? {
					kind: 'headings',
					reportTemplateKey,
					title,
					domain,
					entries,
					count: findings.length
				}
			: null;
	}

	if (item.key === 'imageAltTags') {
		const entries = findings
			.map((finding) => {
				const source = parseJsonRecord(finding.meta_json);
				const page = findingPage(finding);
				const image = extractFirstHttpUrl(source.title) || extractFirstHttpUrl(finding.title);
				return isValidPageUrl(page) && image
					? { page, image, issue: issueText(finding, title) }
					: null;
			})
			.filter((entry): entry is { page: string; image: string; issue: string } => Boolean(entry));

		return entries.length
			? {
					kind: 'image-alts',
					reportTemplateKey,
					title,
					domain,
					entries,
					count: findings.length
				}
			: null;
	}

	if (item.key === 'metaTitles') {
		const entries = findings
			.map((finding) => {
				const page = findingPage(finding);
				if (!isValidPageUrl(page)) return null;

				const entry = {
					page,
					issue: issueText(finding, title),
					value: findingEntryValue(finding)
				};
				return entry.value ? entry : { page: entry.page, issue: entry.issue };
			})
			.filter((entry): entry is { page: string; issue: string; value?: string } => Boolean(entry));

		return entries.length
			? {
					kind: 'meta-tags',
					reportTemplateKey,
					title,
					domain,
					entries,
					count: findings.length
				}
			: null;
	}

	if (item.key === 'shopifyUrls') {
		const entries = findings
			.map((finding) => {
				const page = findingPage(finding);
				return isValidPageUrl(page)
					? {
							page,
							issue: issueText(finding, title),
							pattern: '/collections/{collection}/products/{product}'
						}
					: null;
			})
			.filter((entry): entry is { page: string; issue: string; pattern: string } => Boolean(entry));

		return entries.length
			? {
					kind: 'shopify-urls',
					reportTemplateKey,
					title,
					domain,
					entries,
					count: findings.length
				}
			: null;
	}

	if (
		item.key === 'missing-product-schema' ||
		item.key === 'missing-faq-schema' ||
		item.key === 'missing-organization-schema' ||
		item.key === 'unlinked-blog'
	) {
		const entries = findings
			.map((finding) => {
				const page = findingPage(finding);
				return isValidPageUrl(page) ? { page, issue: issueText(finding, title) } : null;
			})
			.filter((entry): entry is { page: string; issue: string } => Boolean(entry));

		return entries.length
			? {
					kind: item.key,
					reportTemplateKey,
					title,
					domain,
					entries,
					count: findings.length
				}
			: null;
	}

	if (item.key === 'robotsTxt') {
		const manualRequest = findings
			.map((finding) => extractScreenshotFromMeta(finding.meta_json).screenshotRequests)
			.flat()
			.find((request) => request.reportTemplateKey === reportTemplateKey);
		return manualRequest || null;
	}

	return null;
}

const STEP_KEYS: Record<string, string[]> = {
	crawl: [],
	homepage: [
		'structuredData',
		'missing-organization-schema',
		'webIcons',
		'ssl',
		'mobileUsability',
		'flash',
		'charset',
		'loremIpsum',
		'openGraph',
		'internationalDomains',
		'trustSignals',
		'lazyLoadImages',
		'unlinked-blog'
	],
	robots: ['robotsTxt'],
	sitemap: ['sitemap'],
	'page-analysis': [
		'missing-h1-tags',
		'multiple-h1-tags',
		'missing-product-schema',
		'missing-faq-schema',
		'metaTitles',
		'imageAltTags',
		'canonicalUrls',
		'internalLinks',
		'contentQuality',
		'shopifyUrls'
	],
	pagespeed: ['pageSpeed'],
	openpagerank: ['openPageRank']
};

type RunRegistry = Map<
	string,
	{
		runId: string;
		findingTypeId: string;
		label: string;
		sortOrder: number;
	}
>;

async function bootstrapRuns(workflowId: string, token?: string) {
	const registry: RunRegistry = new Map();

	for (const definition of getNormalizedSectionDefinitions()) {
		const findingType = await getOrCreateAuditFindingTypeRecord(definition, token);
		const run = await getOrCreateRunRecord(
			{
				workflow: workflowId,
				audit_finding_type: findingType.id,
				status: 'queued',
				started_at: timestamp(),
				run_log: appendLog('', `${definition.label} queued.`),
				sort_order: definition.sort_order
			},
			token
		);
		registry.set(definition.key, {
			runId: run.id,
			findingTypeId: findingType.id,
			label: definition.label,
			sortOrder: definition.sort_order
		});
	}

	return registry;
}

async function markStepRunning(runRegistry: RunRegistry, stepLabel: string, token?: string) {
	for (const key of STEP_KEYS[stepLabel] || []) {
		const entry = runRegistry.get(key);
		if (!entry) continue;
		await updateRunRecord(
			entry.runId,
			{
				status: 'running',
				started_at: timestamp(),
				error_message: '',
				run_log: appendLog('', `${entry.label} running.`)
			},
			token
		);
	}
}

async function syncProgressSnapshot(
	auditId: string,
	url: string,
	partialAudit: AuditSummaryResult,
	runRegistry: RunRegistry,
	keysToSync?: Iterable<string>,
	token?: string
) {
	const keySet = keysToSync ? new Set(keysToSync) : null;
	attachMetricScreenshots(partialAudit, url, keySet || ['pageSpeed', 'openPageRank']);
	const normalizedItems = buildNormalizedAuditItems(partialAudit).filter(
		(item) => !keySet || keySet.has(item.key)
	);
	for (const item of normalizedItems) {
		const run = runRegistry.get(item.key);
		if (!run) continue;

		await deleteAuditFindingsByRunId(run.runId, token);

		if (item.findings.length === 0) {
			const { meta_json, screenshot } = extractScreenshotFromMeta(item.stats_json);
			await persistScreenshotIfPresent(
				{
					auditId,
					findingTypeId: run.findingTypeId,
					runId: run.runId,
					reportTemplateKey: item.key,
					title: item.label,
					screenshot
				},
				token
			);
			await createAuditFindingRecord(
				{
					audit: auditId,
					audit_finding_type: run.findingTypeId,
					run: run.runId,
					status: item.status,
					title: item.label,
					detail: item.summary,
					meta_json
				},
				token
			);
		} else {
			for (const finding of item.findings) {
				const { meta_json, screenshot } = extractScreenshotFromMeta(finding.meta_json);
				await persistScreenshotIfPresent(
					{
						auditId,
						findingTypeId: run.findingTypeId,
						runId: run.runId,
						reportTemplateKey: item.key,
						title: finding.detail || finding.title || item.label,
						page_url: finding.page_url,
						screenshot
					},
					token
				);
				await createAuditFindingRecord(
					{
						audit: auditId,
						audit_finding_type: run.findingTypeId,
						run: run.runId,
						status: finding.status,
						title: finding.title,
						detail: finding.detail,
						page_url: finding.page_url,
						meta_json
					},
					token
				);
			}
		}

		await updateRunRecord(
			run.runId,
			{
				status: 'completed',
				completed_at: timestamp(),
				error_message: '',
				run_log: item.summary
			},
			token
		);
	}

	await updateAuditRecord(
		auditId,
		{
			audit_json: auditJson(partialAudit),
			summary_json: JSON.stringify(buildSummary(partialAudit))
		},
		token
	);
}

function collectScreenshotJobs(
	auditId: string,
	url: string,
	audit: AuditSummaryResult,
	runRegistry: RunRegistry,
	templates: AuditReportTemplateRecord[] = []
) {
	attachMetricScreenshots(audit, url, ['pageSpeed', 'openPageRank']);

	const jobs: ScreenshotJob[] = [];
	const seen = new Set<string>();
	const normalizedItems = buildNormalizedAuditItems(audit);
	const templatesByFindingTypeKey = templates.reduce((map, template) => {
		const key = templateFindingTypeKey(template);
		if (!key) return map;
		const existing = map.get(key) || [];
		existing.push(template);
		map.set(key, existing);
		return map;
	}, new Map<string, AuditReportTemplateRecord[]>());

	for (const item of normalizedItems) {
		const run = runRegistry.get(item.key);
		if (!run) continue;

		const addJob = (
			request: AuditCaptureRequest | null,
			title: string,
			page_url?: string,
			findings: NormalizedFinding[] = item.findings
		) => {
			if (!request) return;
			const enrichedRequest = enrichCaptureRequestWithCandidates(request, findings);
			const reportTemplateKey = enrichedRequest.reportTemplateKey || enrichedRequest.kind;
			const key = screenshotJobKey({
				auditId,
				findingTypeId: run.findingTypeId,
				runId: run.runId,
				reportTemplateKey
			});
			if (seen.has(key)) return;
			seen.add(key);
			jobs.push({
				auditId,
				findingTypeId: run.findingTypeId,
				runId: run.runId,
				reportTemplateKey,
				title,
				page_url,
				request: enrichedRequest
			});
		};

		if (item.findings.length === 0) {
			const { screenshotRequests } = extractScreenshotFromMeta(item.stats_json);
			for (const screenshotRequest of screenshotRequests) {
				addJob(screenshotRequest, screenshotRequest.title || item.label);
			}
			continue;
		}

		for (const finding of item.findings) {
			const { screenshotRequests } = extractScreenshotFromMeta(finding.meta_json);
			for (const screenshotRequest of screenshotRequests) {
				const source = parseJsonRecord(finding.meta_json);
				addJob(
					screenshotRequest,
					screenshotRequest.title || finding.detail || finding.title || item.label,
					pageUrlFromFinding(finding, source),
					item.findings
				);
			}
		}

		for (const template of templatesByFindingTypeKey.get(item.key) || []) {
			const findings = issueFindingsForTemplate(item, template);
			const request = templateCaptureRequest(template, item, findings, audit, url);
			addJob(
				request,
				template.title || item.label,
				findings[0] ? findingPage(findings[0]) : url,
				findings.length ? findings : item.findings
			);
		}
	}

	return allocateScreenshotPages(jobs);
}

async function processAuditScreenshots(
	auditId: string,
	url: string,
	audit: AuditSummaryResult,
	runRegistry: RunRegistry,
	token?: string
) {
	const templates = await listAuditReportTemplates(token);
	const jobs = collectScreenshotJobs(auditId, url, audit, runRegistry, templates);
	for (const job of jobs) {
		await processScreenshotJob(job, token);
	}
}

async function finalizeUnsyncedRuns(
	runRegistry: RunRegistry,
	partialAudit: AuditSummaryResult,
	token?: string
) {
	const completedKeys = new Set(buildNormalizedAuditItems(partialAudit).map((item) => item.key));
	for (const [key, run] of runRegistry.entries()) {
		if (completedKeys.has(key)) continue;
		await updateRunRecord(
			run.runId,
			{
				status: 'completed',
				completed_at: timestamp(),
				error_message: '',
				run_log: `${run.label} did not produce persisted results in the current engine.`
			},
			token
		);
	}
}

async function processAuditWorkflow({ workflowId, auditId, url, token }: QueuePayload) {
	let runLog = '';
	try {
		const workflowRecord = await getWorkflow(workflowId, token);
		runLog = appendLog(workflowRecord.run_log, 'Workflow started.');
		const runRegistry = await bootstrapRuns(workflowId, token);

		await updateWorkflowRecord(
			workflowId,
			{
				status: 'running',
				started_at: timestamp(),
				error_message: '',
				run_log: runLog
			},
			token
		);
		await updateAuditRecord(auditId, { status: 'running' }, token);

		const audit = await runAudit(url, {
			onStepStart: async (stepLabel: string) => {
				runLog = appendLog(runLog, `${stepLabel} started.`);
				await updateWorkflowRecord(workflowId, { run_log: runLog }, token);
				await markStepRunning(runRegistry, stepLabel, token);
			},
			onStepComplete: async (stepLabel: string, partialAudit: AuditSummaryResult) => {
				runLog = appendLog(runLog, `${stepLabel} completed.`);
				await updateWorkflowRecord(workflowId, { run_log: runLog }, token);
				await syncProgressSnapshot(
					auditId,
					url,
					partialAudit,
					runRegistry,
					STEP_KEYS[stepLabel] || [],
					token
				);
			}
		});
		runLog = appendLog(runLog, 'Audit engine completed successfully.');
		const completedAt = timestamp();
		await syncProgressSnapshot(auditId, url, audit, runRegistry, undefined, token);
		await finalizeUnsyncedRuns(runRegistry, audit, token);
		runLog = appendLog(runLog, 'Screenshot generation started.');
		await updateWorkflowRecord(workflowId, { run_log: runLog }, token);
		try {
			await withTimeout(
				processAuditScreenshots(auditId, url, audit, runRegistry, token),
				SCREENSHOT_PHASE_TIMEOUT_MS,
				'Screenshot generation'
			);
			runLog = appendLog(runLog, 'Screenshot generation completed.');
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			runLog = appendLog(runLog, `Screenshot generation skipped: ${message}`);
		}

		await updateAuditRecord(
			auditId,
			{
				status: 'completed',
				audit_json: auditJson(audit),
				summary_json: JSON.stringify(buildSummary(audit)),
				completed_at: completedAt
			},
			token
		);
		await updateWorkflowRecord(
			workflowId,
			{
				status: 'completed',
				completed_at: completedAt,
				run_log: runLog,
				error_message: ''
			},
			token
		);
	} catch (error) {
		const message = formatAuditError(error);
		runLog = appendLog(runLog, `Workflow failed: ${message}`);

		const failedAt = timestamp();
		const updates = await Promise.allSettled([
			updateAuditRecord(auditId, { status: 'failed' }, token),
			updateWorkflowRecord(
				workflowId,
				{
					status: 'failed',
					completed_at: failedAt,
					error_message: message,
					run_log: runLog
				},
				token
			)
		]);

		for (const update of updates) {
			if (update.status === 'rejected') {
				console.error(
					`[audit-runner] failed to persist failure state for ${workflowId}:`,
					formatPocketBaseError(update.reason)
				);
			}
		}
	}
}

export function queueAuditWorkflow(payload: QueuePayload) {
	if (state.activeWorkflows.has(payload.workflowId)) {
		return;
	}

	state.activeWorkflows.add(payload.workflowId);

	void processAuditWorkflow(payload)
		.catch((error) => {
			console.error(
				`[audit-runner] ${payload.workflowId} failed:`,
				error instanceof Error ? error.message : error
			);
		})
		.finally(() => {
			state.activeWorkflows.delete(payload.workflowId);
		});
}

export function ensureAuditWorkflowProcessing(record: WorkflowRecordLike, token?: string) {
	if (!record?.id) {
		return;
	}

	const status = String(record.status || '');
	if (state.activeWorkflows.has(record.id)) {
		return;
	}

	if (status === 'running') {
		const startedAtMs = record.started_at ? Date.parse(record.started_at) : 0;
		const isStale =
			!Number.isFinite(startedAtMs) || Date.now() - startedAtMs > STALE_RUNNING_WORKFLOW_MS;
		if (!isStale) {
			return;
		}
	} else if (status !== 'queued') {
		return;
	}

	const auditId = record.audit || record.expand?.audit?.id;
	const url = record.expand?.audit?.expand?.website?.url;
	if (!auditId || !url) {
		return;
	}

	queueAuditWorkflow({
		workflowId: record.id,
		auditId,
		url,
		token
	});
}
