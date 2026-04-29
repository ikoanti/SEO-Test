<script lang="ts">
	import type { BasePanelData } from '../types';

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
			<article class="card compact">
				<div class="card-head">
					<div class="badge">x</div>
					<p class="card-title">Missing {agent}</p>
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
</style>
