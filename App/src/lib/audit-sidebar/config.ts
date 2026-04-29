import type { AuditPanelData, AuditSidebarData, AuditTab } from './types';

export const SIDEBAR_TABS: AuditTab[] = [
	{ id: 'ai-bot-visibility', label: 'Unoptimized Robots.txt' },
	{ id: 'pagespeed', label: 'PageSpeed Insights' },
	{ id: 'open-page-rank', label: 'Open PageRank' },
	{ id: 'image-alts', label: 'Unoptimized Alt Tags' },
	{ id: 'meta-tags', label: 'Unoptimized Meta Tags' },
	{ id: 'canonicals', label: 'Unoptimized Canonicals' },
	{ id: 'internal-links', label: 'Unoptimized Internal Links' },
	{ id: 'lazy-loading', label: 'Unoptimized Lazy Loading' },
	{ id: 'open-graph', label: 'Unoptimized OpenGraph' },
	{ id: 'content-quality', label: 'Thin Content' },
	{ id: 'shopify-urls', label: 'Unoptimized Shopify URLs' },
	{ id: 'bad-google-index', label: 'Bad Google Index' },
	{ id: 'broken-links', label: 'Broken Links' },
	{ id: 'headings', label: 'Unoptimized Heading Tags' }
];

export function buildSidebarData(
	activeTab: string,
	panel: AuditPanelData | Record<string, unknown>
): AuditSidebarData {
	return {
		activeTab,
		tabs: SIDEBAR_TABS,
		panels: {
			[activeTab]: panel as AuditPanelData
		}
	};
}
