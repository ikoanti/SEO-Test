<script lang="ts">
	import { resolve } from '$app/paths';
	import { Plus, Search, X } from 'lucide-svelte';
	import type { ActionData } from './$types';

	type AuditListItem = {
		id: string;
		name?: string;
		url: string;
		status?: string;
		targetHref: string;
	};

	let { data, form }: { data: { audits: AuditListItem[]; query: string }; form?: ActionData } =
		$props();
	let createSheetOpen = $state(false);
	let auditUrlInput = $state('');
	let auditUrls = $state<string[]>([]);

	$effect(() => {
		if (form?.createError) {
			createSheetOpen = true;
			auditUrls = Array.isArray(form.urls) ? form.urls : [];
		}
	});

	function openCreateSheet() {
		createSheetOpen = true;
	}

	function closeCreateSheet() {
		createSheetOpen = false;
	}

	function addAuditUrls(value: string) {
		const urls = value
			.split(',')
			.map((url) => url.trim())
			.filter(Boolean);
		if (!urls.length) return;

		auditUrls = [...new Set([...auditUrls, ...urls])];
		auditUrlInput = '';
	}

	function removeAuditUrl(url: string) {
		auditUrls = auditUrls.filter((item) => item !== url);
	}

	function handleAuditUrlInput(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		if (!input.value.includes(',')) return;

		addAuditUrls(input.value);
	}

	function handleAuditUrlKeydown(event: KeyboardEvent) {
		if (event.key !== 'Enter') return;

		event.preventDefault();
		addAuditUrls((event.currentTarget as HTMLInputElement).value);
	}
</script>

<section class="page-head">
	<div>
		<h1>Audits</h1>
		<p class="muted">Create a new audit and open any existing audit result.</p>
	</div>
	<button type="button" class="icon-button audit-create-trigger" onclick={openCreateSheet}>
		<Plus size={18} />
		<span>Audit</span>
	</button>
</section>

