import { fail, isRedirect, redirect } from '@sveltejs/kit';
import {
	createAuditRecord,
	createWorkflowRecord,
	getOrCreateWebsiteRecord,
	getWorkflowByAuditId,
	listAudits,
	updateWebsiteRecord
} from '$lib/server/pocketbase';
import { queueAuditWorkflow } from '$lib/server/audit-runner';

function getWebsiteUrl(audit: Record<string, unknown>) {
	const website = (audit.expand as { website?: { url?: string } } | undefined)?.website;
	return website?.url || '';
}

function getWebsite(audit: Record<string, unknown>) {
	return (
		(
			audit.expand as
				| { website?: { id?: string; url?: string; domain?: string; display_name?: string } }
				| undefined
		)?.website || null
	);
}

function auditSortTimestamp(audit: Record<string, unknown>) {
	return String(audit.queued_at || audit.created_at || audit.updated_at || audit.id || '');
}

export const load = async ({ locals, url }) => {
	const query = String(url.searchParams.get('q') || '').trim();
	const audits = await listAudits(query, locals.pbToken);

	const hydratedAudits = await Promise.all(
		audits.map(async (audit) => {
			const website = getWebsite(audit);
			try {
				const workflow = await getWorkflowByAuditId(audit.id, locals.pbToken);
				return {
					...audit,
					url: website?.url || getWebsiteUrl(audit),
					website,
					status: workflow.status || audit.status,
					queued_at: workflow.queued_at,
					targetHref: `/audits/${audit.id}`
				};
			} catch {
				return {
					...audit,
					url: website?.url || getWebsiteUrl(audit),
					website,
					targetHref: `/audits/${audit.id}`
				};
			}
		})
	);

	const sortedAudits = hydratedAudits.sort((left, right) =>
		auditSortTimestamp(right).localeCompare(auditSortTimestamp(left))
	);
	const websiteGroups = new Map<
		string,
		{ website: Record<string, unknown>; audits: typeof sortedAudits }
	>();

	for (const audit of sortedAudits) {
		const website = (audit.website as Record<string, unknown> | null) || {
			id: `missing-${String(audit.id)}`,
			url: audit.url,
			domain: audit.url,
			display_name: audit.url
		};
		const key = String(website.id || website.domain || website.url || audit.id);
		const existing = websiteGroups.get(key);
		if (existing) {
			existing.audits.push(audit);
		} else {
			websiteGroups.set(key, { website, audits: [audit] });
		}
	}

	return {
		audits: sortedAudits,
		websites: [...websiteGroups.values()],
		query
	};
};

export const actions = {
	updateWebsite: async ({ request, locals }) => {
		const data = await request.formData();
		const websiteId = String(data.get('websiteId') || '').trim();
		const displayName = String(data.get('displayName') || '').trim();

		if (!websiteId) {
			return fail(400, { createError: 'Website is missing.' });
		}
		if (!displayName) {
			return fail(400, { createError: 'Display name is required.' });
		}

		try {
			await updateWebsiteRecord(websiteId, { display_name: displayName }, locals.pbToken);
			return { websiteUpdated: true };
		} catch (error) {
			return fail(400, {
				createError: error instanceof Error ? error.message : 'Failed to update website.'
			});
		}
	},
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
