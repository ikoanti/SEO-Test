(function attachAuditDemo(global) {
	const {
		createAuditSidebarData,
		createAIBotVisibilityPanel,
		createBrokenLinkEntry,
		createBrokenLinksPanel,
		createHeadingIssueEntry,
		createHeadingsPanel,
		createImageAltEntry,
		createImageAltsPanel,
		createPlaceholderPanel
	} = global.AutomagicAuditModels;

	global.auditSidebarDemo = createAuditSidebarData({
		activeTab: 'image-alts',
		tabs: [
			{ id: 'ai-bot-visibility', label: 'AI Chatbots/LLMs Not Whitelisted' },
			{ id: 'image-alts', label: 'Unoptimized Alt Tags' },
			{ id: 'bad-google-index', label: 'Bad Google Index' },
			{ id: 'broken-links', label: 'Broken Links' },
			{ id: 'headings', label: 'Unoptimized Heading Tags' }
		],
		panels: {
			'bad-google-index': createPlaceholderPanel({
				kind: 'placeholder',
				title: 'Bad Google Index',
				description: 'Bad Google index panel placeholder.'
			}),
			'image-alts': createImageAltsPanel({
				kind: 'image-alts',
				title: 'Unoptimized Alt Tags',
				description:
					'Important product and collection images are missing descriptive alt text, reducing image search discoverability and weakening crawler context.',
				domain: 'oswaldandsons.com',
				count: 42,
				entries: [
					createImageAltEntry({
						page: 'https://oswaldandsons.com/products/the-deja-vu-tote-bag',
						image: '.../841BE531-F624-4C89-AAC7-DCCB6DC93C66.jpg?v=1742828845&width=3200'
					}),
					createImageAltEntry({
						page: 'https://oswaldandsons.com/collections/the-heritage-collection',
						image: '.../901C4AA0-7441-43F4-A125-966520B0D4AD_copy.jpg?v=1739481049&width=533'
					}),
					createImageAltEntry({
						page: 'https://oswaldandsons.com/pages/holiday-shop',
						image: '.../950d8c382bba7ee6ae3ccbe022955ea0.jpg?v=1762212781&width=3840'
					})
				]
			}),
			'ai-bot-visibility': createAIBotVisibilityPanel({
				kind: 'ai-bot-visibility',
				title: 'AI Chatbots/LLMs Not Whitelisted',
				description:
					'Robots.txt is missing explicit coverage for important AI and search crawler user-agents, which can limit discovery in ChatGPT, Perplexity, Claude, and modern search tools.',
				domain: 'oswaldandsons.com',
				foundAgents: ['*', 'Googlebot', 'AdsBot-Google', 'Bingbot', 'DuckDuckBot']
			}),
			'broken-links': createBrokenLinksPanel({
				kind: 'broken-links',
				title: 'Broken Links',
				description:
					'Important internal links resolve to broken or dead destinations, creating dead ends for visitors and wasting crawl budget.',
				domain: 'oswaldandsons.com',
				count: 3,
				entries: [
					createBrokenLinkEntry({
						page: 'https://oswaldandsons.com/blogs/news',
						link: 'https://oswaldandsons.com/products/old-drop-tee'
					}),
					createBrokenLinkEntry({
						page: 'https://oswaldandsons.com/collections/the-heritage-collection',
						link: 'https://oswaldandsons.com/products/vintage-missing-pin'
					}),
					createBrokenLinkEntry({
						page: 'https://oswaldandsons.com/pages/holiday-shop',
						link: 'https://oswaldandsons.com/collections/holiday-2022'
					})
				]
			}),
			headings: createHeadingsPanel({
				kind: 'headings',
				title: 'Unoptimized Heading Tags',
				description:
					'Important pages are missing strong heading structure, which weakens topical clarity and makes page hierarchy less obvious to search engines.',
				domain: 'oswaldandsons.com',
				count: 3,
				entries: [
					createHeadingIssueEntry({
						page: 'https://oswaldandsons.com/collections/the-heritage-collection',
						issue: 'Missing H1 tag'
					}),
					createHeadingIssueEntry({
						page: 'https://oswaldandsons.com/blogs/news',
						issue: 'Multiple H1 tags found'
					}),
					createHeadingIssueEntry({
						page: 'https://oswaldandsons.com/pages/holiday-shop',
						issue: 'Weak heading hierarchy'
					})
				]
			})
		}
	});
})(window);
