import { error } from '@sveltejs/kit';
import { buildAuditPageData } from '$lib/server/audit-detail';
import { generateTemplateReportDocx } from '$lib/server/report-docx';
import { listAuditReportTemplates } from '$lib/server/pocketbase';

function selectedTemplateKeys(url: URL, availableKeys: Set<string>) {
	return [
		...new Set(
			url.searchParams
				.getAll('reportTemplateKey')
				.map((value) => String(value))
				.filter((key) => availableKeys.has(key))
		)
	];
}

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
	const selectedKeys = selectedTemplateKeys(url, availableKeys);
	const minSelection = Math.min(5, availableKeys.size);

	if (availableKeys.size > 0 && selectedKeys.length < minSelection) {
		throw error(
			400,
			`Select at least ${minSelection} finding${minSelection === 1 ? '' : 's'} for the export.`
		);
	}

	if (selectedKeys.length > 10) {
		throw error(400, 'Select no more than 10 findings for the export.');
	}

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
