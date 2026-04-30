import { error } from '@sveltejs/kit';
import { buildAuditPageData } from '$lib/server/audit-detail';
import { uploadAuditDocxAsGoogleDoc } from '$lib/server/google-drive';
import { listAuditReportTemplates, saveAuditGoogleDocExport } from '$lib/server/pocketbase';
import { generateTemplateReportDocx } from '$lib/server/report-docx';
import { selectedTemplateKeys, validateReportSelection } from '$lib/server/report-export-options';

type AuditPageData = Awaited<ReturnType<typeof buildAuditPageData>>;

function domainName(pageData: AuditPageData) {
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

function exportKeys(pageData: AuditPageData, requestedKeys?: string[]) {
	const availableKeys = new Set(pageData.reportPreviewItems.map((item) => item.key));
	const keys =
		requestedKeys && requestedKeys.length
			? selectedTemplateKeys(requestedKeys, availableKeys)
			: pageData.reportPreviewItems.slice(0, 10).map((item) => item.key);

	validateReportSelection(keys, availableKeys);
	return keys;
}

export async function exportAuditToGoogleDoc(input: {
	auditId: string;
	token?: string;
	reportTemplateKeys?: string[];
}) {
	const pageData = await buildAuditPageData(input.auditId, input.token, {
		includeReportHtml: false,
		includeReportPreview: true
	});

	if (String(pageData.runRecord.status || '') !== 'completed') {
		throw error(400, 'Google Docs export is available only after the audit run completes.');
	}

	const selectedKeys = exportKeys(pageData, input.reportTemplateKeys);
	const selectedSet = new Set(selectedKeys);
	const templates = (await listAuditReportTemplates(input.token)).filter((template) =>
		selectedSet.has(template.key)
	);
	const file = await generateTemplateReportDocx(pageData, templates, input.token);
	const googleDoc = await uploadAuditDocxAsGoogleDoc({
		domain: domainName(pageData),
		filename: file.filename,
		body: file.body,
		existingDocumentId:
			typeof pageData.auditRecord?.google_doc_id === 'string'
				? pageData.auditRecord.google_doc_id
				: undefined
	});

	await saveAuditGoogleDocExport(
		input.auditId,
		{
			google_drive_folder_id: googleDoc.folderId,
			google_drive_folder_name: googleDoc.folderName,
			google_doc_id: googleDoc.id,
			google_doc_name: googleDoc.name,
			google_doc_url: googleDoc.url
		},
		input.token
	);

	return {
		...googleDoc,
		reportTemplateKeys: selectedKeys
	};
}
