import { buildAuditPageData } from '$lib/server/audit-detail';
import { ensureAuditWorkflowProcessing, hasPendingScreenshotJobs } from '$lib/server/audit-runner';

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
				try {
					controller.close();
				} catch {
					return;
				}
			};

			const handleAbort = () => {
				close();
			};

			request.signal.addEventListener('abort', handleAbort);

			while (!closed) {
				try {
					const slimPayload = await buildAuditPageData(params.auditId, locals.pbToken, {
						includeReportHtml: false
					});
					ensureAuditWorkflowProcessing(slimPayload.workflowRecord, locals.pbToken);
					const shouldClose =
						!slimPayload.isPendingRun && !hasPendingScreenshotJobs(params.auditId);
					const payload = shouldClose
						? await buildAuditPageData(params.auditId, locals.pbToken)
						: slimPayload;
					const serialized = JSON.stringify(payload);

					if (!closed && serialized !== lastPayload) {
						controller.enqueue(encoder.encode(`data: ${serialized}\n\n`));
						lastPayload = serialized;
					}

					if (shouldClose) {
						close();
						request.signal.removeEventListener('abort', handleAbort);
						return;
					}

					await delay(2000);
				} catch {
					close();
					request.signal.removeEventListener('abort', handleAbort);
					return;
				}
			}

			request.signal.removeEventListener('abort', handleAbort);
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
