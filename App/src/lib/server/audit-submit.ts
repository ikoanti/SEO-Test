import {
	createAuditRecord,
	createWorkflowRecord,
	getOrCreateWebsiteForAudit
} from '$lib/server/pocketbase';
import { queueAuditWorkflow } from '$lib/server/audit-runner';

export async function submitAudit(input: {
	domain: string;
	displayDomain?: string;
	displayName?: string;
	token?: string;
	createdBy?: string;
}) {
	const domain = input.domain.trim();
	if (!domain) {
		throw new Error('Website domain is required.');
	}

	const website = await getOrCreateWebsiteForAudit(
		{ domain, display_name: (input.displayDomain || input.displayName)?.trim() || undefined },
		input.token
	);
	const audit = await createAuditRecord(
		{
			website: website.id,
			created_by: input.createdBy,
			status: 'queued'
		},
		input.token
	);
	const queuedAt = new Date().toISOString();
	const workflow = await createWorkflowRecord(
		{
			audit: audit.id,
			status: 'queued',
			queued_at: queuedAt,
			run_log: `[${queuedAt}] Workflow queued.`
		},
		input.token
	);

	queueAuditWorkflow({
		workflowId: workflow.id,
		auditId: audit.id,
		url: website.url,
		token: input.token
	});

	return { website, audit, workflow };
}
