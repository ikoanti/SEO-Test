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

function buildReportPrompt(domain: string, auditData: unknown) {
	return `You are a highly critical, senior SEO consultant and skilled HTML designer. Based on the following audit data for the website "${domain}", generate a comprehensive, unsparing Technical SEO & AI Audit report as styled HTML.

OUTPUT FORMAT: Return ONLY the inner HTML content (no <html>, <head>, or <body> tags). Use inline CSS styles on every element for self-contained styling.

DESIGN REQUIREMENTS:
- Simple, clean document styling resembling a regular Google Doc or printed report (white/light background #ffffff, dark text #333333, muted text #666666). NO dark mode backgrounds.
- Data visualization: Include HTML/CSS based bar charts, circular progress rings, and gauge charts to visualize key metrics.
- Visual elements:
  1. Header banner: domain name + "Mini Technical SEO & AI Audit" title, clean white background with a subtle bottom border or very light gray shading (#f8f9fa)
  2. "Audit Snapshot" section: colored metric circles for PageSpeed Mobile, Desktop, Passed/Warnings/Failed counts. Green (#10b981) good, orange (#f59e0b) warnings, red (#ef4444) failures
  3. Horizontal pass/warn/fail progress bar
  4. Problem cards: clean white background (#ffffff), 4px left border colored by priority — red (#ef4444) for Urgent, orange (#f59e0b) for High, yellow (#eab308) for Medium. Clean square or slightly rounded corners (4px), light gray border (1px solid #e5e7eb), subtle shadow, 20px padding, 16px margin-bottom
  5. Quick Win cards: same style but 4px GREEN (#10b981) left border
  6. Emoji: ❌ for failures/Urgent, ⚠️ for High, 🔶 for Medium, ✅ for Quick Wins

TEMPLATE STRUCTURE (follow EXACTLY):

═══ SECTION 1 — HEADER ═══
"Mini Technical SEO & AI Audit" with domain name, styled as a gradient banner.

═══ SECTION 2 — OVERVIEW ═══
"We conducted a strict evaluation of the technical and AI optimization status of ${domain}. We analyzed a fraction of the 285 total factors included in our FULL audit, and frankly, the results show significant room for improvement. The goal of this document is to expose the exact structural, technical, and speed bottlenecks that are currently sabotaging your rankings, AI visibility, and user experience."

═══ SECTION 3 — AUDIT SNAPSHOT & AI VISIBILITY ═══
Visual metrics dashboard with pass/warn/fail counts and progress bars.
Create a dedicated "Speed Index & Performance" sub-section: Include CSS-based visual gauges, data cards, or bar charts for PageSpeed Mobile/Desktop scores, and explicitly highlight Speed Index metrics (FCP, LCP, CLS, TBT) using styled visual boxes or progress rings. Comment critically on these scores and their negative impact on user retention and rankings.
Include a "Domain Authority" sub-section featuring Open Page Rank data: Create a beautiful visual representation (e.g., a styled badge, rank bar, or data card) for the Page Rank and Global Rank, commenting on site authority.
Include a critical "AI Visibility" sub-section with commentary on: AI Visibility Score, Monthly Audience, Mentions, Topic Opportunities — highlight how the current AI visibility is leaving massive opportunities on the table. Create CSS-based illustrations (bar charts or gauge charts) for these scores.

═══ SECTION 4 — CHALLENGES (Problems) ═══
Heading: "🔴 Challenges"
Intro paragraph: "In our evaluation of the current technical optimization status of ${domain} we identified problems and errors with the site architecture. These exact problems are among the top reasons why you're not ranking for more of your target keywords."

Then list EVERY SINGLE failed and warning issue from the audit data as a numbered Problem card. Each card MUST follow this EXACT format:

<div style="background:#ffffff; border-left:4px solid [COLOR_BY_PRIORITY]; border:1px solid #e5e7eb; border-radius:4px; padding:20px; margin-bottom:16px; box-shadow:0 1px 3px rgba(0,0,0,0.1);">
  <h3 style="color:[COLOR_BY_PRIORITY]; margin:0 0 4px 0;">[EMOJI] Problem N: [Descriptive Title]</h3>
  <div style="color:#666666; font-size:0.85rem; margin-bottom:12px;">Priority: [Urgent | High | Medium]</div>
  <p style="color:#333333; line-height:1.7;">[2-4 paragraphs of detailed explanation with exact numbers from the audit data. Explain WHY this is a problem, what the negative SEO/traffic/conversion impact is, and what fixing it would achieve.]</p>
</div>

═══ SECTION 5 — QUICK WINS ═══
Heading: "⚡ Quick Wins"
List 2-4 easy-to-fix items from the audit data as green-bordered cards using the same card format but with green (#10b981) left border and ✅ emoji.

═══ SECTION 6 — SUMMARY ═══
Heading: "📋 Summary"
"${domain} is an established website with valuable assets, links and content and many uncaptured opportunities, but also problems… In order to rank for more keywords, as well as rank higher for existing ones and outrank your competitors, we'd highly suggest taking care of the issues mentioned above."

AUDIT DATA (JSON):
${JSON.stringify(auditData)}

IMPORTANT RULES:
1. Extract and explain every failed check and warning in the audit data.
2. Return ONLY HTML content.
3. Every element MUST have inline styles.`;
}

export async function generateReportHtml(domain: string, auditData: unknown) {
	const anthropic = getAnthropicClient();
	const message = await anthropic.messages.create({
		model: 'claude-sonnet-4-6',
		max_tokens: 8192,
		messages: [{ role: 'user', content: buildReportPrompt(domain, auditData) }]
	});

	return message.content[0].type === 'text' ? stripCodeFence(message.content[0].text) : '';
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

function stripCodeFence(text: string) {
	return text
		.trim()
		.replace(/^```html\s*/i, '')
		.replace(/^```\s*/i, '')
		.replace(/```$/i, '')
		.trim();
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