<section class="audits-toolbar">
	<form method="GET" class="audit-search-form">
		<input
			name="q"
			type="search"
			value={data.query}
			placeholder="Search audits"
			aria-label="Search audits"
		/>
		<button type="submit" class="icon-button">
			<Search size={18} />
			<span>Search</span>
		</button>
		{#if data.query}
			<a class="clear-link icon-link" href={resolve('/audits')}>
				<X size={16} />
				<span>Clear</span>
			</a>
		{/if}
	</form>
</section>

{#if form?.createError}
	<p class="error toolbar-error">{form.createError}</p>
{/if}

<section class="audit-list-section">
	{#if data.audits.length === 0}
		<p class="empty-state">{data.query ? 'No audits matched your search.' : 'No audits yet.'}</p>
	{:else}
		<ul class="audit-list">
			{#each data.audits as audit (audit.id)}
				<li>
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
					<a href={audit.targetHref}>
						<strong>{audit.url}</strong>
						<span class="muted">Status: {audit.status || 'queued'}</span>
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</section>

{#if createSheetOpen}
	<div class="sheet-backdrop" role="presentation" onclick={closeCreateSheet}></div>
	<aside class="audit-create-sheet" aria-label="Create audits">
		<div class="sheet-header">
			<div>
				<h2>Create audits</h2>
				<p class="muted">Enter one URL, press Enter, or paste a comma-separated list.</p>
			</div>
			<button
				type="button"
				class="sheet-close"
				aria-label="Close create audits"
				onclick={closeCreateSheet}
			>
				<X size={20} />
			</button>
		</div>

		<form method="POST" action="?/create" class="sheet-form">
			<div class="audit-url-combobox">
				{#each auditUrls as url (url)}
					<span class="audit-url-chip">
						{url}
						<button type="button" aria-label={`Remove ${url}`} onclick={() => removeAuditUrl(url)}>
							<X size={14} />
						</button>
					</span>
					<input type="hidden" name="urls" value={url} />
				{/each}
				<input
					name="url"
					type="text"
					inputmode="url"
					bind:value={auditUrlInput}
					placeholder={auditUrls.length ? 'Add another URL' : 'example.com, another-site.com'}
					aria-label="Audit URLs"
					oninput={handleAuditUrlInput}
					onkeydown={handleAuditUrlKeydown}
				/>
			</div>

			{#if form?.createError}
				<p class="error sheet-error">{form.createError}</p>
			{/if}

			<div class="sheet-actions">
				<button type="button" class="ghost-button" onclick={closeCreateSheet}>Cancel</button>
				<button
					type="submit"
					class="icon-button"
					disabled={!auditUrls.length && !auditUrlInput.trim()}
				>
					<Plus size={18} />
					<span>Run {auditUrls.length > 1 ? `${auditUrls.length} audits` : 'audit'}</span>
				</button>
			</div>
		</form>
	</aside>
{/if}

<style>
	.audits-toolbar {
		display: block;
		margin-bottom: 20px;
	}

	.audit-search-form {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.audit-search-form input {
		flex: 1;
	}

	.audit-create-trigger {
		justify-self: end;
	}

	.audit-search-form {
		width: 100%;
	}

	.audit-list {
		display: grid;
		gap: 12px;
		margin-top: 0;
		padding: 0;
		list-style: none;
	}

	.audit-list li {
		padding: 12px 14px;
		border: 1px solid rgba(148, 163, 184, 0.15);
		border-radius: 12px;
		background: rgba(0, 0, 0, 0.2);
	}

	.audit-list li a {
		display: grid;
		gap: 4px;
	}

	.empty-state {
		margin: 0;
		color: var(--text-muted);
	}

	.toolbar-error {
		margin: 0 0 16px;
	}

	.clear-link {
		color: var(--text-muted);
		font-size: 0.95rem;
		white-space: nowrap;
	}

	.sheet-backdrop {
		position: fixed;
		inset: 0;
		z-index: 90;
		background: rgba(4, 7, 18, 0.64);
		backdrop-filter: blur(6px);
	}

	.audit-create-sheet {
		position: fixed;
		top: 0;
		right: 0;
		bottom: 0;
		z-index: 100;
		display: flex;
		width: min(520px, 100%);
		flex-direction: column;
		gap: 24px;
		padding: 28px;
		border-left: 1px solid var(--border-color);
		background: var(--goldenweb-background);
	}

	.sheet-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 16px;
	}

	.sheet-header h2 {
		margin: 0 0 6px;
		color: var(--text-primary);
		font-size: 1.45rem;
	}

	.sheet-close,
	.audit-url-chip button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border: 0;
		background: transparent;
		color: inherit;
		cursor: pointer;
	}

	.sheet-close {
		width: 40px;
		height: 40px;
		border: 1px solid var(--border-color);
		border-radius: 999px;
		color: var(--text-muted);
	}

	.sheet-form {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: 16px;
	}

	.audit-url-combobox {
		display: flex;
		min-height: 140px;
		align-content: flex-start;
		flex-wrap: wrap;
		gap: 10px;
		padding: 14px;
		border: 1px solid var(--border-color);
		border-radius: 20px;
		background: rgba(9, 14, 22, 0.32);
	}

	.audit-url-combobox:focus-within {
		border-color: var(--goldenweb-primary);
	}

	.audit-url-combobox input {
		min-width: min(260px, 100%);
		flex: 1;
		border: 0;
		padding: 8px 2px;
		background: transparent;
	}

	.audit-url-combobox input:focus {
		outline: 0;
	}

	.audit-url-chip {
		display: inline-flex;
		max-width: 100%;
		align-items: center;
		gap: 8px;
		border: 1px solid rgba(255, 197, 61, 0.35);
		border-radius: 999px;
		padding: 8px 10px 8px 12px;
		color: var(--text-primary);
		font-size: 0.92rem;
		font-weight: 800;
	}

	.audit-url-chip button {
		color: var(--goldenweb-primary);
	}

	.sheet-error {
		margin: 0;
	}

	.sheet-actions {
		display: flex;
		justify-content: flex-end;
		gap: 12px;
		margin-top: auto;
	}

	.ghost-button {
		border: 1px solid var(--border-color);
		border-radius: 999px;
		padding: 0.85rem 1.1rem;
		background: transparent;
		color: var(--text-muted);
		font: inherit;
		font-weight: 900;
		cursor: pointer;
	}

	@media (max-width: 900px) {
		.audit-search-form {
			flex-direction: column;
			align-items: stretch;
		}
	}

	@media (max-width: 640px) {
		.audit-create-sheet {
			padding: 22px;
		}

		.sheet-actions {
			flex-direction: column-reverse;
		}
	}
</style>
