<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { Check, Pencil, Plus, RotateCw, Search, Trash2, X } from 'lucide-svelte';
	import { onMount, tick } from 'svelte';
	import type { ActionData } from './$types';

	type AuditListItem = {
		id: string;
		name?: string;
		url: string;
		status?: string;
		queued_at?: string;
		created_at?: string;
		updated_at?: string;
		targetHref: string;
	};
	type WebsiteGroup = {
		website: {
			id?: string;
			url?: string;
			domain?: string;
			display_name?: string;
		};
		audits: AuditListItem[];
	};
	type AuditCreateRow = {
		displayDomain: string;
		domain: string;
	};

	let {
		data,
		form
	}: {
		data: { audits: AuditListItem[]; websites: WebsiteGroup[]; query: string };
		form?: ActionData;
	} = $props();
	let refreshInterval: number | undefined;
	let createSheetOpen = $state(false);
	let auditRows = $state<AuditCreateRow[]>([{ displayDomain: '', domain: '' }]);
	let editingWebsiteId = $state<string | null>(null);
	let editingWebsiteDisplayDomain = $state('');
	const pendingAuditStatuses = new Set(['queued', 'running']);

	const hasPendingAudits = $derived(
		data.audits.some((audit) => pendingAuditStatuses.has(auditStatus(audit)))
	);

	$effect(() => {
		if (form?.createError) {
			createSheetOpen = true;
			auditRows =
				Array.isArray(form.rows) && form.rows.length
					? form.rows.map((row) => ({
							displayDomain:
								row && typeof row === 'object' && 'displayDomain' in row
									? String(row.displayDomain || '')
									: '',
							domain:
								row && typeof row === 'object' && 'domain' in row ? String(row.domain || '') : ''
						}))
					: [{ displayDomain: '', domain: '' }];
		}
	});

	function openCreateSheet() {
		createSheetOpen = true;
		if (!auditRows.length) auditRows = [{ displayDomain: '', domain: '' }];
	}

	function closeCreateSheet() {
		createSheetOpen = false;
	}

	function splitDomains(value: string) {
		return value
			.split(',')
			.map((domain) => domain.trim())
			.filter(Boolean);
	}

	function auditRowCount() {
		return auditRows.filter((row) => row.domain.trim()).length;
	}

	function focusAuditDomain(index: number) {
		void tick().then(() => {
			const input = document.querySelector<HTMLInputElement>(
				`[data-audit-domain-index="${index}"]`
			);
			input?.focus();
		});
	}

	function updateAuditRow(index: number, field: keyof AuditCreateRow, value: string) {
		if (value.includes(',')) {
			const domains = splitDomains(value);
			if (!domains.length) return;

			const next = [...auditRows];
			next.splice(index, 1, ...domains.map((domain) => ({ displayDomain: '', domain })), {
				displayDomain: '',
				domain: ''
			});
			auditRows = next;
			focusAuditDomain(index + domains.length);
			return;
		}

		auditRows = auditRows.map((row, itemIndex) =>
			itemIndex === index ? { ...row, [field]: value } : row
		);
	}

	function handleAuditRowInput(index: number, field: keyof AuditCreateRow, event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		updateAuditRow(index, field, input.value);
	}

	function handleAuditDomainKeydown(index: number, event: KeyboardEvent) {
		if (event.key !== 'Enter') return;

		event.preventDefault();
		const value = (event.currentTarget as HTMLInputElement).value.trim();
		if (!value) return;

		const next = [...auditRows];
		next.splice(index + 1, 0, { displayDomain: '', domain: '' });
		auditRows = next;
		focusAuditDomain(index + 1);
	}

	function removeAuditRow(index: number) {
		auditRows = auditRows.filter((_, itemIndex) => itemIndex !== index);
		if (!auditRows.length) auditRows = [{ displayDomain: '', domain: '' }];
	}

	function auditStatus(audit: AuditListItem) {
		return audit.status || 'queued';
	}

	function statusLabel(status: string) {
		return status.replaceAll('_', ' ');
	}

	function websiteDisplayDomain(website: WebsiteGroup['website']) {
		return website.display_name || website.domain || website.url || 'Untitled website';
	}

	function websiteUrl(website: WebsiteGroup['website']) {
		return website.url || website.domain || '';
	}

	function auditTimestamp(audit: AuditListItem) {
		const raw = audit.queued_at || audit.created_at || audit.updated_at;
		if (!raw) return '';
		const date = new Date(raw);
		if (Number.isNaN(date.getTime())) return '';
		const dateText = date.toLocaleDateString(undefined, {
			weekday: 'short',
			month: 'long',
			day: 'numeric',
			year: 'numeric'
		});
		const timeText = date
			.toLocaleTimeString(undefined, {
				hour: 'numeric',
				minute: '2-digit'
			})
			.replace(/\s/g, '')
			.toLowerCase();
		return `${dateText}, ${timeText}`;
	}

	function editWebsiteDomain(website: WebsiteGroup['website']) {
		const websiteId = website.id;
		if (!websiteId) return;
		editingWebsiteId = websiteId;
		editingWebsiteDisplayDomain = websiteDisplayDomain(website);
		void tick().then(() => {
			document.querySelector<HTMLInputElement>(`[data-website-domain="${websiteId}"]`)?.focus();
		});
	}

	function stopEditingWebsiteDomain() {
		editingWebsiteId = null;
		editingWebsiteDisplayDomain = '';
	}

	function cancelWebsiteDomainEdit(event: MouseEvent) {
		event.preventDefault();
		stopEditingWebsiteDomain();
	}

	function confirmAuditDelete(event: SubmitEvent) {
		if (
			window.confirm('Delete this audit? This removes its findings, screenshots, and report data.')
		) {
			return;
		}

		event.preventDefault();
	}

	function stopStatusRefresh() {
		if (!refreshInterval) return;
		window.clearInterval(refreshInterval);
		refreshInterval = undefined;
	}

	$effect(() => {
		if (!hasPendingAudits || editingWebsiteId) {
			stopStatusRefresh();
			return;
		}

		if (refreshInterval) return;
		refreshInterval = window.setInterval(() => {
			void invalidateAll();
		}, 2500);
	});

	onMount(() => {
		return () => {
			stopStatusRefresh();
		};
	});
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
{#if form?.deleteError}
	<p class="error toolbar-error">{form.deleteError}</p>
{/if}

<section class="audit-list-section">
	{#if data.websites.length === 0}
		<p class="empty-state">{data.query ? 'No audits matched your search.' : 'No audits yet.'}</p>
	{:else}
		<div class="website-list">
			{#each data.websites as group (group.website.id || group.website.domain || group.website.url)}
				<section class="website-row">
					<header class="website-row-header">
						<div class="website-title-block">
							{#if editingWebsiteId === group.website.id}
								<form method="POST" action="?/updateWebsite" class="website-name-form">
									<input type="hidden" name="websiteId" value={group.website.id} />
									<input
										name="displayDomain"
										type="text"
										bind:value={editingWebsiteDisplayDomain}
										aria-label={`Display domain for ${websiteDisplayDomain(group.website)}`}
										data-website-domain={group.website.id}
										onkeydown={(event) => {
											if (event.key === 'Escape') {
												event.preventDefault();
												stopEditingWebsiteDomain();
											}
										}}
									/>
									<div class="website-name-actions">
										<button
											type="submit"
											class="website-name-action"
											aria-label="Save display domain"
										>
											<Check size={15} />
										</button>
										<button
											type="button"
											class="website-name-action"
											aria-label="Cancel display domain edit"
											onclick={cancelWebsiteDomainEdit}
										>
											<X size={15} />
										</button>
									</div>
								</form>
							{:else}
								<div class="website-name-display">
									<span class="website-name-text">{websiteDisplayDomain(group.website)}</span>
									<button
										type="button"
										class="website-name-edit"
										onclick={() => editWebsiteDomain(group.website)}
										aria-label={`Edit display domain for ${websiteDisplayDomain(group.website)}`}
									>
										<Pencil size={14} />
									</button>
								</div>
							{/if}
							<p class="muted">{group.website.domain || websiteUrl(group.website)}</p>
						</div>
						<div class="website-row-actions">
							<form method="POST" action="?/create">
								<input type="hidden" name="urls" value={websiteUrl(group.website)} />
								<button type="submit" class="icon-button website-run-button">
									<RotateCw size={14} />
									<span>Run audit</span>
								</button>
							</form>
						</div>
					</header>

					<div class="audit-card-grid">
						{#each group.audits as audit (audit.id)}
							<article class="audit-card">
								<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
								<a class="audit-card-link" href={audit.targetHref}>
									<div>
										<strong>{auditTimestamp(audit) || 'Audit'}</strong>
									</div>
									<span class={`audit-status-chip audit-status-${auditStatus(audit)}`}>
										{statusLabel(auditStatus(audit))}
									</span>
								</a>
								<form method="POST" action="?/delete" onsubmit={confirmAuditDelete}>
									<input type="hidden" name="auditId" value={audit.id} />
									<button
										type="submit"
										class="audit-delete-button"
										aria-label={`Delete audit ${auditTimestamp(audit) || audit.id}`}
									>
										<Trash2 size={15} />
									</button>
								</form>
							</article>
						{/each}
					</div>
				</section>
			{/each}
		</div>
	{/if}
</section>

{#if createSheetOpen}
	<div class="sheet-backdrop" role="presentation" onclick={closeCreateSheet}></div>
	<div class="audit-create-sheet" aria-label="Create audits" aria-modal="true" role="dialog">
		<div class="sheet-header">
			<div>
				<h2>Create audits</h2>
				<p class="muted">Add one or more websites. Existing domains will get another audit.</p>
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
				{#each auditRows as row, index (index)}
					<div class="audit-url-field">
						<input
							name="displayDomains"
							type="text"
							value={row.displayDomain}
							placeholder="Display domain"
							aria-label={`Website display domain ${index + 1}`}
							oninput={(event) => handleAuditRowInput(index, 'displayDomain', event)}
						/>
						<input
							name="domains"
							type="text"
							inputmode="url"
							value={row.domain}
							placeholder="Domain"
							aria-label={`Website domain ${index + 1}`}
							data-audit-domain-index={index}
							oninput={(event) => handleAuditRowInput(index, 'domain', event)}
							onkeydown={(event) => handleAuditDomainKeydown(index, event)}
						/>
						<button
							type="button"
							class="field-remove"
							aria-label={`Remove website row ${index + 1}`}
							disabled={auditRows.length === 1 && !row.domain.trim() && !row.displayDomain.trim()}
							onclick={() => removeAuditRow(index)}
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
				<button type="submit" class="icon-button" disabled={auditRowCount() === 0}>
					<Plus size={18} />
					<span>Run {auditRowCount() > 1 ? `${auditRowCount()} audits` : 'audit'}</span>
				</button>
			</div>
		</form>
	</div>
{/if}

<style>
	.page-head {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 16px;
		align-items: center;
		margin-bottom: 24px;
	}

	.page-head h1 {
		margin: 0;
		color: #fff;
		font-size: clamp(2rem, 4vw, 3rem);
		font-weight: 800;
	}

	.muted {
		color: var(--text-muted);
	}

	input:not([type='hidden']),
	button {
		border-radius: 9999px;
		font: inherit;
	}

	input:not([type='hidden']) {
		padding: 16px 18px;
		border: 1px solid var(--border);
		background: rgba(24, 33, 43, 0.95);
		color: var(--text-main);
		outline: none;
		transition: border-color 0.3s ease;
	}

	input:not([type='hidden']):focus {
		border-color: var(--goldenweb-primary);
	}

	button {
		padding: 16px 22px;
		border: 0;
		background: linear-gradient(135deg, #3b82f6, #6366f1);
		color: white;
		font-weight: 600;
		cursor: pointer;
		transition: opacity 0.2s ease;
	}

	.icon-button,
	.icon-link {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
	}

	.error {
		color: #fca5a5;
	}

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

	.website-list {
		display: grid;
		gap: 18px;
	}

	.website-row {
		border: 1px solid rgba(148, 163, 184, 0.15);
		border-radius: 18px;
		background: rgba(0, 0, 0, 0.2);
		padding: 18px;
	}

	.website-row-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		margin-bottom: 14px;
	}

	.website-title-block {
		flex: 1 1 auto;
		min-width: 0;
	}

	.website-name-display,
	.website-name-form {
		display: grid;
		grid-template-columns: minmax(0, auto) auto;
		align-items: center;
		justify-content: start;
		gap: 8px;
		width: 100%;
		margin: 0 0 4px;
	}

	.website-name-text,
	.website-name-form input {
		min-width: 0;
		border: 1px solid transparent;
		border-radius: 6px;
		padding: 0;
		background: transparent;
		color: var(--text-primary);
		font-size: 1.15rem;
		font-family: inherit;
		font-weight: 800;
		line-height: 1.25;
		letter-spacing: 0;
		text-align: left;
	}

	.website-name-text {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.website-name-form input {
		width: min(320px, 100%);
	}

	.website-name-form input:focus {
		outline: none;
		border-color: rgba(148, 163, 184, 0.28);
	}

	.website-name-edit,
	.website-name-action {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		padding: 0;
		border: 1px solid rgba(148, 163, 184, 0.28);
		border-radius: 999px;
		background: rgba(15, 23, 42, 0.88);
		color: var(--text-main);
		cursor: pointer;
	}

	.website-name-action[type='submit'] {
		border-color: rgba(16, 185, 129, 0.42);
		color: var(--status-pass);
	}

	.website-name-action[type='button'] {
		border-color: rgba(239, 68, 68, 0.34);
		color: var(--status-fail);
	}

	.website-name-edit :global(svg),
	.website-name-action :global(svg) {
		display: block;
		flex-shrink: 0;
	}

	.website-name-edit:hover,
	.website-name-action:hover {
		border-color: rgba(255, 183, 27, 0.52);
		background: rgba(255, 255, 255, 0.08);
		color: var(--text-main);
	}

	.website-name-actions {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.website-title-block p {
		margin: 0;
	}

	.website-run-button {
		min-height: 34px;
		padding: 0.45rem 0.7rem;
		font-size: 0.82rem;
		white-space: nowrap;
	}

	.website-row-actions {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.audit-card-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
		gap: 12px;
	}

	.audit-card {
		position: relative;
		min-height: 96px;
		min-width: 0;
		border: 1px solid rgba(148, 163, 184, 0.14);
		border-radius: 12px;
		background: rgba(255, 255, 255, 0.03);
		transition:
			border-color 0.2s ease,
			background-color 0.2s ease;
	}

	.audit-card:hover {
		border-color: rgba(148, 163, 184, 0.3);
		background: rgba(255, 255, 255, 0.05);
	}

	.audit-card-link {
		display: grid;
		grid-template-rows: auto auto;
		gap: 10px;
		min-height: 96px;
		min-width: 0;
		padding: 14px 52px 14px 14px;
	}

	.audit-card strong {
		display: block;
		min-width: 0;
		overflow-wrap: anywhere;
		color: var(--text-primary);
		font-size: 0.92rem;
		line-height: 1.35;
		white-space: normal;
	}

	.audit-status-chip {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		justify-self: start;
		max-width: 100%;
		border: 1px solid var(--border-color);
		border-radius: 999px;
		padding: 0.34rem 0.58rem;
		overflow-wrap: anywhere;
		color: var(--text-muted);
		font-size: 0.72rem;
		font-weight: 900;
		line-height: 1.1;
		text-align: center;
		text-transform: capitalize;
	}

	.audit-card form {
		position: absolute;
		top: 10px;
		right: 10px;
	}

	.audit-delete-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		padding: 0;
		border: 1px solid rgba(239, 68, 68, 0.28);
		border-radius: 999px;
		background: rgba(15, 23, 42, 0.88);
		color: #fca5a5;
		cursor: pointer;
		transition:
			border-color 0.2s ease,
			background-color 0.2s ease,
			color 0.2s ease;
	}

	.audit-delete-button:hover,
	.audit-delete-button:focus-visible {
		border-color: rgba(239, 68, 68, 0.64);
		background: rgba(239, 68, 68, 0.14);
		color: #fecaca;
	}

	.audit-delete-button :global(svg) {
		display: block;
		flex-shrink: 0;
	}

	.audit-status-queued {
		border-color: rgba(148, 163, 184, 0.28);
		background: rgba(148, 163, 184, 0.1);
		color: var(--text-muted);
	}

	.audit-status-running {
		border-color: rgba(96, 165, 250, 0.36);
		background: rgba(96, 165, 250, 0.12);
		color: var(--status-info);
	}

	.audit-status-completed {
		border-color: rgba(87, 191, 133, 0.34);
		background: rgba(87, 191, 133, 0.12);
		color: var(--status-pass);
	}

	.audit-status-failed {
		border-color: rgba(239, 83, 80, 0.36);
		background: rgba(239, 83, 80, 0.12);
		color: var(--status-fail);
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
		color: var(--text-primary);
	}

	.sheet-close :global(svg),
	.field-remove :global(svg) {
		display: block;
		color: currentColor;
		stroke-width: 2.5;
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
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
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
		color: var(--text-primary);
	}

	.field-remove:disabled {
		cursor: not-allowed;
		color: var(--text-muted);
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
		.page-head {
			grid-template-columns: 1fr;
		}
	}

	@media (max-width: 900px) {
		.audit-search-form {
			flex-direction: column;
			align-items: stretch;
		}

		.website-row-header {
			flex-direction: column;
			align-items: stretch;
		}

		.website-row-actions {
			align-items: stretch;
		}
	}

	@media (max-width: 640px) {
		.audit-create-sheet {
			width: calc(100% - 24px);
			padding: 22px;
			border-radius: 22px;
		}

		.audit-url-field {
			grid-template-columns: 1fr auto;
		}

		.audit-url-field input:first-child {
			grid-column: 1 / -1;
		}

		.sheet-actions {
			flex-direction: column-reverse;
		}
	}
</style>
