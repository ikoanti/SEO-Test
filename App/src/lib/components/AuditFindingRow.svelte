<script lang="ts">
	import type { AuditFindingStatus } from '$lib/audit-status';
	import {
		AlertTriangle,
		CheckCircle2,
		ChevronDown,
		ChevronUp,
		CircleX,
		Info
	} from 'lucide-svelte';

	let {
		status = 'info' as AuditFindingStatus,
		title,
		detail = '',
		href,
		codeSnippet,
		clickable = false,
		expanded = false,
		onactivate
	}: {
		status?: AuditFindingStatus;
		title: string;
		detail?: string;
		href?: string;
		codeSnippet?: string;
		clickable?: boolean;
		expanded?: boolean;
		onactivate?: (() => void) | undefined;
	} = $props();

	const isUrlLike = (value?: string) => {
		if (!value) return false;
		try {
			new URL(value);
			return true;
		} catch {
			return false;
		}
	};

	const primaryText = $derived.by(() => {
		if (clickable) {
			return title;
		}

		if (href && detail && (isUrlLike(title) || title === href)) {
			return detail;
		}

		return title;
	});

	const secondaryDetail = $derived.by(() => {
		if (clickable) {
			return detail;
		}

		if (href && detail && (isUrlLike(title) || title === href)) {
			return '';
		}

		return detail;
	});
</script>

<li class={`finding-row finding-row-${status}`}>
	{#if clickable}
		<button type="button" class="check-trigger" onclick={onactivate}>
			<span class="check-status">
				<span class={`status-icon status-${status}`}>
					{#if status === 'pass'}
						<CheckCircle2 size={18} strokeWidth={2.3} />
					{:else if status === 'warn'}
						<AlertTriangle size={18} strokeWidth={2.3} />
					{:else if status === 'fail'}
						<CircleX size={18} strokeWidth={2.3} />
					{:else}
						<Info size={18} strokeWidth={2.3} />
					{/if}
				</span>
				<span>{title}</span>
			</span>
			<span class="trigger-icon">
				{#if expanded}
					<ChevronUp size={16} strokeWidth={2.3} />
				{:else}
					<ChevronDown size={16} strokeWidth={2.3} />
				{/if}
			</span>
		</button>
	{:else}
		<div class="check-status">
			<span class={`status-icon status-${status}`}>
				{#if status === 'pass'}
					<CheckCircle2 size={18} strokeWidth={2.3} />
				{:else if status === 'warn'}
					<AlertTriangle size={18} strokeWidth={2.3} />
				{:else if status === 'fail'}
					<CircleX size={18} strokeWidth={2.3} />
				{:else}
					<Info size={18} strokeWidth={2.3} />
				{/if}
			</span>
			{primaryText}
		</div>
	{/if}
	{#if secondaryDetail}
		<div class="check-detail">{secondaryDetail}</div>
	{/if}
	{#if href}
		<div class="check-detail">
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
			<a class="check-link" {href} target="_blank" rel="noopener">
				{href}
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
		border: 1px solid rgba(255, 255, 255, 0.06);
		border-radius: 0.5rem;
		background: rgba(0, 0, 0, 0.2);
		font-size: 0.95rem;
	}

	.finding-row-pass {
		border-color: rgba(16, 185, 129, 0.24);
		background: rgba(16, 185, 129, 0.08);
	}

	.finding-row-warn {
		border-color: rgba(245, 158, 11, 0.24);
		background: rgba(245, 158, 11, 0.08);
	}

	.finding-row-fail {
		border-color: rgba(239, 68, 68, 0.24);
		background: rgba(239, 68, 68, 0.08);
	}

	.finding-row-info {
		border-color: color-mix(in srgb, var(--status-info) 24%, transparent);
		background: color-mix(in srgb, var(--status-info) 8%, transparent);
	}

	.check-status {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-weight: 500;
	}

	.check-trigger {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		width: 100%;
		padding: 0;
		border: 0;
		background: transparent;
		color: inherit;
		text-align: left;
	}

	.status-icon {
		display: inline-flex;
		flex: 0 0 auto;
	}

	.trigger-icon {
		display: inline-flex;
		flex: 0 0 auto;
		color: var(--text-muted);
	}

	.status-pass {
		color: var(--status-pass);
	}

	.status-warn {
		color: var(--status-warn);
	}

	.status-fail {
		color: var(--status-fail);
	}

	.status-info {
		color: var(--status-info);
	}

	.check-detail {
		color: var(--text-muted);
		font-size: 0.85rem;
		word-break: break-word;
	}

	.check-link {
		color: var(--status-info);
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
	}

	.code-snippet-container pre {
		margin: 0;
		padding: 0;
		background: transparent;
		color: #e2e8f0;
		font-size: 0.85rem;
	}
</style>
