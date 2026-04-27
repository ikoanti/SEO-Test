import type { buildAuditPageData } from '$lib/server/audit-detail';
import type { AuditReportTemplateRecord } from '$lib/server/pocketbase';

type AuditPageData = Awaited<ReturnType<typeof buildAuditPageData>>;
type ReportPageData = {
	auditId: string;
	runRecord: {
		url?: string;
		name?: string;
		[key: string]: unknown;
	};
	auditRecord: {
		name?: string;
		url?: string;
		[key: string]: unknown;
	} | null;
	audit: Record<string, unknown> | null;
	summary: {
		domain?: string;
		summary?: { passed?: number; warnings?: number; failed?: number };
		[key: string]: unknown;
	} | null;
	aiVisibility: Record<string, unknown> | null;
	normalizedItems: Array<{
		id?: string;
		key: string;
		label: string;
		status?: string;
		sortOrder?: number;
		screenshot?: {
			id?: string;
			title?: string;
			page_url?: string;
			image_url?: string;
		} | null;
		findings: Array<{
			id?: string;
			status?: string;
			title?: string;
			detail?: string;
			page_url?: string;
			meta?: Record<string, unknown> | null;
		}>;
	}>;
};
type AuditItem = ReportPageData['normalizedItems'][number];
type Finding = AuditItem['findings'][number];

export type ReportProblemPreview = {
	key: string;
	title: string;
	sourceFindingTypeKey: string;
	sourceLabel: string;
	sortOrder: number;
	status: 'pass' | 'warn' | 'fail' | 'info';
	priority: 'Urgent' | 'High' | 'Medium';
	paragraphs: string[];
	screenshot?: AuditItem['screenshot'];
	findings: Finding[];
	count: number;
};

type TemplateContext = Record<string, string | number>;

function escapeHtml(value: unknown) {
	return String(value ?? '')
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#039;');
}

function getRecord(value: unknown): Record<string, unknown> {
	return value && typeof value === 'object' && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: {};
}

function text(value: unknown, fallback = '') {
	const raw = String(value ?? '').trim();
	return raw || fallback;
}

function metricNumber(value: unknown) {
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : null;
}

function domainName(pageData: ReportPageData) {
	const summary = getRecord(pageData.summary);
	return text(
		summary.domain ||
			pageData.auditRecord?.name ||
			pageData.auditRecord?.url ||
			pageData.runRecord.url,
		'this website'
	);
}

function issueFindings(item: AuditItem | undefined) {
	return (item?.findings || []).filter(
		(finding) => finding.status === 'warn' || finding.status === 'fail'
	);
}

function issueMatcher(pattern: string | undefined) {
	if (!pattern?.trim()) return undefined;

	try {
		const regex = new RegExp(pattern, 'i');
		return (finding: Finding) => regex.test(`${finding.title || ''} ${finding.detail || ''}`);
	} catch {
		return undefined;
	}
}

function interpolate(template: string, context: TemplateContext) {
	return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) =>
		String(context[key] ?? '')
	);
}

function paragraphs(templateBody: string, context: TemplateContext) {
	return interpolate(templateBody, context)
		.split(/\n{2,}/)
		.map((paragraph) => paragraph.trim())
		.filter(Boolean);
}

function problemHtml(problem: ReportProblemPreview, index: number) {
	const screenshotHtml = problem.screenshot?.image_url
		? `<div style="margin:14px 0 4px 0; page-break-inside:avoid;">
  <img src="${escapeHtml(problem.screenshot.image_url)}" alt="${escapeHtml(problem.screenshot.title || `${problem.title} screenshot`)}" style="display:block; width:100%; max-width:680px; height:auto; border:1px solid #d1d5db; border-radius:6px; margin:0;" />
</div>`
		: '';

	return `<div style="margin:0 0 18px 0; page-break-inside:avoid;">
  <h3 style="font-family:Arial, sans-serif; font-size:14pt; line-height:1.25; color:#111827; margin:0 0 3px 0; font-weight:700;">Problem ${index}: ${escapeHtml(problem.title)}</h3>
  <p style="font-family:Arial, sans-serif; font-size:10pt; line-height:1.4; color:#6b7280; margin:0 0 8px 0; font-weight:700;">Priority: ${escapeHtml(problem.priority)}</p>
  ${problem.paragraphs
		.map(
			(paragraph) =>
				`<p style="font-family:Arial, sans-serif; font-size:10.5pt; line-height:1.55; color:#111827; margin:0 0 10px 0;">${escapeHtml(paragraph)}</p>`
		)
		.join('')}
  ${screenshotHtml}
</div>`;
}

