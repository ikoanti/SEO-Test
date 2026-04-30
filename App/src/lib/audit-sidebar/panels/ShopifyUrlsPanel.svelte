<script lang="ts">
	import { X } from 'lucide-svelte';
	import shopifyLogo from '$lib/assets/shopify/shopify-logo.png';
	import type { AuditEntry, BasePanelData } from '../types';
	import AuditPanel from '../AuditPanel.svelte';

	let { panel }: { panel?: BasePanelData } = $props();
	let entries = $derived(Array.isArray(panel?.entries) ? panel.entries : []);

	function groupedByPattern(entries: AuditEntry[]) {
		const groups = new Map<string, string[]>();

		for (const entry of entries) {
			const pattern = String(entry.pattern || '/collections/{collection}/products/{product}').trim();
			const page = String(entry.page || entry.link || '').trim();
			if (!page) continue;

			if (!groups.has(pattern)) groups.set(pattern, []);
			const pages = groups.get(pattern);
			if (pages && !pages.includes(page)) pages.push(page);
		}

		return [...groups.entries()].map(([pattern, pages]) => ({ pattern, pages }));
	}

	const patternGroups = $derived(groupedByPattern(entries));
</script>

{#snippet header()}
	<div class="shopify-brand">
		<img src={shopifyLogo} alt="Shopify" />
		<h1>Unoptimized Shopify URL Structured</h1>
	</div>
{/snippet}

{#snippet content()}
	<div class="pattern-list">
		{#each patternGroups as group (group.pattern)}
			<article class="pattern-card">
				<header class="pattern-head">
					<span class="pattern-badge"><X size={14} strokeWidth={3} aria-hidden="true" /></span>
					<p class="pattern-value">{group.pattern}</p>
				</header>
				<div class="offending-links">
					<ul>
						{#each group.pages as page}
							<li>
								<a href={page} target="_blank" rel="noreferrer">{page}</a>
							</li>
						{/each}
					</ul>
				</div>
			</article>
		{/each}
	</div>
{/snippet}

<AuditPanel {header} {content} />

<style>
	.shopify-brand {
		width: 100%;
		margin: 0 0 16px;
	}

	.shopify-brand img {
		display: block;
		width: 100%;
		height: auto;
		object-fit: contain;
	}

	.shopify-brand h1 {
		margin: 16px 0 0;
		color: #202124;
		font-size: 28px;
		font-weight: 700;
		line-height: 1.08;
	}

	.pattern-list {
		display: grid;
		gap: 12px;
		margin-top: 16px;
	}

	.pattern-card {
		padding: 16px;
		border: 1px solid #e0e3e7;
		border-radius: 14px;
		background: #fff;
		overflow: hidden;
	}

	.pattern-head {
		display: grid;
		grid-template-columns: 22px minmax(0, 1fr);
		gap: 10px;
		align-items: center;
	}

	.pattern-badge {
		display: grid;
		width: 22px;
		height: 22px;
		place-items: center;
		border-radius: 999px;
		color: #d93025;
		background: #fce8e6;
	}

	.pattern-value {
		margin: 0;
		min-width: 0;
		color: #d93025;
		font-size: 15px;
		font-weight: 800;
		line-height: 1.35;
		overflow-wrap: anywhere;
		overflow: hidden;
		text-overflow: ellipsis;
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		line-clamp: 2;
	}

	.offending-links {
		margin-top: 14px;
	}

	.offending-links ul {
		display: grid;
		gap: 8px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.offending-links li {
		min-width: 0;
	}

	.offending-links a {
		color: #2563eb;
		font-size: 12px;
		line-height: 1.45;
		text-decoration: none;
		overflow-wrap: anywhere;
		word-break: break-word;
	}

	.offending-links a:hover {
		text-decoration: underline;
	}
</style>
