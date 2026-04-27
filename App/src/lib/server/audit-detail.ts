import type { AuditFindingStatus } from '$lib/audit-status';
import {
	getAudit,
	getWorkflowByAuditId,
	listAuditScreenshots,
	listAuditFindings,
	listRunsByWorkflow
} from '$lib/server/pocketbase';
import { appendReportScreenshotsIfMissing } from '$lib/server/report-screenshots';

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
	const [runs, auditFindings, auditScreenshots] = await Promise.all([
		listRunsByWorkflow(workflowRecord.id, token),
		listAuditFindings(auditRecord.id, token),
		listAuditScreenshots(auditRecord.id, token)
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
	for (const screenshot of auditScreenshots) {
		const screenshotRecord = screenshot as Record<string, unknown> & { image_url?: string };
		const runId = String(screenshotRecord.run || '');
		const findingTypeId = String(screenshotRecord.audit_finding_type || '');
		if (runId && !screenshotsByRunId.has(runId)) {
			screenshotsByRunId.set(runId, screenshot);
		}
		if (findingTypeId && !screenshotsByFindingTypeId.has(findingTypeId)) {
			screenshotsByFindingTypeId.set(findingTypeId, screenshot);
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
		const screenshotRecord = screenshot as
			| (Record<string, unknown> & { image_url?: string })
			| null;
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
			screenshot: screenshotRecord
				? {
						id: typeof screenshotRecord.id === 'string' ? screenshotRecord.id : undefined,
						title: typeof screenshotRecord.title === 'string' ? screenshotRecord.title : undefined,
						page_url:
							typeof screenshotRecord.page_url === 'string' ? screenshotRecord.page_url : undefined,
						image_url:
							typeof screenshotRecord.id === 'string'
								? `/api/audits/${encodeURIComponent(auditRecord.id)}/screenshots/${encodeURIComponent(
										screenshotRecord.id
									)}/image`
								: screenshotRecord.image_url || ''
					}
				: null,
			findings
		};
	});
	const storedReportHtml = String(auditRecord?.report_html || '');
	const reportHtml =
		includeReportHtml && storedReportHtml
			? appendReportScreenshotsIfMissing(storedReportHtml, {
					auditId: auditRecord.id,
					normalizedItems
				})
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
		summary,
		reportHtml,
		aiVisibility,
		normalizedItems,
		isPendingRun: ['queued', 'running'].includes(String(workflowRecord.status || '')),
		isPendingReport: ['queued', 'running'].includes(String(auditRecord.report_status || ''))
	};
}