function baseContext(pageData: ReportPageData): TemplateContext {
	const domain = domainName(pageData);
	const audit = getRecord(pageData.audit);
	const pageSpeed = getRecord(audit.pageSpeed);
	const mobile = getRecord(pageSpeed.mobile);
	const desktop = getRecord(pageSpeed.desktop);
	const mobileScore = metricNumber(mobile.score);
	const desktopScore = metricNumber(desktop.score);
	const scoreValues = [mobileScore, desktopScore].filter(
		(score): score is number => score !== null
	);
	const worstScore = scoreValues.length ? [...scoreValues].sort((a, b) => a - b)[0] : 'N/A';
	const aiScore = text(
		pageData.aiVisibility?.aiVisibility || getRecord(audit.aiVisibility).score,
		'-'
	);

	return {
		domain,
		mobileScore: text(mobile.score, 'N/A'),
		desktopScore: text(desktop.score, 'N/A'),
		worstScore,
		aiScore
	};
}

function shouldIncludeMetricTemplate(
	template: AuditReportTemplateRecord,
	item: AuditItem | undefined,
	context: TemplateContext
) {
	const findingTypeKey = template.expand?.audit_finding_type?.key;

	if (findingTypeKey === 'pageSpeed') {
		const worstScore = Number(context.worstScore);
		return Number.isFinite(worstScore) && worstScore < 90;
	}

	if (findingTypeKey === 'aiVisibility') {
		return text(context.aiScore, '-') !== '-';
	}

	return item?.status === 'warn' || item?.status === 'fail';
}

function isDisplayStatus(value: unknown): value is ReportProblemPreview['status'] {
	return value === 'pass' || value === 'warn' || value === 'fail' || value === 'info';
}

function statusFromFindings(
	findings: Finding[],
	item: AuditItem | undefined
): ReportProblemPreview['status'] {
	if (findings.some((finding) => finding.status === 'fail')) return 'fail';
	if (findings.some((finding) => finding.status === 'warn')) return 'warn';
	if (findings.some((finding) => finding.status === 'pass')) return 'pass';
	if (isDisplayStatus(item?.status)) {
		return item.status;
	}
	return 'info';
}

const PRIORITY_RANK: Record<ReportProblemPreview['priority'], number> = {
	Urgent: 0,
	High: 1,
	Medium: 2
};

function priorityRank(priority: ReportProblemPreview['priority']) {
	return PRIORITY_RANK[priority] ?? 99;
}

function sortReportProblems(problems: ReportProblemPreview[]) {
	return problems.sort(
		(first, second) =>
			priorityRank(first.priority) - priorityRank(second.priority) ||
			(first.sortOrder || 999) - (second.sortOrder || 999) ||
			first.title.localeCompare(second.title)
	);
}

export function buildReportProblems(
	pageData: ReportPageData,
	templates: AuditReportTemplateRecord[]
) {
	const itemsByKey = new Map(pageData.normalizedItems.map((item) => [item.key, item]));
	const sharedContext = baseContext(pageData);
	const problems: ReportProblemPreview[] = [];

	for (const template of templates) {
		const findingTypeKey = template.expand?.audit_finding_type?.key || '';
		const item = itemsByKey.get(findingTypeKey);
		const matcher = issueMatcher(template.match_pattern);
		const findings = issueFindings(item).filter((finding) => !matcher || matcher(finding));

		if (!findings.length && !shouldIncludeMetricTemplate(template, item, sharedContext)) continue;

		const affectedUrls = findings
			.map((finding) => text(finding.page_url || finding.title))
			.filter(Boolean);
		const context: TemplateContext = {
			...sharedContext,
			count: findings.length || 1,
			affectedPages: affectedUrls.length ? affectedUrls.join(', ') : 'N/A',
			affectedImages: findings.length || 0
		};

		problems.push({
			key: template.key,
			title: template.title,
			sourceFindingTypeKey: findingTypeKey,
			sourceLabel: item?.label || template.title,
			sortOrder: template.sort_order || item?.sortOrder || 999,
			status: statusFromFindings(findings, item),
			priority: template.priority || 'Medium',
			paragraphs: paragraphs(template.template_body || '', context),
			screenshot: item?.screenshot,
			findings,
			count: findings.length || 1
		});
	}

	return sortReportProblems(problems);
}

