import { json } from '@sveltejs/kit';
import { exportAuditToGoogleDoc } from '$lib/server/audit-google-export';
import { externalApiPocketBaseToken, readJsonBody } from '$lib/server/external-api';

function stringArray(value: unknown) {
	return Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : undefined;
}

export const POST = async ({ request, params }) => {
	const token = await externalApiPocketBaseToken(request);
	const body = await readJsonBody(request);
	const googleDoc = await exportAuditToGoogleDoc({
		auditId: params.auditId,
		token,
		reportTemplateKeys: stringArray(body.reportTemplateKeys || body.report_template_keys)
	});

	return json({
		auditId: params.auditId,
		googleDocId: googleDoc.id,
		name: googleDoc.name,
		url: googleDoc.url,
		folderId: googleDoc.folderId,
		folderName: googleDoc.folderName,
		reportTemplateKeys: googleDoc.reportTemplateKeys
	});
};
