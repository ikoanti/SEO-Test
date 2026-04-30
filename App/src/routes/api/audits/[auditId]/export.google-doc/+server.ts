import { error, json } from '@sveltejs/kit';
import { buildAuditPageData } from '$lib/server/audit-detail';
import { uploadAuditDocxAsGoogleDoc } from '$lib/server/google-drive';
import { listAuditReportTemplates } from '$lib/server/pocketbase';
import { generateTemplateReportDocx } from '$lib/server/report-docx';
import {
	priorityOverridesFromEntries,
	selectedTemplateKeys,
	validateReportSelection
} from '$lib/server/report-export-options';

function domainName(pageData: Awaited<ReturnType<typeof buildAuditPageData>>) {
	const summary = pageData.summary as { domain?: string } | null;
	return (
		pageData.website?.display_name ||
		pageData.website?.name ||
		summary?.domain ||
		pageData.website?.domain ||
		pageData.website?.url ||
		'audit'
	);
}

export const POST = async ({ params, locals, request }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required.');
	}

	const formData = await request.formData();
	const pageData = await buildAuditPageData(params.auditId, locals.pbToken, {
		includeReportHtml: false,
		includeReportPreview: true
	});

	if (String(pageData.runRecord.status || '') !== 'completed') {
		throw error(400, 'Google Docs export is available only after the audit run completes.');
	}

	const availableKeys = new Set(pageData.reportPreviewItems.map((item) => item.key));
	const selectedKeys = selectedTemplateKeys(
		formData.getAll('reportTemplateKey').map((value) => String(value)),
		availableKeys
	);
	validateReportSelection(selectedKeys, availableKeys);

	const selectedSet = new Set(selectedKeys);
	const priorityOverrides = priorityOverridesFromEntries(formData.entries(), selectedSet);
	const templates = (await listAuditReportTemplates(locals.pbToken)).filter((template) =>
		selectedSet.has(template.key)
	);
	const file = await generateTemplateReportDocx(
		pageData,
		templates,
		locals.pbToken,
		priorityOverrides
	);
	const googleDoc = await uploadAuditDocxAsGoogleDoc({
		domain: domainName(pageData),
		filename: file.filename,
		body: file.body
	});

	return json(googleDoc);
};
