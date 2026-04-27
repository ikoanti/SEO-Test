import axios from 'axios';
import Anthropic from '@anthropic-ai/sdk';
import { env } from '$env/dynamic/private';
import { getCollectionNames } from '$lib/server/pocketbase';

const USER_AGENT =
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

function getAnthropicClient() {
	if (!env.ANTHROPIC_API_KEY) {
		throw new Error('ANTHROPIC_API_KEY is not configured on the server.');
	}

	return new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
}

export function getPocketBaseStatus() {
	const collections = getCollectionNames();
	const missing = [];

	if (!env.POCKETBASE_URL) missing.push('POCKETBASE_URL');

	return {
		configured: missing.length === 0,
		missing,
		url: env.POCKETBASE_URL || 'http://127.0.0.1:8090',
		authCollection: collections.auth,
		websitesCollection: collections.websites,
		auditsCollection: collections.audits,
		workflowsCollection: collections.workflows,
		runsCollection: collections.runs,
		auditFindingTypesCollection: collections.auditFindingTypes,
		auditFindingsCollection: collections.auditFindings
	};
}

export async function fetchOpenPageRank(domain: string) {
	if (!env.OPEN_PAGE_RANK_API_KEY) {
		throw new Error('OPEN_PAGE_RANK_API_KEY is not configured on the server');
	}

	const response = await axios.get('https://openpagerank.com/api/v1.0/getPageRank', {
		params: { 'domains[]': domain },
		headers: { 'API-OPR': env.OPEN_PAGE_RANK_API_KEY },
		timeout: 10000
	});

	return response.data;
}

export async function fetchProxyText(url: string) {
	const response = await axios.get(url, {
		headers: { 'User-Agent': USER_AGENT },
		timeout: 10000
	});

	return response.data;
}

export async function checkRedirect(url: string) {
	const response = await axios.get(url, {
		headers: { 'User-Agent': USER_AGENT },
		timeout: 8000,
		maxRedirects: 0,
		validateStatus: (status) => status >= 200 && status < 400
	});

	const isRedirect = response.status >= 300 && response.status < 400;
	return {
		status: response.status,
		isRedirect,
		location: isRedirect ? response.headers.location || null : null
	};
}

function extractJsonObject(text: string) {
	const cleaned = text
		.trim()
		.replace(/^```json\s*/i, '')
		.replace(/^```\s*/i, '')
		.replace(/```$/i, '');
	const start = cleaned.indexOf('{');
	const end = cleaned.lastIndexOf('}');

	if (start === -1 || end === -1 || end < start) {
		throw new Error('Invalid JSON response from model.');
	}

	return cleaned.slice(start, end + 1);
}

export async function parsePdfMetrics(pdfBase64: string) {
	const anthropic = getAnthropicClient();
	const prompt = `You are an AI that extracts specific metrics from an SEO PDF report.
Please look at the provided document and extract the following exact numbers/values:
1. AI Visibility (number scale 0-100)
2. Monthly Audience (string e.g. "2.87M")
3. Mentions (number)
4. Cited Pages (number)
5. Your Performing Topics (number)
6. Topic Opportunities (string e.g. "2.52K")
7. Cited Sources (number)
8. Source Opportunities (string e.g. "13.68K")

Return the result STRICTLY as a JSON object with these exact keys:
"aiVisibility", "monthlyAudience", "mentions", "citedPages", "performingTopics", "topicOpportunities", "citedSources", "sourceOpportunities".`;

	const message = await anthropic.messages.create({
		model: 'claude-sonnet-4-6',
		max_tokens: 1024,
		messages: [
			{
				role: 'user',
				content: [
					{
						type: 'document',
						source: {
							type: 'base64',
							media_type: 'application/pdf',
							data: pdfBase64
						}
					},
					{
						type: 'text',
						text: prompt
					}
				]
			}
		]
	});

	const text = message.content[0].type === 'text' ? message.content[0].text : '{}';
	return JSON.parse(extractJsonObject(text));
}
