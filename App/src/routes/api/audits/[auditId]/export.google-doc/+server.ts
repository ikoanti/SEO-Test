import { error, json } from '@sveltejs/kit';
import { exportAuditToGoogleDoc } from '$lib/server/audit-google-export';

export const POST = async ({ params, locals, request }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required.');
	}

	const formData = await request.formData();
	const googleDoc = await exportAuditToGoogleDoc({
		auditId: params.auditId,
		token: locals.pbToken,
		reportTemplateKeys: formData.getAll('reportTemplateKey').map((value) => String(value))
	});

	return json(googleDoc);
};
