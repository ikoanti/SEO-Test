<script module lang="ts">
	import type { AuditEntry } from './types';

	export type IssueListField = {
		label: string;
		key: keyof AuditEntry;
		strong?: boolean;
		preview?: boolean;
		getValue?: (entry: AuditEntry) => unknown;
	};
</script>

<script lang="ts">
	import { X } from 'lucide-svelte';
	import type { Snippet } from 'svelte';
	import FormattedValue from './panels/FormattedValue.svelte';

	let {
		entries = [],
		fields = [],
		item
	}: {
		entries?: AuditEntry[];
		fields?: IssueListField[];
		item?: Snippet<[any]>;
	} = $props();
</script>

<div class="list">
	{#each entries as entry}
		{#if item}
			{@render item(entry)}
		{:else}
			<article class="card">
				<div class="card-head">
					<div class="badge"><X size={14} strokeWidth={3} aria-hidden="true" /></div>
					<p class="card-title">{entry.issue}</p>
				</div>
				<div class="meta">
					{#each fields as field}
						{@const value = field.getValue?.(entry) ?? entry[field.key]}
						{#if value !== undefined && value !== null && value !== ''}
							<div>
								<p class="meta-label">{field.label}</p>
								<p
									class:meta-value-strong={field.strong}
									class:meta-value-preview={field.preview}
									class="meta-value"
								>
									<FormattedValue {value} />
								</p>
							</div>
						{/if}
					{/each}
				</div>
			</article>
		{/if}
	{/each}
</div>

<style>
	.list {
		margin-top: 16px;
		display: grid;
		gap: 12px;
	}

	.card {
		border: 1px solid #e0e3e7;
		border-radius: 14px;
		padding: 14px;
		background: #fff;
		overflow: hidden;
	}

	.card-head {
		display: grid;
		grid-template-columns: 22px 1fr;
		gap: 10px;
		align-items: center;
		min-width: 0;
	}

	.badge {
		width: 22px;
		height: 22px;
		border-radius: 999px;
		display: grid;
		place-items: center;
		font-size: 13px;
		font-weight: 700;
		color: #d93025;
		background: #fce8e6;
	}

	.card-title {
		margin: 0;
		font-size: 15px;
		font-weight: 700;
		line-height: 1.35;
		color: #d93025;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		line-clamp: 2;
	}

	.meta {
		margin-top: 10px;
		display: grid;
		gap: 8px;
		min-width: 0;
	}

	.meta-label {
		margin: 0;
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: #5f6368;
	}

	.meta-value {
		margin: 2px 0 0;
		min-width: 0;
		font-size: 12px;
		line-height: 1.45;
		color: #202124;
		overflow-wrap: anywhere;
		word-break: break-word;
	}

	.meta-value-strong {
		font-weight: 700;
	}

	.meta-value-preview {
		overflow: hidden;
		text-overflow: ellipsis;
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 3;
		line-clamp: 3;
	}
</style>
