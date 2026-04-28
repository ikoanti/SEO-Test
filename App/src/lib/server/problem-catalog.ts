import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { AuditReportTemplateRecord } from '$lib/server/pocketbase';

type ProblemMapping = {
	key: string;
	findingTypeKey?: string;
	matchPattern?: string;
};

type ParsedProblem = {
	title: string;
	priority: AuditReportTemplateRecord['priority'];
	body: string;
};

const SOURCE_PATH = resolve(process.cwd(), '../..', '3.2c - List of Texts for Problems.md');

const PROBLEM_MAPPINGS: Record<string, ProblemMapping> = {
	'AI Chatbots/LLMs Not Whitelisted': {
		key: 'ai-chatbots-llms-not-whitelisted',
		findingTypeKey: 'robotsTxt',
		matchPattern: 'GPTBot|Google-Extended|Anthropic|AI|Blocked|Not Specified'
	},
	'Unoptimized Google index': {
		key: 'unoptimized-google-index'
	},
	'Unoptimized page speed': {
		key: 'unoptimized-page-speed',
		findingTypeKey: 'pageSpeed'
	},
	'Multiple H1 tags': {
		key: 'multiple-h1-tags',
		findingTypeKey: 'h1Tags',
		matchPattern: 'multiple h1|empty or multiple'
	},
	'Missing H1 tags': {
		key: 'missing-h1-tags',
		findingTypeKey: 'h1Tags',
		matchPattern: 'missing h1'
	},
	'Missing product schema': {
		key: 'missing-product-schema',
		findingTypeKey: 'structuredData',
		matchPattern: 'No JSON-LD Found'
	},
	'Irrelevant do-follow external domains': {
		key: 'irrelevant-do-follow-external-domains'
	},
	'Unoptimized Heading Tags': {
		key: 'unoptimized-heading-tags',
		findingTypeKey: 'h1Tags',
		matchPattern: 'heading|h1|h2|h3'
	},
	'Meta Titles Are Too Long & Unoptimized': {
		key: 'meta-titles-too-long-unoptimized',
		findingTypeKey: 'metaTitles',
		matchPattern: 'Meta title too long|Missing meta title'
	},
	'Unoptimized Shopify URL structure': {
		key: 'unoptimized-shopify-url-structure',
		findingTypeKey: 'shopifyUrls',
		matchPattern: 'Shopify URL pattern detected'
	},
	'Missing FAQ Schema': {
		key: 'missing-faq-schema',
		findingTypeKey: 'structuredData',
		matchPattern: 'FAQ|No JSON-LD Found'
	},
	'Broken backlinks': {
		key: 'broken-backlinks'
	},
	'Spammy domains pointed to (domain-name)': {
		key: 'spammy-domains-pointed-to-domain'
	},
	'Duplicated Page Titles': {
		key: 'duplicated-page-titles',
		findingTypeKey: 'metaTitles',
		matchPattern: 'Duplicate meta title'
	},
	'Duplicated Meta Descriptions': {
		key: 'duplicated-meta-descriptions',
		findingTypeKey: 'metaTitles',
		matchPattern: 'Duplicate meta description'
	},
	'4xx Broken Pages': {
		key: '4xx-broken-pages',
		findingTypeKey: 'internalLinks',
		matchPattern: '4xx|404|broken'
	},
	'Missing Organization Schema': {
		key: 'missing-organization-schema',
		findingTypeKey: 'structuredData',
		matchPattern: 'No JSON-LD Found'
	},
	'Unlinked Blog': {
		key: 'unlinked-blog'
	},
	'Overly Long Meta Descriptions': {
		key: 'overly-long-meta-descriptions',
		findingTypeKey: 'metaTitles',
		matchPattern: 'Meta description too long'
	},
	'Images with Missing Alt text': {
		key: 'images-with-missing-alt-text',
		findingTypeKey: 'imageAltTags',
		matchPattern: 'Image missing alt text'
	}
};

function parseProblemCatalog(markdown: string): ParsedProblem[] {
	const lines = markdown.split(/\r?\n/);
	const problems: ParsedProblem[] = [];
	let current: ParsedProblem | null = null;
	let awaitingPriority = false;

	const flush = () => {
		if (!current) return;
		current.body = current.body
			.replace(/\[image\d+\]:\s*<data:image\/[^>]+>/g, '')
			.replace(/\(domain-name\)/g, '{{domain}}')
			.replace(/\n{3,}/g, '\n\n')
			.trim();
		if (current.body) problems.push(current);
		current = null;
		awaitingPriority = false;
	};

	for (const line of lines) {
		const titleMatch = line.match(/^\*\*([^*!][^*]+?)\*\*\s*$/);
		const priorityMatch = line.match(/^Priority:\s*(Urgent|High|Medium)\s*$/);

		if (titleMatch) {
			flush();
			current = {
				title: titleMatch[1].trim(),
				priority: 'Medium',
				body: ''
			};
			awaitingPriority = true;
			continue;
		}

		if (current && awaitingPriority) {
			if (priorityMatch) {
				current.priority = priorityMatch[1] as ParsedProblem['priority'];
				awaitingPriority = false;
			}
			continue;
		}

		if (!current) continue;
		if (/^!\[\]\[image\d+\]/.test(line.trim())) continue;
		if (/^\*\*!\[\]\[image\d+\]\*\*/.test(line.trim())) continue;
		if (/^\[image\d+\]:/.test(line.trim())) continue;
		current.body += `${line}\n`;
	}

	flush();
	return problems;
}

function catalogRecord(problem: ParsedProblem, index: number): AuditReportTemplateRecord | null {
	const mapping = PROBLEM_MAPPINGS[problem.title];
	if (!mapping) return null;

	return {
		id: mapping.key,
		key: mapping.key,
		audit_finding_type: mapping.findingTypeKey || '',
		title: problem.title,
		priority: problem.priority,
		match_pattern: mapping.matchPattern || '',
		template_body: problem.body,
		sort_order: index + 1,
		enabled: true,
		expand: mapping.findingTypeKey
			? {
					audit_finding_type: {
						key: mapping.findingTypeKey,
						label: mapping.findingTypeKey
					}
				}
			: undefined
	};
}

let cachedCatalog: AuditReportTemplateRecord[] | null = null;

export function listProblemCatalogTemplates() {
	if (cachedCatalog) return cachedCatalog;

	const markdown = readFileSync(SOURCE_PATH, 'utf8');
	cachedCatalog = parseProblemCatalog(markdown)
		.map(catalogRecord)
		.filter((record): record is AuditReportTemplateRecord => Boolean(record));

	return cachedCatalog;
}
