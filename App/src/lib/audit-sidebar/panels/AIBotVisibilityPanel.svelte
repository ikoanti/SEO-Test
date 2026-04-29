<script lang="ts">
	import type { BasePanelData } from '../types';
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

	let missingAgents = $derived(computeMissingAgents(panel?.foundAgents));
</script>

<section class="section">
	<h1 class="title">{panel?.title ?? 'Unoptimized Robots.txt'}</h1>
	<p class="copy">{panel?.description ?? ''}</p>
</section>
<section class="section">
	<div class="summary">
		<p class="summary-label">Missing</p>
		<p class="summary-count">{missingAgents.length}</p>
		<p class="summary-note">AI crawler user-agents missing on {panel?.domain ?? 'this domain'}</p>
	</div>
</section>
<section class="section">
	<div class="list">
		{#each missingAgents as agent}
			{@const icon = badgeFor(agent)}
			<article class="card compact">
				<div class="card-head">
					<div class="bot-logo-wrap" aria-hidden="true">
						{#if icon.logo}
							<img class="bot-logo" src={icon.logo} alt="" />
						{:else}
							<div class="bot-logo bot-logo-fallback"></div>
						{/if}
					</div>
					<p class="card-title">Missing {icon.label}</p>
				</div>
			</article>
		{/each}
	</div>
</section>

<style>
	@import './panel-shared.css';

	.compact {
		padding: 14px 16px;
	}

	.bot-logo-wrap {
		width: 22px;
		height: 22px;
		border-radius: 6px;
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
	}
</style>
