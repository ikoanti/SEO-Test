import { buildAuditPageData } from '$lib/server/audit-detail';
import { ensureAuditWorkflowProcessing } from '$lib/server/audit-runner';

function delay(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export const GET = async ({ params, locals, request }) => {
	const encoder = new TextEncoder();

	const stream = new ReadableStream({
		async start(controller) {
			let closed = false;
			let lastPayload = '';

			const close = () => {
				if (closed) return;
				closed = true;
				controller.close();
			};

			request.signal.addEventListener('abort', close);

			while (!closed) {
				try {
					const payload = await buildAuditPageData(params.auditId, locals.pbToken);
					ensureAuditWorkflowProcessing(payload.workflowRecord, locals.pbToken);
					const serialized = JSON.stringify(payload);

					if (serialized !== lastPayload) {
						controller.enqueue(encoder.encode(`data: ${serialized}\n\n`));
						lastPayload = serialized;
					}

					if (!payload.isPendingRun) {
						close();
						return;
					}

					await delay(400);
				} catch {
					close();
					return;
				}
			}
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache, no-transform',
			Connection: 'keep-alive'
		}
	});
};
