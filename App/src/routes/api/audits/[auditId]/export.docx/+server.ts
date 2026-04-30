import { error } from '@sveltejs/kit';
import { buildAuditPageData } from '$lib/server/audit-detail';
import { generateTemplateReportDocx } from '$lib/server/report-docx';
import { listAuditReportTemplates } from '$lib/server/pocketbase';
import { selectedTemplateKeys, validateReportSelection } from '$lib/server/report-export-options';

export const GET = async ({ params, locals, url }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required.');
	}

	const pageData = await buildAuditPageData(params.auditId, locals.pbToken, {
		includeReportHtml: false,
		includeReportPreview: true
	});

	if (String(pageData.runRecord.status || '') !== 'completed') {
		throw error(400, 'Export is available only after the audit run completes.');
	}

	const availableKeys = new Set(pageData.reportPreviewItems.map((item) => item.key));
	const selectedKeys = selectedTemplateKeys(
		url.searchParams.getAll('reportTemplateKey'),
		availableKeys
	);
	validateReportSelection(selectedKeys, availableKeys);
	const selectedSet = new Set(selectedKeys);
	const templates = (await listAuditReportTemplates(locals.pbToken)).filter((template) =>
		selectedSet.has(template.key)
	);
	const file = await generateTemplateReportDocx(pageData, templates, locals.pbToken);

	return new Response(new Uint8Array(file.body), {
		headers: {
			'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
			'Cache-Control': 'private, no-store',
			'Content-Disposition': `attachment; filename="${file.filename.replaceAll('"', '')}"`
		}
	});
};
