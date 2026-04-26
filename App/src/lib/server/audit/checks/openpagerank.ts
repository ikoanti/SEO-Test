import axios from 'axios';
import type { AuditLogger } from '../shared';

export async function analyzeOpenPageRank(hostname: string, logger: AuditLogger) {
	const result = { pageRank: 'N/A', globalRank: 'N/A' };
	if (!process.env.OPEN_PAGE_RANK_API_KEY) {
		logger.info('openpagerank: skipped, OPEN_PAGE_RANK_API_KEY missing');
		return result;
	}

	try {
		logger.info(`openpagerank: requesting for ${hostname}`);
		const response = await axios.get('https://openpagerank.com/api/v1.0/getPageRank', {
			timeout: 10000,
			params: { 'domains[]': hostname },
			headers: { 'API-OPR': process.env.OPEN_PAGE_RANK_API_KEY }
		});
		const entry = response.data?.response?.[0];
		result.pageRank =
			entry?.page_rank_decimal != null ? Number(entry.page_rank_decimal).toFixed(2) : 'N/A';
		result.globalRank = entry?.rank ? Number(entry.rank).toLocaleString() : 'N/A';
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		logger.warn(`openpagerank: failed (${message})`);
		return result;
	}

	return result;
}
