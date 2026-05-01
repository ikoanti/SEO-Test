<script lang="ts">
	import type { BasePanelData } from '../types';
	import AuditPanel from '../AuditPanel.svelte';

	let { panel }: { panel?: BasePanelData } = $props();

	let entries = $derived(Array.isArray(panel?.entries) ? panel.entries : []);
	let title = $derived(panel?.title || 'Lazy Load Images');

	function displayPage(value?: string) {
		if (!value) return '';

		try {
			const url = new URL(value);
			return `${url.pathname}${url.search}`;
		} catch {
			return value;
		}
	}

	function displayLink(value?: string) {
		if (!value) return '';

		try {
			const url = new URL(value);
			const filename = url.pathname.split('/').filter(Boolean).at(-1);
			return filename ? `${url.hostname}/.../${filename}` : url.hostname;
		} catch {
			return value;
		}
	}
</script>

{#snippet highlight()}
	<div class="summary">
		<p class="summary-count">{panel?.count ?? entries.length}</p>
		<p class="summary-label">Detected</p>
	</div>
{/snippet}

{#snippet content()}
	<div class="image-list">
		{#each entries as entry}
			<article class="image-card">
				<div class="image-frame">
					{#if entry.image}
						<img src={entry.image} alt="" loading="lazy" />
					{:else}
						<div class="image-fallback">Preview unavailable</div>
					{/if}
				</div>
				{#if entry.page}
					<p class="page-link">{displayPage(entry.page)}</p>
				{/if}
				{#if entry.image}
					<p class="image-link">{displayLink(entry.image)}</p>
				{/if}
			</article>
		{/each}
	</div>
{/snippet}

<AuditPanel {title} {highlight} {content} />

<style>
	.summary {
		margin-top: 18px;
		padding: 18px 12px 14px;
		text-align: center;
	}

	.summary-label {
		margin: 8px 0 0;
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: #5f6368;
	}

	.summary-count {
		margin: 0;
		font-size: 64px;
		line-height: 1;
		font-weight: 700;
		color: #d93025;
	}

	.image-list {
		margin-top: 16px;
		display: grid;
		gap: 12px;
	}

	.image-card {
		border: 1px solid #e0e3e7;
		border-radius: 8px;
		padding: 10px;
		background: #fff;
		overflow: hidden;
	}

	.image-frame {
		aspect-ratio: 5 / 4;
		display: grid;
		place-items: center;
		width: 100%;
		overflow: hidden;
		border-radius: 6px;
		background: #f8f9fa;
	}

	.image-frame img {
		width: 100%;
		height: 100%;
		object-fit: contain;
		display: block;
	}

	.image-fallback {
		padding: 12px;
		text-align: center;
		font-size: 12px;
		line-height: 1.4;
		color: #5f6368;
	}

	.page-link {
		margin: 8px 0 0;
		min-width: 0;
		font-size: 12px;
		line-height: 1.45;
		font-weight: 500;
		color: #202124;
		overflow-wrap: anywhere;
		word-break: break-word;
	}

	.image-link {
		margin: 3px 0 0;
		min-width: 0;
		font-size: 11px;
		line-height: 1.4;
		color: #5f6368;
		overflow-wrap: anywhere;
		word-break: break-word;
	}
</style>
