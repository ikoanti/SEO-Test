import type { AuditFindingStatus } from '$lib/audit-status';
import {
	getAudit,
	getWorkflowByAuditId,
	listAuditScreenshots,
	listAuditFindings,
	listAuditFindingTypes,
	listAuditReportTemplates,
	listRunsByWorkflow
} from '$lib/server/pocketbase';
import { hasPendingScreenshotJobs } from '$lib/server/audit-runner';
import { buildReportProblems, generateTemplateReportHtml } from '$lib/server/report-template';

type BuildAuditPageDataOptions = {
	includeReportHtml?: boolean;
	includeReportPreview?: boolean;
};

function getWebsite(auditRecord: Record<string, unknown>) {
	return (
		auditRecord.expand as
			| { website?: { url?: string; domain?: string; display_name?: string } }
			| undefined
	)?.website;
}

function compactAuditRecord(auditRecord: Record<string, unknown>) {
	return {
		id: typeof auditRecord.id === 'string' ? auditRecord.id : undefined,
		status: typeof auditRecord.status === 'string' ? auditRecord.status : undefined,
		report_status:
			typeof auditRecord.report_status === 'string' ? auditRecord.report_status : undefined,
		created: typeof auditRecord.created === 'string' ? auditRecord.created : undefined,
		updated: typeof auditRecord.updated === 'string' ? auditRecord.updated : undefined
	};
}

function compactWebsiteRecord(auditRecord: Record<string, unknown>) {
	const website = getWebsite(auditRecord);
	return {
		url: website?.url,
		domain: website?.domain,
		display_name: website?.display_name,
		name: website?.display_name || website?.domain || website?.url
	};
}

function parseStoredJson(value: unknown) {
	if (typeof value !== 'string' || !value.trim()) return null;

	try {
		return JSON.parse(value);
	} catch {
		return null;
	}
}

function parseStoredStringArray(value: unknown) {
	const parsed = parseStoredJson(value);
	return Array.isArray(parsed)
		? parsed.map((item) => String(item)).filter((item) => item.trim())
		: [];
}

function getRecord(value: unknown): Record<string, unknown> {
	return value && typeof value === 'object' && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: {};
}

function normalizeFindingStatus(status: unknown): AuditFindingStatus {
	if (status === 'pass' || status === 'warn' || status === 'info') return status;
	if (status === 'fail') return 'warn';
	return 'info';
}

function issueMatcher(pattern: string | undefined) {
	if (!pattern?.trim()) return undefined;

	try {
		const regex = new RegExp(pattern, 'i');
		return (finding: Record<string, unknown>) => {
			const detail = String(finding.detail || '').trim();
			const title = String(finding.title || '').trim();
			return regex.test(detail || title);
		};
	} catch {
		return undefined;
	}
}

function screenshotView(auditId: string, screenshot: unknown) {
	const screenshotRecord = screenshot as (Record<string, unknown> & { image_url?: string }) | null;
	if (!screenshotRecord) return null;

	return {
		id: typeof screenshotRecord.id === 'string' ? screenshotRecord.id : undefined,
		title: typeof screenshotRecord.title === 'string' ? screenshotRecord.title : undefined,
		page_url: typeof screenshotRecord.page_url === 'string' ? screenshotRecord.page_url : undefined,
		image_url:
			typeof screenshotRecord.id === 'string'
				? `/api/audits/${encodeURIComponent(auditId)}/screenshots/${encodeURIComponent(
						screenshotRecord.id
					)}/image`
				: screenshotRecord.image_url || ''
	};
}

function buildDisplayedSummary(
	summary: unknown,
	auditFindings: Array<Record<string, unknown> & { status?: AuditFindingStatus }>,
	usePersistedFindingCounts: boolean
) {
	const base = getRecord(summary);
	const rawSummary = getRecord(base.summary);
	const counts = auditFindings.reduce<{ passed: number; warnings: number; info: number }>(
		(accumulator, finding) => {
			const status = normalizeFindingStatus(finding.status);
			if (status === 'pass') accumulator.passed += 1;
			else if (status === 'warn') accumulator.warnings += 1;
			else accumulator.info += 1;
			return accumulator;
		},
		{ passed: 0, warnings: 0, info: 0 }
	);
	const hasPersistedCounts =
		usePersistedFindingCounts && counts.passed + counts.warnings + counts.info > 0;

	return {
		...base,
		summary: hasPersistedCounts
			? counts
			: {
					passed: Number(rawSummary.passed || 0),
					warnings: Number(rawSummary.warnings || 0) + Number(rawSummary.failed || 0),
					info: Number(rawSummary.info || 0)
				}
	};
}

