import { fail, isRedirect, redirect } from '@sveltejs/kit';
import {
	createAuditRecord,
	createWorkflowRecord,
	getOrCreateWebsiteForAudit,
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

function parseCreateRows(data: FormData) {
	const domains = data.getAll('domains').map((value) => String(value || '').trim());
	const displayNames = data.getAll('displayNames').map((value) => String(value || '').trim());
	const rows = domains
		.map((domain, index) => ({ domain, displayName: displayNames[index] || '' }))
		.filter((row) => row.domain);

	if (rows.length) return rows;

	return [...data.getAll('urls'), data.get('url')]
		.flatMap((value) =>
			String(value || '')
				.split(',')
				.map((url) => url.trim())
		)
		.filter(Boolean)
		.map((domain) => ({ domain, displayName: '' }));
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
			throw redirect(303, '/audits');
		} catch (error) {
			if (isRedirect(error)) throw error;
			return fail(400, {
				createError: error instanceof Error ? error.message : 'Failed to update website.'
			});
		}
	},
	create: async ({ request, locals }) => {
		const data = await request.formData();
		const rows = parseCreateRows(data);
		const uniqueRows = [
			...new Map(rows.map((row) => [row.domain.toLowerCase(), row] as const)).values()
		];

		if (!uniqueRows.length) {
			return fail(400, {
				createError: 'At least one website domain is required.',
				rows: uniqueRows
			});
		}

		try {
			const createdBy = locals.user?.isSuperuser ? undefined : locals.user?.id;
			const audits = [];

			for (const row of uniqueRows) {
				const website = row.displayName
					? await getOrCreateWebsiteForAudit(
							{ domain: row.domain, display_name: row.displayName },
							locals.pbToken
						)
					: await getOrCreateWebsiteRecord(row.domain, locals.pbToken);
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
				rows: uniqueRows
			});
		}
	}
};
