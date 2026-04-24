import { fail, redirect } from '@sveltejs/kit';
import { createAuditRecord, listAudits } from '$lib/server/pocketbase';
import { runAudit } from '$lib/server/audit';

export const load = async ({ locals }) => {
	const audits = await listAudits('', locals.pbToken);
	return { audits };
};

export const actions = {
	create: async ({ request, locals }) => {
		const data = await request.formData();
		const name = String(data.get('name') || '').trim();
		const url = String(data.get('url') || '').trim();

		if (!name || !url) {
			return fail(400, {
				createError: 'Audit name and URL are required.',
				name,
				url
			});
		}

		try {
			const audit = await runAudit(url);
			const summary = {
				domain: audit.domain,
				auditedAt: audit.auditedAt,
				summary: audit.summary,
				pageSpeed: audit.pageSpeed,
				openPageRank: audit.openPageRank
			};

			const record = await createAuditRecord(
				{
					name,
					url,
					created_by: locals.user?.id,
					audit_json: JSON.stringify(audit),
					summary_json: JSON.stringify(summary),
					status: 'completed'
				},
				locals.pbToken
			);

			throw redirect(302, `/audits/${record.id}`);
		} catch (error) {
			if (error instanceof Response) throw error;
			return fail(500, {
				createError: error instanceof Error ? error.message : 'Failed to create audit.',
				name,
				url
			});
		}
	}
};
