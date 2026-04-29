<script lang="ts">
	import { Bot } from 'lucide-svelte';
	import type { AuditEntry, BasePanelData } from '../types';
	import amazonLogo from '$lib/assets/bot-logos/amazon.png';
	import anthropicLogo from '$lib/assets/bot-logos/anthropic.png';
	import appleLogo from '$lib/assets/bot-logos/apple.png';
	import baiduLogo from '$lib/assets/bot-logos/baidu.png';
	import bingLogo from '$lib/assets/bot-logos/bing.png';
	import bytedanceLogo from '$lib/assets/bot-logos/bytedance.png';
	import claudeLogo from '$lib/assets/bot-logos/claude.png';
	import duckduckgoLogo from '$lib/assets/bot-logos/duckduckgo.png';
	import facebookLogo from '$lib/assets/bot-logos/facebook.png';
	import googleLogo from '$lib/assets/bot-logos/google.png';
	import openaiLogo from '$lib/assets/bot-logos/openai.png';
	import perplexityLogo from '$lib/assets/bot-logos/perplexity.png';
	import yandexLogo from '$lib/assets/bot-logos/yandex.png';

	const EXPECTED_BOTS = [
		'Googlebot',
		'AdsBot-Google',
		'Bingbot',
		'Yandex',
		'DuckDuckBot',
		'Baiduspider',
		'GPTBot',
		'ChatGPT',
		'ChatGPT-User',
		'OpenAI',
		'OAI-SearchBot',
		'Google-Extended',
		'anthropic-ai',
		'ClaudeBot',
		'CCBot',
		'PerplexityBot',
		'FacebookBot',
		'Applebot-Extended',
		'Amazonbot',
		'Bytespider'
	];

	let { panel }: { panel?: BasePanelData & { foundAgents?: string[] } } = $props();

	const BOT_BADGES: Record<
		string,
		{
			label: string;
			logo?: string;
		}
	> = {
		Googlebot: { label: 'Google', logo: googleLogo },
		'AdsBot-Google': { label: 'Google Ads', logo: googleLogo },
		Bingbot: { label: 'Bing', logo: bingLogo },
		Yandex: { label: 'Yandex', logo: yandexLogo },
		DuckDuckBot: { label: 'DuckDuckGo', logo: duckduckgoLogo },
		Baiduspider: { label: 'Baidu', logo: baiduLogo },
		GPTBot: { label: 'GPTBot', logo: openaiLogo },
		ChatGPT: { label: 'ChatGPT', logo: openaiLogo },
		'ChatGPT-User': { label: 'ChatGPT User', logo: openaiLogo },
		OpenAI: { label: 'OpenAI', logo: openaiLogo },
		'OAI-SearchBot': { label: 'OpenAI Search', logo: openaiLogo },
		'Google-Extended': { label: 'Google Extended', logo: googleLogo },
		'anthropic-ai': { label: 'Anthropic', logo: anthropicLogo },
		ClaudeBot: { label: 'Claude', logo: claudeLogo },
		CCBot: { label: 'Common Crawl' },
		PerplexityBot: { label: 'Perplexity', logo: perplexityLogo },
		FacebookBot: { label: 'Facebook', logo: facebookLogo },
		'Applebot-Extended': { label: 'Apple', logo: appleLogo },
		Amazonbot: { label: 'Amazon', logo: amazonLogo },
		Bytespider: { label: 'ByteDance', logo: bytedanceLogo }
	};

	function computeMissingAgents(foundAgents?: string[]) {
		const normalized = Array.isArray(foundAgents) ? foundAgents : [];
		const hasWildcard = normalized.some((agent) => String(agent).trim() === '*');

		return EXPECTED_BOTS.filter((bot) => {
			const hasSpecific = normalized.some(
				(agent) => String(agent).trim().toLowerCase() === bot.toLowerCase()
			);
			if (bot.toLowerCase() === 'googlebot' && !hasSpecific && hasWildcard) {
				return false;
			}
			return !hasSpecific;
		});
	}

	function badgeFor(agent: string) {
		return (
			BOT_BADGES[agent] ?? {
				label: agent
			}
		);
	}

	function agentFromIssue(issue?: string) {
		const normalizedIssue = String(issue ?? '').toLowerCase();
		return EXPECTED_BOTS.find((bot) => normalizedIssue.includes(bot.toLowerCase()));
	}

	function issueRows(entries?: AuditEntry[]) {
		if (!Array.isArray(entries)) return [];
		return entries
			.filter((entry) => entry.issue)
			.toSorted((first, second) => {
				const firstIcon = badgeFor(agentFromIssue(first.issue) ?? first.issue ?? '');
				const secondIcon = badgeFor(agentFromIssue(second.issue) ?? second.issue ?? '');
				if (Boolean(firstIcon.logo) === Boolean(secondIcon.logo)) return 0;
				return firstIcon.logo ? -1 : 1;
			});
	}

	function missingAgentRows(agents: string[]) {
		return agents.toSorted((first, second) => {
			const firstIcon = badgeFor(first);
			const secondIcon = badgeFor(second);
			if (Boolean(firstIcon.logo) === Boolean(secondIcon.logo)) return 0;
			return firstIcon.logo ? -1 : 1;
		});
	}

	let missingAgents = $derived(computeMissingAgents(panel?.foundAgents));
	let sortedMissingAgents = $derived(missingAgentRows(missingAgents));
	let rows = $derived(issueRows(panel?.entries));
	let summaryCount = $derived(rows.length ? rows.length : missingAgents.length);
	let summaryLabel = $derived(rows.length ? 'Issues' : 'Missing');
