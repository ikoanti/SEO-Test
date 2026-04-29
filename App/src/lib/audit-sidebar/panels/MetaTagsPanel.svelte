<script lang="ts">
	import { isActivePage } from '../helpers';
	import type { AuditEntry, BasePanelData } from '../types';
	import FormattedValue from './FormattedValue.svelte';

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

<section class="section">
	<h1 class="title">{panel?.title ?? 'Unoptimized Meta Tags'}</h1>
	<p class="copy">{panel?.description ?? ''}</p>
</section>
<section class="section">
	<div class="summary">
		<p class="summary-label">Detected</p>
		<p class="summary-count">{panel?.count ?? entries.length}</p>
		<p class="summary-note">Meta tag issues found on {panel?.domain ?? 'this domain'}</p>
	</div>
</section>
<section class="section">
	<div class="list">
		{#each groups as entry}
			<article class="card">
				<div class="card-head">
					<div class="badge">x</div>
					<p class="card-title">{entry.issue ?? 'Meta tag issue'}</p>
				</div>
				<div class="meta">
					{#if entry.value}
						<div>
							<p class="meta-label">
								{entry.issue?.includes('description') ? 'Description' : 'Title'}
							</p>
							<p class="meta-value meta-value-strong meta-value-preview">
								<FormattedValue value={entry.value} />
							</p>
						</div>
					{/if}
					{#if entry.pages.length === 1}
						<div>
							<p class="meta-label">Page</p>
							<p class="meta-value"><FormattedValue value={entry.pages[0]} /></p>
						</div>
					{:else if entry.pages.length > 1}
						<div>
							<p class="meta-label">Pages</p>
							<ul class="meta-value-list">
								{#each entry.pages as page}
									<li><FormattedValue value={page} /></li>
								{/each}
							</ul>
						</div>
					{/if}
				</div>
			</article>
		{/each}
	</div>
</section>

<style>
	@import './panel-shared.css';
</style>
