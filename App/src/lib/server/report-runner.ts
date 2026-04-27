import { buildAuditPageData } from '$lib/server/audit-detail';
import { generateReportHtml } from '$lib/server/legacy-api';
import { getAudit, updateAuditRecord } from '$lib/server/pocketbase';
import { appendReportScreenshots } from '$lib/server/report-screenshots';

type ReportRunnerState = {
	activeAudits: Set<string>;
};

const state = ((
	globalThis as typeof globalThis & { __reportRunnerState?: ReportRunnerState }
).__reportRunnerState ??= {
	activeAudits: new Set<string>()
});

function timestamp() {
	return new Date().toISOString();
}

function formatReportError(error: unknown) {
	return error instanceof Error ? error.message : 'Failed to generate report.';
}

const reportSectionKeys = [
	'h1Tags',
	'metaTitles',
	'imageAltTags',
	'canonicalUrls',
	'internalLinks',
	'sitemap',
	'llmsTxt',
	'structuredData',
	'security',
	'mixedContent',
	'contentQuality',
	'webIcons',
	'ssl',
	'mobileUsability',
	'flash',
	'charset',
	'loremIpsum',
	'openGraph',
	'shopifyUrls',
	'internationalDomains',
	'trailingSlash',
	'wwwResolve',
	'trustSignals',
	'tapTargets',
	'lazyLoadImages'
] as const;

function getRecord(value: unknown): Record<string, unknown> {
	return value && typeof value === 'object' && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: {};
}

function displayText(value: unknown, fallback = '') {
	if (value === undefined || value === null) return fallback;
	const text = String(value).trim();
	return text || fallback;
}

function toLegacyStatus(status: unknown) {
	switch (String(status || '')) {
		case 'pass':
			return 'ok';
		case 'warn':
			return 'warn';
		case 'fail':
			return 'err';
		default:
			return 'info';
	}
}

function toLegacyAuditValue(value: unknown): unknown {
	if (Array.isArray(value)) {
		return value.map((item) => toLegacyAuditValue(item));
	}

	if (!value || typeof value !== 'object') {
		return value;
	}

	const source = value as Record<string, unknown>;
	const target: Record<string, unknown> = {};
	for (const [key, nestedValue] of Object.entries(source)) {
		if (key === 'screenshot' || key === 'screenshotRequest') continue;
		target[key] = key === 'status' ? toLegacyStatus(nestedValue) : toLegacyAuditValue(nestedValue);
	}
	return target;
}

function buildLegacyReportAuditData(pageData: Awaited<ReturnType<typeof buildAuditPageData>>) {
	const audit = getRecord(pageData.audit);
	const payload = toLegacyAuditValue(audit) as Record<string, unknown>;
	const summary = getRecord(pageData.summary?.summary);

	payload.summary = {
		passed: Number(summary.passed || 0),
		warnings: Number(summary.warnings || 0),
		failed: Number(summary.failed || 0)
	};

	payload.pageSpeed = {
		mobile: getRecord(getRecord(audit.pageSpeed).mobile),
		desktop: getRecord(getRecord(audit.pageSpeed).desktop)
	};

	payload.openPageRank = {
		pageRank: displayText(getRecord(audit.openPageRank).pageRank, 'N/A'),
		globalRank: displayText(getRecord(audit.openPageRank).globalRank, 'N/A')
	};

	for (const key of reportSectionKeys) {
		const section = getRecord(payload[key]);
		if (!payload[key]) payload[key] = { items: [], stats: '' };
		else payload[key] = section;
	}

	const internalLinks = getRecord(payload.internalLinks);
	payload.internalLinks = {
		...internalLinks,
		totalLinks: displayText(getRecord(audit.internalLinks).totalLinks, '0'),
		brokenLinks: displayText(getRecord(audit.internalLinks).brokenLinks, '0')
	};

	const currentAiVisibility = getRecord(payload.aiVisibility);
	payload.aiVisibility = {
		...currentAiVisibility,
		score: displayText(pageData.aiVisibility?.aiVisibility ?? currentAiVisibility.score, '-'),
		monthlyAudience: displayText(
			pageData.aiVisibility?.monthlyAudience ?? currentAiVisibility.monthlyAudience,
			'-'
		),
		mentions: displayText(pageData.aiVisibility?.mentions ?? currentAiVisibility.mentions, '-'),
		citedPages: displayText(
			pageData.aiVisibility?.citedPages ?? currentAiVisibility.citedPages,
			'-'
		),
		performingTopics: displayText(
			pageData.aiVisibility?.performingTopics ?? currentAiVisibility.performingTopics,
			'-'
		),
		topicOpportunities: displayText(
			pageData.aiVisibility?.topicOpportunities ?? currentAiVisibility.topicOpportunities,
			'-'
		),
		citedSources: displayText(
			pageData.aiVisibility?.citedSources ?? currentAiVisibility.citedSources,
			'-'
		),
		sourceOpportunities: displayText(
			pageData.aiVisibility?.sourceOpportunities ?? currentAiVisibility.sourceOpportunities,
			'-'
		)
	};

	return payload;
}

async function processReportGeneration(auditId: string, token?: string) {
	const auditRecord = await getAudit(auditId, token);
	const website = (auditRecord.expand as { website?: { url?: string } } | undefined)?.website;
	const pageData = await buildAuditPageData(auditId, token);
	const audit = pageData.audit;

	if (String(auditRecord.status || '') !== 'completed') {
		await updateAuditRecord(
			auditId,
			{
				report_status: 'failed',
				report_error: 'Audit must be completed before report generation can run.',
				report_completed_at: timestamp()
			},
			token
		);
		return;
	}

	if (!audit) {
		await updateAuditRecord(
			auditId,
			{
				report_status: 'failed',
				report_error: 'Stored audit JSON is missing.',
				report_completed_at: timestamp()
			},
			token
		);
		return;
	}

	await updateAuditRecord(
		auditId,
		{
			report_status: 'running',
			report_error: '',
			report_started_at: timestamp(),
			report_completed_at: null
		},
		token
	);

	try {
		const reportData = buildLegacyReportAuditData(pageData);
		const generatedReportHtml = await generateReportHtml(
			audit.domain || website?.url || '',
			reportData
		);
		const reportHtml = appendReportScreenshots(generatedReportHtml, pageData);
		await updateAuditRecord(
			auditId,
			{
				report_status: 'completed',
				report_error: '',
				report_html: reportHtml,
				report_completed_at: timestamp()
			},
			token
		);
	} catch (error) {
		await updateAuditRecord(
			auditId,
			{
				report_status: 'failed',
				report_error: formatReportError(error),
				report_completed_at: timestamp()
			},
			token
		);
	}
}

export function queueReportGeneration(auditId: string, token?: string) {
	if (state.activeAudits.has(auditId)) return;
	state.activeAudits.add(auditId);

	void processReportGeneration(auditId, token).finally(() => {
		state.activeAudits.delete(auditId);
	});
}

export function ensureReportGenerationProcessing(
	auditRecord: { id?: string; report_status?: string } | null | undefined,
	token?: string
) {
	if (!auditRecord?.id) return;
	if (!['queued', 'running'].includes(String(auditRecord.report_status || ''))) return;
	queueReportGeneration(auditRecord.id, token);
}
