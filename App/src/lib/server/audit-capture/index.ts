import { captureAuditSidebarScreenshot } from './renderer';

type SidebarTab = {
	id: string;
	label: string;
};

const SIDEBAR_TABS: SidebarTab[] = [
	{ id: 'ai-bot-visibility', label: 'Unoptimized Robots.txt' },
	{ id: 'image-alts', label: 'Unoptimized Alt Tags' },
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

export async function captureHeadingEvidence(
	domain: string,
	entries: Array<{ page: string; issue: string }>
) {
	if (!entries.length) return null;
	return captureAuditSidebarScreenshot({
		pageUrl: entries[0].page,
		sidebarData: buildSidebarData('headings', {
			kind: 'headings',
			title: 'Unoptimized Heading Tags',
			description:
				'Important pages are missing strong heading structure, which weakens topical clarity and makes page hierarchy less obvious to search engines.',
			domain,
			count: entries.length,
			entries
		})
	});
}

export async function captureImageAltEvidence(
	domain: string,
	entries: Array<{ page: string; image: string }>
) {
	if (!entries.length) return null;
	return captureAuditSidebarScreenshot({
		pageUrl: entries[0].page,
		sidebarData: buildSidebarData('image-alts', {
			kind: 'image-alts',
			title: 'Unoptimized Alt Tags',
			description:
				'Important product and collection images are missing descriptive alt text, reducing image search discoverability and weakening crawler context.',
			domain,
			count: entries.length,
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
