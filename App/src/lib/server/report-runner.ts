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

function escapeHtml(value: unknown) {
	return String(value ?? '')
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

function reportScreenshotBlock(pageData: Awaited<ReturnType<typeof buildAuditPageData>>) {
	const screenshots = pageData.normalizedItems
		.map((item) => ({
			id: item.screenshot?.id || '',
			key: item.key,
			label: item.label,
			status: item.status,
			title: item.screenshot?.title || `${item.label} evidence`,
			pageUrl: item.screenshot?.page_url || '',
			imageUrl: item.screenshot?.image_url || ''
		}))
		.filter((screenshot) => screenshot.imageUrl);

	if (!screenshots.length) return '';

	const cards = screenshots
		.map((screenshot) => {
			const imageUrl = screenshot.id
				? `/api/audits/${encodeURIComponent(pageData.auditId)}/screenshots/${encodeURIComponent(
						screenshot.id
					)}/image`
				: screenshot.imageUrl;
			const pageLink = screenshot.pageUrl
				? `<a href="${escapeHtml(screenshot.pageUrl)}" style="color:#2563eb; text-decoration:none; overflow-wrap:anywhere;">${escapeHtml(screenshot.pageUrl)}</a>`
				: '';

			return `<div style="background:#ffffff; border:1px solid #e5e7eb; border-radius:8px; padding:18px; margin:0 0 22px 0; page-break-inside:avoid;">
  <div style="font-size:0.78rem; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:#6b7280; margin-bottom:6px;">${escapeHtml(screenshot.label)}</div>
  <h3 style="font-size:1.05rem; line-height:1.35; color:#111827; margin:0 0 8px 0;">${escapeHtml(screenshot.title)}</h3>
  ${pageLink ? `<div style="font-size:0.86rem; line-height:1.5; margin:0 0 12px 0;">${pageLink}</div>` : ''}
  <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(screenshot.title)}" style="display:block; width:100%; max-width:680px; height:auto; border:1px solid #d1d5db; border-radius:6px; margin:0;" />
</div>`;
		})
		.join('');

	return `<section data-report-evidence-screenshots="true" style="margin-top:32px; padding-top:24px; border-top:2px solid #e5e7eb;">
  <h2 style="font-size:1.6rem; line-height:1.25; color:#111827; margin:0 0 10px 0;">Evidence Screenshots</h2>
  <p style="font-size:0.95rem; line-height:1.7; color:#4b5563; margin:0 0 18px 0;">The screenshots below capture the exact audit overlay evidence generated during the crawl, including the affected pages and issue context used in this report.</p>
  ${cards}
</section>`;
}

function appendReportScreenshots(
	reportHtml: string,
	pageData: Awaited<ReturnType<typeof buildAuditPageData>>
) {
	const screenshotBlock = reportScreenshotBlock(pageData);
	if (!screenshotBlock) return reportHtml;
	return `${reportHtml}\n${screenshotBlock}`;
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
			stats: getSectionStats(pageData.audit, key, displayText(item?.summary)),
			screenshot: item?.screenshot
				? {
						title: item.screenshot.title || '',
						pageUrl: item.screenshot.page_url || ''
					}
				: null
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
