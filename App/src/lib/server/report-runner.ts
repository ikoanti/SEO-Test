import { buildAuditPageData } from '$lib/server/audit-detail';
import { generateReportHtml } from '$lib/server/legacy-api';
import { getAudit, updateAuditRecord } from '$lib/server/pocketbase';

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

function getSectionStats(audit: Record<string, unknown> | null, key: string, fallback: string) {
	const section = getRecord(audit?.[key]);
	return displayText(section.stats, fallback);
}

function findingToReportItem(finding: Record<string, unknown>) {
	const meta = getRecord(finding.meta);
	const primary =
		displayText(finding.detail) || displayText(finding.title) || displayText(finding.page_url);

	return {
		status: toLegacyStatus(finding.status),
		detail: primary,
		title: displayText(finding.title),
		url: displayText(finding.page_url),
		meta: Object.keys(meta).length ? meta : null
	};
}

function buildLegacyReportAuditData(pageData: Awaited<ReturnType<typeof buildAuditPageData>>) {
	const payload: Record<string, unknown> = {};
	const summary = getRecord(pageData.summary?.summary);
	const audit = getRecord(pageData.audit);
	const itemsByKey = new Map(pageData.normalizedItems.map((item) => [item.key, item]));

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
		const item = itemsByKey.get(key);
		payload[key] = {
			items: (item?.findings || []).map((finding) => findingToReportItem(finding)),
			stats: getSectionStats(pageData.audit, key, displayText(item?.summary))
		};
	}

	const robotsItem = itemsByKey.get('robotsTxt');
	const aiItem = itemsByKey.get('aiVisibility');
	payload.robotsTxt = {
		items: [...(robotsItem?.findings || []), ...(aiItem?.findings || [])].map((finding) =>
			findingToReportItem(finding)
		),
		stats: [
			getSectionStats(pageData.audit, 'robotsTxt', displayText(robotsItem?.summary)),
			getSectionStats(pageData.audit, 'aiVisibility', displayText(aiItem?.summary))
		]
			.filter(Boolean)
			.join(' | ')
	};

	const internalLinks = getRecord(payload.internalLinks);
	payload.internalLinks = {
		...internalLinks,
		totalLinks: displayText(getRecord(audit.internalLinks).totalLinks, '0'),
		brokenLinks: displayText(getRecord(audit.internalLinks).brokenLinks, '0')
	};

	payload.aiVisibility = {
		score: displayText(pageData.aiVisibility?.aiVisibility, '-'),
		monthlyAudience: displayText(pageData.aiVisibility?.monthlyAudience, '-'),
		mentions: displayText(pageData.aiVisibility?.mentions, '-'),
		citedPages: displayText(pageData.aiVisibility?.citedPages, '-'),
		performingTopics: displayText(pageData.aiVisibility?.performingTopics, '-'),
		topicOpportunities: displayText(pageData.aiVisibility?.topicOpportunities, '-'),
		citedSources: displayText(pageData.aiVisibility?.citedSources, '-'),
		sourceOpportunities: displayText(pageData.aiVisibility?.sourceOpportunities, '-')
	};

	return payload;
}

async function processReportGeneration(auditId: string, token?: string) {
	const auditRecord = await getAudit(auditId, token);
	const website = (auditRecord.expand as { website?: { url?: string } } | undefined)?.website;
	const pageData = await buildAuditPageData(auditId, token);
	const audit = auditRecord.audit_json ? JSON.parse(auditRecord.audit_json) : null;

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
		const reportHtml = await generateReportHtml(audit.domain || website?.url || '', reportData);
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
