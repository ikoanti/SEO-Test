<script lang="ts">
	import AuditFindingRow from '$lib/components/AuditFindingRow.svelte';
	import AuditStatusPills from '$lib/components/AuditStatusPills.svelte';

	type AuditFindingView = {
		id: string;
		status?: string;
		title?: string;
		detail?: string;
		page_url?: string;
		meta?: Record<string, unknown> | null;
	};

	type AuditItemView = {
		id: string;
		key: string;
		label: string;
		status?: string;
		runStatus?: string;
		summary?: string;
		stats?: unknown;
		findings: AuditFindingView[];
	};

	type LegacySection = {
		key: string;
		title: string;
		subtitle?: string;
		mini?: boolean;
	};

	type StatusFilter = 'good' | 'warn' | 'bad';

	let {
		section,
		item,
		selectedStatus = $bindable<StatusFilter | null>(null)
	}: {
		section: LegacySection;
		item?: AuditItemView;
		selectedStatus?: StatusFilter | null;
	} = $props();

	const getRecord = (value: unknown): Record<string, unknown> =>
		value && typeof value === 'object' && !Array.isArray(value)
			? (value as Record<string, unknown>)
			: {};

	function statsText(item?: AuditItemView) {
		const metaStats = item?.findings?.find((finding) => finding.meta)?.meta;
		const stats = getRecord(metaStats).stats;
		return typeof stats === 'string' ? stats : item?.summary || '';
	}

	function statPills(item?: AuditItemView) {
		const findings = item?.findings || [];
		return {
			good: findings.filter((finding) => finding.status === 'ok').length,
			warn: findings.filter((finding) => finding.status === 'warn').length,
			bad: findings.filter((finding) => finding.status === 'err').length
		};
	}

	function linkLabel(url: string) {
		try {
			const parsed = new URL(url);
			const label = `${parsed.pathname}${parsed.search}` || '/';
			return label.length > 55 ? `${label.slice(0, 55)}...` : label;
		} catch {
			return url.length > 55 ? `${url.slice(0, 55)}...` : url;
		}
	}

	const pills = $derived(statPills(item));
	const targetStatusForFilter: Record<StatusFilter, 'ok' | 'warn' | 'err'> = {
		good: 'ok',
		warn: 'warn',
		bad: 'err'
	};
	const filteredFindings = $derived.by(() => {
		if (!item?.findings?.length || !selectedStatus) {
			return item?.findings || [];
		}

		const targetStatus = targetStatusForFilter[selectedStatus];
		return item.findings.filter((finding) => finding.status === targetStatus);
	});
	const showSummaryRow = $derived(
		Boolean(
			item &&
			!item.findings?.length &&
			(!selectedStatus || item.status === targetStatusForFilter[selectedStatus])
		)
	);
	const summaryItem = $derived(showSummaryRow ? item : undefined);
	const showEmptyRow = $derived(Boolean(!item));
</script>

<div class="card audit-finding-card" id={`card-${section.key}`}>
	<h3>{section.title}</h3>
	{#if section.subtitle || statsText(item)}
		<p class="subtitle">{statsText(item) || section.subtitle}</p>
	{/if}
	{#if section.mini}
		<AuditStatusPills good={pills.good} warn={pills.warn} bad={pills.bad} bind:selectedStatus />
	{/if}
	{#if section.key === 'internalLinks'}
		<div class="links-summary">
			<div class="stat"><span>{pills.good + pills.warn + pills.bad}</span> Total</div>
			<div class="stat"><span class="error">{pills.bad}</span> Broken</div>
		</div>
	{/if}
	<ul class={`check-list ${section.mini ? 'mini-list' : ''}`}>
		{#if filteredFindings.length}
			{#each filteredFindings as finding, index (`${item?.id || section.key}-${index}`)}
				<AuditFindingRow
					status={(finding.status as 'ok' | 'warn' | 'err' | 'info' | undefined) || 'info'}
					title={finding.title || finding.status || 'Finding'}
					detail={finding.detail}
					href={finding.page_url}
					hrefLabel={finding.page_url ? linkLabel(finding.page_url) : undefined}
					codeSnippet={typeof finding.meta?.codeSnippet === 'string'
						? finding.meta.codeSnippet
						: undefined}
				/>
			{/each}
		{:else if summaryItem}
			<AuditFindingRow
				status={(summaryItem.status as 'ok' | 'warn' | 'err' | 'info' | undefined) || 'info'}
				title={summaryItem.summary || 'No findings.'}
			/>
		{:else if showEmptyRow}
			<AuditFindingRow status="info" title="No persisted result for this check." />
		{/if}
	</ul>
</div>

<style>
	.audit-finding-card {
		width: 100%;
		max-width: 800px;
		padding: 1.5rem;
		border-radius: 1rem;
	}

	.audit-finding-card h3 {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin: 0 0 1rem;
		padding-bottom: 0.5rem;
		border-bottom: 1px solid var(--border);
		font-size: 1.25rem;
		font-weight: 600;
	}

	.subtitle {
		margin: -0.5rem 0 1rem;
		color: var(--text-muted);
		font-size: 0.85rem;
	}

	.links-summary {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		margin-bottom: 1rem;
	}

	.links-summary .stat {
		padding: 0.35rem 0.7rem;
		border-radius: 999px;
		background: rgba(0, 0, 0, 0.2);
		font-size: 0.8rem;
		font-weight: 600;
	}

	.links-summary .stat span {
		font-size: 1.1rem;
		font-weight: 700;
	}

	.error {
		color: #fca5a5;
	}

	.check-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 0;
		margin: 0;
		list-style: none;
	}
</style>
