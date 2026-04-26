import { fail, isRedirect, redirect } from '@sveltejs/kit';
import { createRunRecord, getAuditByRunId, listRuns } from '$lib/server/pocketbase';
import { ensureAuditRunProcessing, queueAuditRun } from '$lib/server/audit-runner';

export const load = async ({ locals, url }) => {
	const query = String(url.searchParams.get('q') || '').trim();
	const runs = await listRuns(query, locals.pbToken);
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

	return { audits, query };
};

export const actions = {
	create: async ({ request, locals }) => {
		const data = await request.formData();
		const url = String(data.get('url') || '').trim();

		if (!url) {
			return fail(400, {
				createError: 'Audit URL is required.',
				url
			});
		}

		try {
			const createdBy = locals.user?.isSuperuser ? undefined : locals.user?.id;
			const record = await createRunRecord(
				{
					name: url,
					url,
					created_by: createdBy,
					status: 'queued',
					run_log: `[${new Date().toISOString()}] Run queued.`
				},
				locals.pbToken
			);

			queueAuditRun({
				runId: record.id,
				url,
				name: url,
				createdBy,
				token: locals.pbToken
			});

			throw redirect(302, `/audits/${record.id}`);
		} catch (error) {
			if (isRedirect(error)) throw error;
			return fail(500, {
				createError: error instanceof Error ? error.message : 'Failed to create audit.',
				url
			});
		}
	}
};
