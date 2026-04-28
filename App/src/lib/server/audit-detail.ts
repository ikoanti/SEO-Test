import type { AuditFindingStatus } from '$lib/audit-status';
import {
	getAudit,
	getWorkflowByAuditId,
	listAuditScreenshots,
	listAuditFindings,
	listAuditReportTemplates,
	listRunsByWorkflow
} from '$lib/server/pocketbase';
import { hasPendingScreenshotJobs } from '$lib/server/audit-runner';
import { buildReportProblems, generateTemplateReportHtml } from '$lib/server/report-template';

type BuildAuditPageDataOptions = {
	includeReportHtml?: boolean;
};

function getWebsite(auditRecord: Record<string, unknown>) {
	return (auditRecord.expand as { website?: { url?: string; domain?: string } } | undefined)
		?.website;
}

function compactAuditRecord(auditRecord: Record<string, unknown>) {
	return {
		id: typeof auditRecord.id === 'string' ? auditRecord.id : undefined,
		status: typeof auditRecord.status === 'string' ? auditRecord.status : undefined,
		report_status:
			typeof auditRecord.report_status === 'string' ? auditRecord.report_status : undefined,
		created: typeof auditRecord.created === 'string' ? auditRecord.created : undefined,
		updated: typeof auditRecord.updated === 'string' ? auditRecord.updated : undefined,
		url: getWebsite(auditRecord)?.url,
		name: getWebsite(auditRecord)?.domain || getWebsite(auditRecord)?.url
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
	const counts = auditFindings.reduce<{ passed: number; warnings: number; failed: number }>(
		(accumulator, finding) => {
			if (finding.status === 'pass') accumulator.passed += 1;
			else if (finding.status === 'warn') accumulator.warnings += 1;
			else if (finding.status === 'fail') accumulator.failed += 1;
			return accumulator;
		},
		{ passed: 0, warnings: 0, failed: 0 }
	);
	const hasPersistedCounts =
		usePersistedFindingCounts && counts.passed + counts.warnings + counts.failed > 0;

	return {
		...base,
		summary: hasPersistedCounts
			? counts
			: {
					passed: Number(rawSummary.passed || 0),
					warnings: Number(rawSummary.warnings || 0),
					failed: Number(rawSummary.failed || 0)
				}
	};
}

export async function buildAuditPageData(
	auditId: string,
	token?: string,
	options: BuildAuditPageDataOptions = {}
) {
	const includeReportHtml = options.includeReportHtml ?? true;
	const auditRecord = await getAudit(auditId, token);
	const workflowRecord = await getWorkflowByAuditId(auditRecord.id, token);

	const audit = parseStoredJson(auditRecord.audit_json);
	const summary = parseStoredJson(auditRecord.summary_json);
	const aiVisibility = parseStoredJson(auditRecord.ai_visibility_json);
	const [runs, auditFindings, auditScreenshots, reportTemplates] = await Promise.all([
		listRunsByWorkflow(workflowRecord.id, token),
		listAuditFindings(auditRecord.id, token),
		listAuditScreenshots(auditRecord.id, token),
		listAuditReportTemplates(token)
	]);
	const findingsByRunId = new Map<string, typeof auditFindings>();
	for (const finding of auditFindings) {
		const runId = String(finding.run || '');
		const current = findingsByRunId.get(runId) || [];
		current.push(finding);
		findingsByRunId.set(runId, current);
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

	const normalizedItems = runs.map((run) => {
		const findingType = (
			run.expand as
				| {
						audit_finding_type?: {
							key?: string;
							label?: string;
							sort_order?: number;
						};
				  }
				| undefined
		)?.audit_finding_type;
		const findings = (findingsByRunId.get(run.id) || []).map((finding) => ({
			...finding,
			meta: parseStoredJson(finding.meta_json)
		})) as Array<Record<string, unknown> & { status?: AuditFindingStatus }>;
		const displaySummary =
			typeof findings[0]?.detail === 'string' && findings[0].detail.trim()
				? findings[0].detail
				: typeof findings[0]?.title === 'string' && findings[0].title.trim()
					? findings[0].title
					: '';
		const status = findings.some((finding) => finding.status === 'fail')
			? 'fail'
			: findings.some((finding) => finding.status === 'warn')
				? 'warn'
				: findings.some((finding) => finding.status === 'pass')
					? 'pass'
					: 'info';
		const screenshot =
			screenshotsByRunId.get(run.id) ||
			(findingType?.key
				? screenshotsByFindingTypeId.get(String(run.audit_finding_type || ''))
				: null);
		return {
			id: run.id,
			key: findingType?.key || run.id,
			label: findingType?.label || 'Audit check',
			status,
			runStatus: run.status,
			summary: displaySummary,
			itemRun: run,
			sortOrder: findingType?.sort_order || run.sort_order || 999,
			stats: displaySummary ? { stats: displaySummary, count: findings.length } : null,
			screenshot: screenshotView(auditRecord.id, screenshot),
			findings
		};
	});
	const selectedReportTemplateKeys = parseStoredStringArray(
		auditRecord.selected_report_template_keys_json
	);
	const isPendingRun = ['queued', 'running'].includes(String(workflowRecord.status || ''));
	const reportPageData = {
		auditId: auditRecord.id,
		runRecord: {
			url: getWebsite(auditRecord)?.url,
			name: getWebsite(auditRecord)?.domain || getWebsite(auditRecord)?.url
		},
		auditRecord: compactAuditRecord(auditRecord),
		audit,
		summary: buildDisplayedSummary(
			summary,
			auditFindings as Array<Record<string, unknown> & { status?: AuditFindingStatus }>,
			!isPendingRun
		),
		aiVisibility,
		normalizedItems
	};
	const reportPreviewItems = buildReportProblems(reportPageData, reportTemplates).map(
		(problem) => ({
			...problem,
			screenshot:
				screenshotView(auditRecord.id, screenshotsByReportTemplateKey.get(problem.key)) ||
				problem.screenshot
		})
	);
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
			url: getWebsite(auditRecord)?.url,
			name: getWebsite(auditRecord)?.domain || getWebsite(auditRecord)?.url,
			error_message: workflowRecord.error_message,
			run_log: workflowRecord.run_log
		},
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
		selectedReportTemplateKeys,
		aiVisibility,
		normalizedItems,
		isPendingRun,
		isPendingReport: ['queued', 'running'].includes(String(auditRecord.report_status || '')),
		isPendingScreenshots: hasPendingScreenshotJobs(auditRecord.id)
	};
}
