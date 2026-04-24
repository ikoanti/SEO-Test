import { error } from '@sveltejs/kit';
import { getAudit } from '$lib/server/pocketbase';

export const load = async ({ params, locals }) => {
	const auditRecord = await getAudit(params.auditId, locals.pbToken);

	let audit;
	let summary;
	try {
		audit = JSON.parse(auditRecord.audit_json || '{}');
		summary = JSON.parse(auditRecord.summary_json || '{}');
	} catch {
		throw error(500, 'Stored audit JSON is invalid.');
	}

	return {
		auditRecord,
		audit,
		summary
	};
};
