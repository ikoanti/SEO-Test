import { error } from '@sveltejs/kit';
import { getAuditReportDocxFile } from '$lib/server/pocketbase';

export const GET = async ({ params, locals }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required.');
	}

	try {
		const file = await getAuditReportDocxFile(params.auditId, locals.pbToken);
		return new Response(file.body, {
			headers: {
				'Content-Type': file.contentType,
				'Cache-Control': 'private, max-age=300',
				'Content-Disposition': `attachment; filename="${file.filename.replaceAll('"', '')}"`
			}
		});
	} catch (err) {
		throw error(404, err instanceof Error ? err.message : 'Report document not found.');
	}
};
