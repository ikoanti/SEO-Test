<script lang="ts">
	import { X } from 'lucide-svelte';
	import { isActivePage } from '../helpers';
	import type { AuditEntry, BasePanelData } from '../types';
	import AuditPanel from '../AuditPanel.svelte';
	import IssueList from '../IssueList.svelte';

	type MetaGroup = AuditEntry & { pages: string[] };

	let { panel }: { panel?: BasePanelData & { activePageUrl?: string } } = $props();
	let entries = $derived(Array.isArray(panel?.entries) ? panel.entries : []);

	function sortPagesByActivePage(pages: string[], activePageUrl?: string) {
		if (!Array.isArray(pages)) return [];
		return [...pages].sort((a, b) => {
			const aActive = isActivePage(a, activePageUrl);
			const bActive = isActivePage(b, activePageUrl);
			if (aActive === bActive) return 0;
			return aActive ? -1 : 1;
		});
	}

	function groupEntries(sourceEntries: AuditEntry[], activePageUrl?: string): MetaGroup[] {
		const groups: MetaGroup[] = [];
		const groupedIndexes = new Map<string, number>();

		for (const entry of sourceEntries) {
			const isDuplicate = /^Duplicate meta (title|description) detected$/.test(entry.issue ?? '');
			const groupKey = isDuplicate && entry.value ? `${entry.issue}::${entry.value}` : '';

			if (!groupKey) {
				groups.push({ ...entry, pages: entry.page ? [entry.page] : [] });
				continue;
			}

			if (!groupedIndexes.has(groupKey)) {
				groupedIndexes.set(groupKey, groups.length);
				groups.push({ ...entry, pages: [] });
			}

			const group = groups[groupedIndexes.get(groupKey)!];
			if (entry.page) group.pages.push(entry.page);
		}

		for (const group of groups) {
			group.pages = sortPagesByActivePage(group.pages, activePageUrl);
		}

		return groups.sort((a, b) => {
			const aActive = sortPagesByActivePage(a.pages, activePageUrl)[0];
			const bActive = sortPagesByActivePage(b.pages, activePageUrl)[0];
			const aMatches = isActivePage(aActive, activePageUrl);
			const bMatches = isActivePage(bActive, activePageUrl);
			if (aMatches === bMatches) return 0;
			return aMatches ? -1 : 1;
		});
	}

	let groups = $derived(groupEntries(entries, panel?.activePageUrl));
</script>

{#snippet highlight()}
	<div class="summary">
		<p class="summary-count">{panel?.count ?? entries.length}</p>
		<p class="summary-label">Detected</p>
	</div>
{/snippet}

{#snippet metaItem(entry: MetaGroup)}
	{@const evidence = entry.value || entry.issue || 'Issue detected'}
	<article class="card">
		<div class="card-head">
			<div class="badge"><X size={14} strokeWidth={3} aria-hidden="true" /></div>
			<p class="card-title">{evidence}</p>
		</div>
		{#if entry.pages.length === 1}
			<a class="card-link" href={entry.pages[0]} target="_blank" rel="noreferrer">{entry.pages[0]}</a>
		{:else if entry.pages.length > 1}
			<ul class="card-link-list">
				{#each entry.pages as page}
					<li>
						<a href={page} target="_blank" rel="noreferrer">{page}</a>
					</li>
				{/each}
			</ul>
		{/if}
	</article>
{/snippet}

{#snippet content()}
	<IssueList entries={groups} item={metaItem} />
{/snippet}

<AuditPanel title={panel?.title} {highlight} {content} />

<style>
	@import './panel-shared.css';

	.card-link-list {
		display: grid;
		gap: 6px;
		margin: 12px 0 0;
		padding: 0;
		list-style: none;
	}

	.card-link-list li {
		min-width: 0;
	}

	.card-link-list a {
		display: -webkit-box;
		min-width: 0;
		overflow: hidden;
		color: #2563eb;
		font-size: 12px;
		font-weight: 500;
		line-height: 1.45;
		text-decoration: none;
		text-overflow: ellipsis;
		overflow-wrap: anywhere;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		line-clamp: 2;
	}

	.card-link-list a:hover {
		text-decoration: underline;
	}
</style>
