<script lang="ts">
	import { resolve } from '$app/paths';
	import { Plus, Search, X } from 'lucide-svelte';
	import { tick } from 'svelte';
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
	let auditUrls = $state<string[]>(['']);

	$effect(() => {
		if (form?.createError) {
			createSheetOpen = true;
			auditUrls = Array.isArray(form.urls) && form.urls.length ? form.urls : [''];
		}
	});

	function openCreateSheet() {
		createSheetOpen = true;
		if (!auditUrls.length) auditUrls = [''];
	}

	function closeCreateSheet() {
		createSheetOpen = false;
	}

	function splitUrls(value: string) {
		return value
			.split(',')
			.map((url) => url.trim())
			.filter(Boolean);
	}

	function auditUrlCount() {
		return auditUrls.filter((url) => url.trim()).length;
	}

	function focusAuditUrl(index: number) {
		void tick().then(() => {
			const input = document.querySelector<HTMLInputElement>(`[data-audit-url-index="${index}"]`);
			input?.focus();
		});
	}

	function updateAuditUrl(index: number, value: string) {
		if (value.includes(',')) {
			const urls = splitUrls(value);
			if (!urls.length) return;

			const next = [...auditUrls];
			next.splice(index, 1, ...urls, '');
			auditUrls = next;
			focusAuditUrl(index + urls.length);
			return;
		}

		auditUrls = auditUrls.map((url, itemIndex) => (itemIndex === index ? value : url));
	}

	function handleAuditUrlInput(index: number, event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		updateAuditUrl(index, input.value);
	}

	function handleAuditUrlKeydown(index: number, event: KeyboardEvent) {
		if (event.key !== 'Enter') return;

		event.preventDefault();
		const value = (event.currentTarget as HTMLInputElement).value.trim();
		if (!value) return;

		const next = [...auditUrls];
		next.splice(index + 1, 0, '');
		auditUrls = next;
		focusAuditUrl(index + 1);
	}

	function removeAuditUrl(index: number) {
		auditUrls = auditUrls.filter((_, itemIndex) => itemIndex !== index);
		if (!auditUrls.length) auditUrls = [''];
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
	<div class="audit-create-sheet" aria-label="Create audits" aria-modal="true" role="dialog">
		<div class="sheet-header">
			<div>
				<h2>Create audits</h2>
				<p class="muted">Paste comma-separated URLs or press Enter to add another website.</p>
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
			<div class="audit-url-fields">
				{#each auditUrls as url, index (index)}
					<div class="audit-url-field">
						<input
							name="urls"
							type="text"
							inputmode="url"
							value={url}
							placeholder={index === 0 ? 'example.com' : 'another-site.com'}
							aria-label={`Audit URL ${index + 1}`}
							data-audit-url-index={index}
							oninput={(event) => handleAuditUrlInput(index, event)}
							onkeydown={(event) => handleAuditUrlKeydown(index, event)}
						/>
						<button
							type="button"
							class="field-remove"
							aria-label={`Remove URL field ${index + 1}`}
							disabled={auditUrls.length === 1 && !url.trim()}
							onclick={() => removeAuditUrl(index)}
						>
							<X size={16} />
						</button>
					</div>
				{/each}
			</div>

			{#if form?.createError}
				<p class="error sheet-error">{form.createError}</p>
			{/if}

			<div class="sheet-actions">
				<button type="button" class="ghost-button" onclick={closeCreateSheet}>Cancel</button>
				<button type="submit" class="icon-button" disabled={auditUrlCount() === 0}>
					<Plus size={18} />
					<span>Run {auditUrlCount() > 1 ? `${auditUrlCount()} audits` : 'audit'}</span>
				</button>
			</div>
		</form>
	</div>
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
		top: 50%;
		left: 50%;
		z-index: 100;
		display: flex;
		width: min(560px, calc(100% - 32px));
		max-height: calc(100vh - 48px);
		transform: translate(-50%, -50%);
		flex-direction: column;
		gap: 24px;
		padding: 28px;
		overflow: auto;
		border: 1px solid var(--border-color);
		border-radius: 28px;
		background: rgba(17, 24, 34, 0.98);
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
	.field-remove {
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

	.audit-url-fields {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.audit-url-field {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 10px;
		align-items: center;
	}

	.audit-url-field input {
		width: 100%;
	}

	.field-remove {
		width: 44px;
		height: 44px;
		border: 1px solid var(--border-color);
		border-radius: 999px;
		color: var(--text-muted);
	}

	.field-remove:disabled {
		cursor: not-allowed;
		opacity: 0.35;
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
			width: calc(100% - 24px);
			padding: 22px;
			border-radius: 22px;
		}

		.sheet-actions {
			flex-direction: column-reverse;
		}
	}
</style>
