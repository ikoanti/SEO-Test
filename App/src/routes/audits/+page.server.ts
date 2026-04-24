import { fail, redirect } from '@sveltejs/kit';
import { createRunRecord, getAuditByRunId, listRuns } from '$lib/server/pocketbase';
import { ensureAuditRunProcessing, queueAuditRun } from '$lib/server/audit-runner';

export const load = async ({ locals }) => {
	const runs = await listRuns('', locals.pbToken);
	runs.forEach((run) => ensureAuditRunProcessing(run, locals.pbToken));

	const audits = await Promise.all(
		runs.map(async (run) => {
			if (run.status !== 'completed') {
				return {
					...run,
					targetHref: `/audits/${run.id}`
				};
			}

			try {
				const audit = await getAuditByRunId(run.id, locals.pbToken);
				return {
					...run,
					targetHref: `/audits/${audit.id}`
				};
			} catch {
				return {
					...run,
					targetHref: `/audits/${run.id}`
				};
			}
		})
	);

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
			const record = await createRunRecord(
				{
					name,
					url,
					created_by: locals.user?.id,
					status: 'queued',
					run_log: `[${new Date().toISOString()}] Run queued.`
				},
				locals.pbToken
			);

			queueAuditRun({
				runId: record.id,
				url,
				name,
				createdBy: locals.user?.id,
				token: locals.pbToken
			});

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