</script>

<section class="section">
	<h1 class="title">{panel?.title ?? 'Unoptimized Robots.txt'}</h1>
	<p class="copy">{panel?.description ?? ''}</p>
</section>
<section class="section">
	<div class="summary">
		<p class="summary-label">{summaryLabel}</p>
		<p class="summary-count">{panel?.count ?? summaryCount}</p>
		<p class="summary-note">AI crawler robots.txt findings on {panel?.domain ?? 'this domain'}</p>
	</div>
</section>
<section class="section">
	<div class="list">
		{#if rows.length}
			{#each rows as entry}
				{@const agent = agentFromIssue(entry.issue)}
				{@const icon = badgeFor(agent ?? entry.issue ?? '')}
				<article class="card compact" class:blocked={entry.status === 'fail'}>
					<div class="card-head">
						<div class="bot-logo-wrap" aria-hidden="true">
							{#if icon.logo}
								<img class="bot-logo" src={icon.logo} alt="" />
							{:else}
								<div class="bot-logo bot-logo-fallback">
									<Bot size={32} strokeWidth={2.2} />
								</div>
							{/if}
						</div>
						<p class="card-title">{entry.issue}</p>
					</div>
				</article>
			{/each}
		{:else}
			{#each sortedMissingAgents as agent}
				{@const icon = badgeFor(agent)}
				<article class="card compact">
					<div class="card-head">
						<div class="bot-logo-wrap" aria-hidden="true">
							{#if icon.logo}
								<img class="bot-logo" src={icon.logo} alt="" />
							{:else}
								<div class="bot-logo bot-logo-fallback">
									<Bot size={32} strokeWidth={2.2} />
								</div>
							{/if}
						</div>
						<p class="card-title">Missing {icon.label}</p>
					</div>
				</article>
			{/each}
		{/if}
	</div>
</section>

<style>
	@import './panel-shared.css';

	.compact {
		padding: 14px 16px;
	}

	.bot-logo-wrap {
		width: 50px;
		height: 50px;
		border-radius: 8px;
		display: grid;
		place-items: center;
		overflow: hidden;
		background: #ffffff;
	}

	.bot-logo {
		width: 100%;
		height: 100%;
		object-fit: contain;
		display: block;
	}

	.bot-logo-fallback {
		background: #f1f3f4;
		color: #5f6368;
		display: grid;
		place-items: center;
	}
</style>
