import { fail, isRedirect, redirect } from '@sveltejs/kit';
import {
	createAuditRecord,
	createWorkflowRecord,
	getOrCreateWebsiteRecord,
	getWorkflowByAuditId,
	listAudits
} from '$lib/server/pocketbase';
import { ensureAuditWorkflowProcessing, queueAuditWorkflow } from '$lib/server/audit-runner';

function getWebsiteUrl(audit: Record<string, unknown>) {
	const website = (audit.expand as { website?: { url?: string } } | undefined)?.website;
	return website?.url || '';
}

export const load = async ({ locals, url }) => {
	const query = String(url.searchParams.get('q') || '').trim();
	const audits = await listAudits(query, locals.pbToken);

	const hydratedAudits = await Promise.all(
		audits.map(async (audit) => {
			try {
				const workflow = await getWorkflowByAuditId(audit.id, locals.pbToken);
				ensureAuditWorkflowProcessing(workflow, locals.pbToken);
				return {
					...audit,
					url: getWebsiteUrl(audit),
					status: workflow.status || audit.status,
					targetHref: `/audits/${audit.id}`
				};
			} catch {
				return {
					...audit,
					url: getWebsiteUrl(audit),
					targetHref: `/audits/${audit.id}`
				};
			}
		})
	);

	return { audits: hydratedAudits, query };
};

export const actions = {
	create: async ({ request, locals }) => {
		const data = await request.formData();
		const urls = [...data.getAll('urls'), data.get('url')]
			.flatMap((value) =>
				String(value || '')
					.split(',')
					.map((url) => url.trim())
			)
			.filter(Boolean);
		const uniqueUrls = [...new Set(urls)];

		if (!uniqueUrls.length) {
			return fail(400, {
				createError: 'At least one audit URL is required.',
				urls: uniqueUrls
			});
		}

		try {
			const createdBy = locals.user?.isSuperuser ? undefined : locals.user?.id;
			const audits = [];

			for (const url of uniqueUrls) {
				const website = await getOrCreateWebsiteRecord(url, locals.pbToken);
				const audit = await createAuditRecord(
					{
						website: website.id,
						created_by: createdBy,
						status: 'queued'
					},
					locals.pbToken
				);
				const workflow = await createWorkflowRecord(
					{
						audit: audit.id,
						status: 'queued',
						run_log: `[${new Date().toISOString()}] Workflow queued.`
					},
					locals.pbToken
				);

				queueAuditWorkflow({
					workflowId: workflow.id,
					auditId: audit.id,
					url: website.url,
					token: locals.pbToken
				});
				audits.push(audit);
			}

			throw redirect(302, audits.length === 1 ? `/audits/${audits[0].id}` : '/audits');
		} catch (error) {
			if (isRedirect(error)) throw error;
			return fail(400, {
				createError: error instanceof Error ? error.message : 'Failed to create audit.',
				urls: uniqueUrls
			});
		}
	}
};
