<script lang="ts">
	import { AlertTriangle, CheckCircle2, CircleX, Info } from 'lucide-svelte';

	type RowStatus = 'ok' | 'warn' | 'err' | 'info';

	let {
		status = 'info',
		title,
		detail = '',
		href,
		hrefLabel,
		codeSnippet
	}: {
		status?: RowStatus;
		title: string;
		detail?: string;
		href?: string;
		hrefLabel?: string;
		codeSnippet?: string;
	} = $props();
</script>

<li class="finding-row">
	<div class="check-status">
		<span class={`status-icon status-${status}`}>
			{#if status === 'ok'}
				<CheckCircle2 size={18} strokeWidth={2.3} />
			{:else if status === 'warn'}
				<AlertTriangle size={18} strokeWidth={2.3} />
			{:else if status === 'err'}
				<CircleX size={18} strokeWidth={2.3} />
			{:else}
				<Info size={18} strokeWidth={2.3} />
			{/if}
		</span>
		{title}
	</div>
	{#if detail}
		<div class="check-detail">{detail}</div>
	{/if}
	{#if href}
		<div class="check-detail">
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
			<a class="check-link" {href} target="_blank" rel="noopener">
				{hrefLabel || href}
			</a>
		</div>
	{/if}
	{#if codeSnippet}
		<div class="code-snippet-container">
			<pre><code>{codeSnippet}</code></pre>
		</div>
	{/if}
</li>

<style>
	.finding-row {
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

	.status-icon {
		display: inline-flex;
		flex: 0 0 auto;
	}

	.status-ok {
		color: var(--success);
	}

	.status-warn {
		color: var(--warning);
	}

	.status-err {
		color: var(--danger);
	}

	.status-info {
		color: #60a5fa;
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
