<script lang="ts">
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

	let { section, item }: { section: LegacySection; item?: AuditItemView } = $props();

	const getRecord = (value: unknown): Record<string, unknown> =>
		value && typeof value === 'object' && !Array.isArray(value)
			? (value as Record<string, unknown>)
			: {};

	const statusClass = (status?: string) =>
		status === 'ok'
			? 'icon-ok'
			: status === 'warn'
				? 'icon-warn'
				: status === 'err'
					? 'icon-err'
					: 'icon-info';

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
</script>

<div class="card audit-finding-card" id={`card-${section.key}`}>
	<h3>{section.title}</h3>
	{#if section.subtitle || statsText(item)}
		<p class="subtitle">{statsText(item) || section.subtitle}</p>
	{/if}
	{#if section.mini}
		<AuditStatusPills good={pills.good} warn={pills.warn} bad={pills.bad} />
	{/if}
	{#if section.key === 'internalLinks'}
		<div class="links-summary">
			<div class="stat"><span>{pills.good + pills.warn + pills.bad}</span> Total</div>
			<div class="stat"><span class="error">{pills.bad}</span> Broken</div>
		</div>
	{/if}
	<ul class={`check-list ${section.mini ? 'mini-list' : ''}`}>
		{#if item?.findings?.length}
			{#each item.findings as finding, index (`${item.id}-${index}`)}
				<li>
					<div class="check-status">
						<span class={statusClass(finding.status)}>
							{finding.status === 'ok'
								? '✅'
								: finding.status === 'warn'
									? '⚠️'
									: finding.status === 'err'
										? '❌'
										: 'ℹ️'}
						</span>
						{finding.title || finding.status || 'Finding'}
					</div>
					{#if finding.detail}
						<div class="check-detail">{finding.detail}</div>
					{/if}
					{#if finding.page_url}
						<div class="check-detail">
							<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
							<a class="check-link" href={finding.page_url} target="_blank" rel="noopener">
								{linkLabel(finding.page_url)}
							</a>
						</div>
					{/if}
					{#if typeof finding.meta?.codeSnippet === 'string' && finding.meta.codeSnippet}
						<div class="code-snippet-container">
							<pre><code>{finding.meta.codeSnippet}</code></pre>
						</div>
					{/if}
				</li>
			{/each}
		{:else if item}
			<li>
				<div class="check-status">
					<span class={statusClass(item.status)}>
						{item.status === 'ok'
							? '✅'
							: item.status === 'warn'
								? '⚠️'
								: item.status === 'err'
									? '❌'
									: 'ℹ️'}
					</span>
					{item.summary || 'No findings.'}
				</div>
			</li>
		{:else}
			<li>
				<div class="check-status">
					<span class="icon-info">ℹ️</span>
					No persisted result for this check.
				</div>
			</li>
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

	.check-list li {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		padding: 0.75rem 1rem;
		border-radius: 0.5rem;
		background: rgba(0, 0, 0, 0.2);
		font-size: 0.95rem;
	}

	.check-status {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-weight: 500;
	}

	.check-detail {
		color: var(--text-muted);
		font-size: 0.85rem;
		word-break: break-word;
	}

	.check-link {
		color: #60a5fa;
		text-decoration: none;
		word-break: break-all;
	}

	.check-link:hover {
		text-decoration: underline;
	}

	.icon-ok {
		color: var(--success);
	}

	.icon-warn {
		color: var(--warning);
	}

	.icon-err {
		color: var(--danger);
	}

	.icon-info {
		color: #60a5fa;
	}

	.code-snippet-container {
		margin-top: 0.75rem;
		padding: 0.75rem 1rem;
		overflow-x: auto;
		border: 1px solid var(--border);
		border-radius: 0.5rem;
		background: #0f172a;
		box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.4);
	}

	.code-snippet-container pre {
		margin: 0;
		padding: 0;
		background: transparent;
		color: #e2e8f0;
		font-size: 0.85rem;
	}
</style>
