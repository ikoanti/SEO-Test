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

	function fieldValue(entry: AuditEntry, field: IssueListField) {
		return field.getValue?.(entry) ?? entry[field.key];
	}

	function hasValue(value: unknown) {
		return value !== undefined && value !== null && value !== '';
	}

	function stringValue(value: unknown) {
		return String(value ?? '').trim();
	}

	function evidenceValue(entry: AuditEntry) {
		return (
			stringValue(entry.value) ||
			stringValue(entry.link) ||
			stringValue(entry.property) ||
			stringValue(entry.image) ||
			stringValue(entry.issue) ||
			'Issue detected'
		);
	}

	function bottomLink(entry: AuditEntry) {
		return stringValue(entry.page) || (!entry.page ? stringValue(entry.link) : '');
	}

	function metaFields(entry: AuditEntry) {
		const evidence = evidenceValue(entry);
		const link = bottomLink(entry);
		return fields.filter((field) => {
			const value = fieldValue(entry, field);
			if (!hasValue(value)) return false;
			if (field.key === 'page') return false;
			if (field.key === 'link' && stringValue(value) === link) return false;
			if (stringValue(value) === evidence) return false;
			return true;
		});
	}
</script>

<div class="list">
	{#each entries as entry}
		{#if item}
			{@render item(entry)}
		{:else}
			{@const evidence = evidenceValue(entry)}
			{@const link = bottomLink(entry)}
			{@const visibleMetaFields = metaFields(entry)}
			<article class="card">
				<div class="card-head">
					<div class="badge"><X size={14} strokeWidth={3} aria-hidden="true" /></div>
					<p class="card-title">{evidence}</p>
				</div>
				{#if visibleMetaFields.length}
					<div class="meta">
						{#each visibleMetaFields as field}
							{@const value = fieldValue(entry, field)}
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
						{/each}
					</div>
				{/if}
				{#if link}
					<a class="card-link" href={link} target="_blank" rel="noreferrer">{link}</a>
				{/if}
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

	.card-link {
		display: -webkit-box;
		margin-top: 12px;
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

	.card-link:hover {
		text-decoration: underline;
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
