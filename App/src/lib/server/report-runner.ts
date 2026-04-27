import { buildAuditPageData } from '$lib/server/audit-detail';
import { getAudit, listAuditFindingTypeTemplates, updateAuditRecord } from '$lib/server/pocketbase';
import { generateTemplateReportHtml } from '$lib/server/report-template';

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

function parseSelectedFindingTypeKeys(value: unknown) {
	if (typeof value !== 'string' || !value.trim()) return [];
	try {
		const parsed = JSON.parse(value);
		return Array.isArray(parsed)
			? parsed.map((item) => String(item)).filter((item) => item.trim())
			: [];
	} catch {
		return [];
	}
}

async function processReportGeneration(auditId: string, token?: string) {
	const auditRecord = await getAudit(auditId, token);
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
		const selectedKeys = new Set(
			parseSelectedFindingTypeKeys(auditRecord.selected_report_finding_types_json)
		);
		const reportTemplates = (await listAuditFindingTypeTemplates(token)).filter(
			(template) => !selectedKeys.size || selectedKeys.has(template.key)
		);
		const reportHtml = generateTemplateReportHtml(pageData, reportTemplates);
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