export async function buildAuditPageData(
	auditId: string,
	token?: string,
	options: BuildAuditPageDataOptions = {}
) {
	const includeReportHtml = options.includeReportHtml ?? true;
	const includeReportPreview = options.includeReportPreview ?? includeReportHtml;
	const auditRecord = await getAudit(auditId, token);
	const workflowRecord = await getWorkflowByAuditId(auditRecord.id, token);

	const audit = parseStoredJson(auditRecord.audit_json);
	const summary = parseStoredJson(auditRecord.summary_json);
	const aiVisibility = parseStoredJson(auditRecord.ai_visibility_json);
	const [runs, auditFindings, auditScreenshots, findingTypes, reportTemplates] = await Promise.all([
		listRunsByWorkflow(workflowRecord.id, token),
		listAuditFindings(auditRecord.id, token),
		listAuditScreenshots(auditRecord.id, token),
		listAuditFindingTypes(token),
		includeReportPreview || includeReportHtml
			? listAuditReportTemplates(token)
			: Promise.resolve([])
	]);
	const findingsByRunId = new Map<string, typeof auditFindings>();
	for (const finding of auditFindings) {
		const runId = String(finding.run || '');
		const current = findingsByRunId.get(runId) || [];
		current.push(finding);
		findingsByRunId.set(runId, current);
	}
	const findingsByFindingTypeId = new Map<string, typeof auditFindings>();
	for (const finding of auditFindings) {
		const findingTypeId = String(finding.audit_finding_type || '');
		if (!findingTypeId) continue;
		const current = findingsByFindingTypeId.get(findingTypeId) || [];
		current.push(finding);
		findingsByFindingTypeId.set(findingTypeId, current);
	}
	const runsByFindingTypeId = new Map<string, (typeof runs)[number]>();
	for (const run of runs) {
		const findingTypeId = String(run.audit_finding_type || '');
		if (findingTypeId && !runsByFindingTypeId.has(findingTypeId)) {
			runsByFindingTypeId.set(findingTypeId, run);
		}
	}
	const screenshotsByRunId = new Map<string, (typeof auditScreenshots)[number]>();
	const screenshotsByFindingTypeId = new Map<string, (typeof auditScreenshots)[number]>();
	const screenshotsByReportTemplateKey = new Map<string, (typeof auditScreenshots)[number]>();
	for (const screenshot of auditScreenshots) {
		const screenshotRecord = screenshot as Record<string, unknown> & { image_url?: string };
		const runId = String(screenshotRecord.run || '');
		const findingTypeId = String(screenshotRecord.audit_finding_type || '');
		const reportTemplateKey = String(screenshotRecord.report_template_key || '');
		if (runId && !screenshotsByRunId.has(runId)) {
			screenshotsByRunId.set(runId, screenshot);
		}
		if (findingTypeId && !screenshotsByFindingTypeId.has(findingTypeId)) {
			screenshotsByFindingTypeId.set(findingTypeId, screenshot);
		}
		if (reportTemplateKey && !screenshotsByReportTemplateKey.has(reportTemplateKey)) {
			screenshotsByReportTemplateKey.set(reportTemplateKey, screenshot);
		}
	}

	const normalizedItems = findingTypes.map((findingType) => {
		const run = runsByFindingTypeId.get(findingType.id);
		const findings = (
			(run?.id ? findingsByRunId.get(run.id) : null) ||
			findingsByFindingTypeId.get(findingType.id) ||
			[]
		).map((finding) => ({
			...finding,
			status: normalizeFindingStatus(finding.status),
			meta: parseStoredJson(finding.meta_json)
		})) as Array<Record<string, unknown> & { status?: AuditFindingStatus }>;
		const displaySummary =
			typeof findings[0]?.detail === 'string' && findings[0].detail.trim()
				? findings[0].detail
				: typeof findings[0]?.title === 'string' && findings[0].title.trim()
					? findings[0].title
					: '';
		const status = findings.some((finding) => finding.status === 'warn')
			? 'warn'
			: findings.some((finding) => finding.status === 'pass')
				? 'pass'
				: 'info';
		const screenshot =
			(run?.id ? screenshotsByRunId.get(run.id) : null) ||
			screenshotsByFindingTypeId.get(findingType.id);
		return {
			id: run?.id || findingType.id,
			key: String(findingType.key || findingType.id),
			label: String(findingType.label || findingType.key || ''),
			status,
			runStatus: run?.status,
			summary: displaySummary,
			itemRun: run || null,
			sortOrder: Number(findingType.sort_order || run?.sort_order || 999),
			stats: displaySummary ? { stats: displaySummary, count: findings.length } : null,
			screenshot: screenshotView(auditRecord.id, screenshot),
			findings
		};
	});
	const normalizedItemsByKey = new Map(normalizedItems.map((item) => [item.key, item]));
	const representedSourceKeys = new Set(
		reportTemplates
			.map((template) => template.expand?.audit_finding_type?.key || '')
			.filter(Boolean)
	);
	const suppressedLegacyDisplayKeys = new Set(['h1Tags', 'structuredData', 'mobileUsability']);
	const templateDisplayItems = reportTemplates.map((template) => {
		const findingTypeKey = template.expand?.audit_finding_type?.key || '';
		const sourceItem = normalizedItemsByKey.get(findingTypeKey);
		const matcher = issueMatcher(template.match_pattern);
		const findings = (sourceItem?.findings || []).filter((finding) => {
			if (normalizeFindingStatus(finding.status) !== 'warn') return false;
			return matcher ? matcher(finding) : true;
		});
		const status: AuditFindingStatus = findings.length
			? 'warn'
			: sourceItem?.runStatus === 'completed'
				? 'pass'
				: 'info';
		const screenshot =
			screenshotView(auditRecord.id, screenshotsByReportTemplateKey.get(template.key)) ||
			(findingTypeKey === template.key ? sourceItem?.screenshot : null);

		return {
			id: template.id,
			key: findingTypeKey === 'pageSpeed' ? findingTypeKey : template.key,
			label: template.title,
			status,
			runStatus: sourceItem?.runStatus,
			summary: findings.length
				? `${findings.length} issue${findings.length === 1 ? '' : 's'} found`
				: sourceItem?.runStatus === 'completed'
					? 'No findings.'
					: '',
			itemRun: sourceItem?.itemRun || null,
			sortOrder: template.sort_order || sourceItem?.sortOrder || 999,
			stats: findings.length ? { count: findings.length } : null,
			screenshot,
			findings
		};
	});
	const templateDisplayKeys = new Set(templateDisplayItems.map((item) => item.key));
	const additionalCheckDisplayItems = normalizedItems
		.filter((item) => !templateDisplayKeys.has(item.key))
		.filter((item) => !representedSourceKeys.has(item.key))
		.filter((item) => !suppressedLegacyDisplayKeys.has(item.key))
		.sort((first, second) => (first.sortOrder || 999) - (second.sortOrder || 999));
	const findingDisplayItems = [...templateDisplayItems, ...additionalCheckDisplayItems];
	const selectedReportTemplateKeys = parseStoredStringArray(
		auditRecord.selected_report_template_keys_json
	);
	const isPendingRun = ['queued', 'running'].includes(String(workflowRecord.status || ''));
	const website = compactWebsiteRecord(auditRecord);
	const reportPageData = {
		auditId: auditRecord.id,
		runRecord: {
			url: website.url,
			name: website.name
		},
		website,
		auditRecord: compactAuditRecord(auditRecord),
		audit,
		summary: buildDisplayedSummary(
			summary,
			auditFindings as Array<Record<string, unknown> & { status?: AuditFindingStatus }>,
			!isPendingRun
		),
		aiVisibility,
		normalizedItems,
		findingDisplayItems
	};
	const reportPreviewItems = includeReportPreview
		? buildReportProblems(reportPageData, reportTemplates).map((problem) => ({
				...problem,
				screenshot:
					screenshotView(auditRecord.id, screenshotsByReportTemplateKey.get(problem.key)) ||
					problem.screenshot
			}))
		: [];
	const selectedReportTemplateSet = new Set(selectedReportTemplateKeys);
	const selectedReportTemplates = selectedReportTemplateSet.size
		? reportTemplates.filter((template) => selectedReportTemplateSet.has(template.key))
		: reportTemplates;
	const reportHtml =
		includeReportHtml && String(workflowRecord.status || '') === 'completed'
			? generateTemplateReportHtml(
					{ ...reportPageData, reportPreviewItems },
					selectedReportTemplates
				)
			: '';

	return {
		auditId: auditRecord.id,
		workflowRecord,
		runRecord: {
			status: workflowRecord.status,
			error_message: workflowRecord.error_message,
			run_log: workflowRecord.run_log
		},
		website,
		auditRecord: compactAuditRecord(auditRecord),
		reportRecord: {
			status: String(auditRecord.report_status || 'idle'),
			error_message: String(auditRecord.report_error || ''),
			started_at: auditRecord.report_started_at,
			completed_at: auditRecord.report_completed_at
		},
		audit,
		summary: buildDisplayedSummary(
			summary,
			auditFindings as Array<Record<string, unknown> & { status?: AuditFindingStatus }>,
			!isPendingRun
		),
		reportHtml,
		reportPreviewItems,
		reportTemplates: reportTemplates.map((template) => ({
			key: template.key,
			title: template.title,
			priority: template.priority,
			match_pattern: template.match_pattern,
			template_body: template.template_body,
			sort_order: template.sort_order,
			findingTypeKey: template.expand?.audit_finding_type?.key || '',
			findingTypeLabel: template.expand?.audit_finding_type?.label || ''
		})),
		selectedReportTemplateKeys,
		aiVisibility,
		normalizedItems,
		findingDisplayItems,
		isPendingRun,
		isPendingReport: ['queued', 'running'].includes(String(auditRecord.report_status || '')),
		isPendingScreenshots: hasPendingScreenshotJobs(auditRecord.id)
	};
}