export function generateTemplateReportHtml(
	pageData: AuditPageData,
	templates: AuditReportTemplateRecord[]
) {
	const domain = domainName(pageData);
	const previewScreenshots = new Map(
		(pageData.reportPreviewItems || [])
			.filter((item) => item.screenshot)
			.map((item) => [item.key, item.screenshot])
	);
	const problems = buildReportProblems(pageData, templates).map((problem) => ({
		...problem,
		screenshot: previewScreenshots.get(problem.key) || problem.screenshot
	}));
	const factors = 10;

	return `<div style="background:#ffffff; color:#111827; font-family:Arial, sans-serif; max-width:760px; margin:0 auto; padding:0;">
  <h1 style="font-family:Arial, sans-serif; font-size:26pt; line-height:1.15; color:#111827; margin:0 0 10px 0; font-weight:700;">Mini Technical SEO Audit</h1>
  <h2 style="font-family:Arial, sans-serif; font-size:18pt; line-height:1.2; color:#111827; margin:0 0 28px 0; font-weight:700;">${escapeHtml(domain)}</h2>

  <h2 style="font-family:Arial, sans-serif; font-size:16pt; line-height:1.2; color:#111827; margin:0 0 12px 0; font-weight:700;">Overview</h2>
  <p style="font-family:Arial, sans-serif; font-size:10.5pt; line-height:1.55; color:#111827; margin:0 0 10px 0;">${escapeHtml(domain)} wants to rank higher for target keywords and generate more organic traffic.</p>
  <p style="font-family:Arial, sans-serif; font-size:10.5pt; line-height:1.55; color:#111827; margin:0 0 10px 0;">We analyzed ${factors} different factors in this mini technical SEO Audit, out of the 285 total factors that are included in the FULL version of the technical SEO Audit.</p>
  <p style="font-family:Arial, sans-serif; font-size:10.5pt; line-height:1.55; color:#111827; margin:0 0 28px 0;">The goal of this brief document is to provide an evaluation of challenges, which if resolved can be quick-win opportunities that can yield better rankings and higher organic traffic.</p>

  <h2 style="font-family:Arial, sans-serif; font-size:16pt; line-height:1.2; color:#111827; margin:0 0 12px 0; font-weight:700;">Challenges</h2>
  <p style="font-family:Arial, sans-serif; font-size:10.5pt; line-height:1.55; color:#111827; margin:0 0 10px 0;">In our brief evaluation of the current technical optimization status of ${escapeHtml(domain)} we identified ${problems.length ? 'many problems and errors' : 'a limited number of problems'} with the site architecture.</p>
  <p style="font-family:Arial, sans-serif; font-size:10.5pt; line-height:1.55; color:#111827; margin:0 0 10px 0;">These exact problems are among the top reasons why you’re not ranking for more of your target keywords and in some cases are stuck at the bottom of page 1.</p>
  <p style="font-family:Arial, sans-serif; font-size:10.5pt; line-height:1.55; color:#111827; margin:0 0 18px 0;">The main problems are listed below:</p>

  ${problems.length ? problems.map((problem, index) => problemHtml(problem, index + 1)).join('') : '<p style="font-family:Arial, sans-serif; font-size:10.5pt; line-height:1.55; color:#111827; margin:0 0 18px 0;">No major warning or failed checks were found in this mini audit.</p>'}

  <p style="font-family:Arial, sans-serif; font-size:10.5pt; line-height:1.55; color:#111827; margin:16px 0 28px 0;">All of the above problems have a direct negative impact on your organic rankings, visibility, and traffic and present a massive opportunity cost over the long term.</p>

  <h2 style="font-family:Arial, sans-serif; font-size:16pt; line-height:1.2; color:#111827; margin:0 0 12px 0; font-weight:700;">Summary</h2>
  <p style="font-family:Arial, sans-serif; font-size:10.5pt; line-height:1.55; color:#111827; margin:0 0 10px 0;">${escapeHtml(domain)} is an established website with valuable assets, links and content and many uncaptured opportunities, but also problems…</p>
  <p style="font-family:Arial, sans-serif; font-size:10.5pt; line-height:1.55; color:#111827; margin:0 0 10px 0;">In order to rank for more keywords, as well as rank higher for existing ones and outrank your competitors, we’d highly suggest taking care of the issues mentioned above.</p>
  <p style="font-family:Arial, sans-serif; font-size:10.5pt; line-height:1.55; color:#111827; margin:0 0 10px 0;">We’d also highly suggest considering our full technical SEO audit, where we take an in-depth look at 285 different technical factors, instead of just ${factors} covered in this mini technical SEO audit.</p>
  <p style="font-family:Arial, sans-serif; font-size:10.5pt; line-height:1.55; color:#111827; margin:0 0 10px 0;">When doing the full technical audit, it’s very easy to find quick wins and optimizations that need to be done in order to dramatically increase existing organic traffic.</p>
  <p style="font-family:Arial, sans-serif; font-size:10.5pt; line-height:1.55; color:#111827; margin:0 0 10px 0;">An example of this would be one of the recent case studies that we just published, where weekly organic traffic jumped from 200,000 to 315,000 in 45 days, by simply changing a few settings and bits of code.</p>
  <p style="font-family:Arial, sans-serif; font-size:10.5pt; line-height:1.55; color:#111827; margin:0 0 10px 0;">(Results typically kick in 30-45 days after Google indexes the applied changes).</p>
  <p style="font-family:Arial, sans-serif; font-size:10.5pt; line-height:1.55; color:#111827; margin:0 0 10px 0;">We highly believe that we can find the same problems/opportunities if not even more if we were to audit ${escapeHtml(domain)}.</p>
  <p style="font-family:Arial, sans-serif; font-size:10.5pt; line-height:1.55; color:#111827; margin:0;">In case of any questions, feel free to reach out to us at any time.</p>
</div>`;
}
