import { captureAuditSidebarScreenshot } from './renderer';

type SidebarTab = {
	id: string;
	label: string;
};

const SIDEBAR_TABS: SidebarTab[] = [
	{ id: 'ai-bot-visibility', label: 'Unoptimized Robots.txt' },
	{ id: 'image-alts', label: 'Unoptimized Alt Tags' },
	{ id: 'meta-tags', label: 'Unoptimized Meta Tags' },
	{ id: 'canonicals', label: 'Unoptimized Canonicals' },
	{ id: 'internal-links', label: 'Unoptimized Internal Links' },
	{ id: 'lazy-loading', label: 'Unoptimized Lazy Loading' },
	{ id: 'open-graph', label: 'Unoptimized OpenGraph' },
	{ id: 'content-quality', label: 'Thin Content' },
	{ id: 'bad-google-index', label: 'Bad Google Index' },
	{ id: 'broken-links', label: 'Broken Links' },
	{ id: 'headings', label: 'Unoptimized Heading Tags' }
];

function buildSidebarData(activeTab: string, panel: Record<string, unknown>) {
	return {
		activeTab,
		tabs: SIDEBAR_TABS,
		panels: {
			[activeTab]: panel
		}
	};
}

function isHomepageUrl(value: string) {
	try {
		const url = new URL(value);
		const pathname = url.pathname.replace(/\/+$/, '') || '/';
		return pathname === '/';
	} catch {
		return false;
	}
}

function screenshotPageUrl(entries: Array<{ page: string }>) {
	const firstNonHomepage = entries.find((entry) => entry.page && !isHomepageUrl(entry.page));
	return firstNonHomepage?.page || entries[0]?.page;
}

export async function captureHeadingEvidence(
	domain: string,
	entries: Array<{ page: string; issue: string }>,
	count = entries.length
) {
	if (!entries.length) return null;
	return captureAuditSidebarScreenshot({
		pageUrl: screenshotPageUrl(entries),
		sidebarData: buildSidebarData('headings', {
			kind: 'headings',
			title: 'Unoptimized Heading Tags',
			description:
				'Important pages are missing strong heading structure, which weakens topical clarity and makes page hierarchy less obvious to search engines.',
			domain,
			count,
			entries
		})
	});
}

export async function captureImageAltEvidence(
	domain: string,
	entries: Array<{ page: string; image: string; issue?: string }>,
	count = entries.length
) {
	if (!entries.length) return null;
	return captureAuditSidebarScreenshot({
		pageUrl: screenshotPageUrl(entries),
		sidebarData: buildSidebarData('image-alts', {
			kind: 'image-alts',
			title: 'Unoptimized Alt Tags',
			description:
				'Important product and collection images are missing descriptive alt text, reducing image search discoverability and weakening crawler context.',
			domain,
			count,
			entries
		})
	});
}

export async function captureMetaEvidence(
	domain: string,
	entries: Array<{ page: string; issue: string; value?: string }>,
	count = entries.length
) {
	if (!entries.length) return null;
	const pageUrl = screenshotPageUrl(entries);
	return captureAuditSidebarScreenshot({
		pageUrl,
		sidebarData: buildSidebarData('meta-tags', {
			kind: 'meta-tags',
			title: 'Unoptimized Meta Tags',
			description:
				'Important pages have missing, duplicated, or oversized metadata, which can weaken search result relevance and click-through clarity.',
			domain,
			count,
			activePageUrl: pageUrl,
			entries
		})
	});
}

export async function captureCanonicalEvidence(
	domain: string,
	entries: Array<{ page: string; issue: string; value?: string }>,
	count = entries.length
) {
	if (!entries.length) return null;
	return captureAuditSidebarScreenshot({
		pageUrl: screenshotPageUrl(entries),
		sidebarData: buildSidebarData('canonicals', {
			kind: 'canonicals',
			title: 'Unoptimized Canonicals',
			description:
				'Canonical tags help consolidate ranking signals and clarify the preferred URL for indexed pages.',
			domain,
			count,
			entries
		})
	});
}

export async function captureInternalLinksEvidence(
	domain: string,
	entries: Array<{ page: string; issue: string; count?: number }>,
	count = entries.length
) {
	if (!entries.length) return null;
	return captureAuditSidebarScreenshot({
		pageUrl: screenshotPageUrl(entries),
		sidebarData: buildSidebarData('internal-links', {
			kind: 'internal-links',
			title: 'Unoptimized Internal Links',
			description:
				'Pages with no crawlable internal links create dead ends for users and search crawlers.',
			domain,
			count,
			entries
		})
	});
}

export async function captureLazyLoadingEvidence(
	domain: string,
	entries: Array<{ page: string; issue: string; image?: string }>,
	count = entries.length
) {
	if (!entries.length) return null;
	return captureAuditSidebarScreenshot({
		pageUrl: screenshotPageUrl(entries),
		sidebarData: buildSidebarData('lazy-loading', {
			kind: 'lazy-loading',
			title: 'Unoptimized Lazy Loading',
			description:
				'Images without native lazy loading can increase initial page weight and delay rendering on image-heavy pages.',
			domain,
			count,
			entries
		})
	});
}

export async function captureOpenGraphEvidence(
	domain: string,
	entries: Array<{ page: string; issue: string; property?: string }>,
	count = entries.length
) {
	if (!entries.length) return null;
	return captureAuditSidebarScreenshot({
		pageUrl: screenshotPageUrl(entries),
		sidebarData: buildSidebarData('open-graph', {
			kind: 'open-graph',
			title: 'Unoptimized OpenGraph Tags',
			description:
				'OpenGraph tags control how pages appear when shared and help AI and social surfaces understand page context.',
			domain,
			count,
			entries
		})
	});
}

export async function captureContentQualityEvidence(
	domain: string,
	entries: Array<{ page: string; issue: string; wordCount?: number }>,
	count = entries.length
) {
	if (!entries.length) return null;
	return captureAuditSidebarScreenshot({
		pageUrl: screenshotPageUrl(entries),
		sidebarData: buildSidebarData('content-quality', {
			kind: 'content-quality',
			title: 'Thin Content',
			description:
				'Pages with limited body copy can struggle to communicate topical depth and satisfy search intent.',
			domain,
			count,
			entries
		})
	});
}

export async function captureRobotsEvidence({
	domain,
	robotsUrl,
	storefrontUrl,
	foundAgents
}: {
	domain: string;
	robotsUrl: string;
	storefrontUrl: string;
	foundAgents: string[];
}) {
	return captureAuditSidebarScreenshot({
		pageUrl: robotsUrl,
		fallbackPageUrls: [storefrontUrl],
		sidebarData: buildSidebarData('ai-bot-visibility', {
			kind: 'ai-bot-visibility',
			title: 'Unoptimized Robots.txt',
			description:
				'Robots.txt is missing explicit coverage for important AI and search crawler user-agents, which can limit discovery in ChatGPT, Perplexity, Claude, and modern search tools.',
			domain,
			foundAgents
		})
	});
}
