<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { Check, Pencil, Plus, RotateCw, Search, X } from 'lucide-svelte';
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

	let {
		data,
		form
	}: {
		data: { audits: AuditListItem[]; websites: WebsiteGroup[]; query: string };
		form?: ActionData;
	} = $props();
	let refreshInterval: number | undefined;
	let createSheetOpen = $state(false);
	let auditUrls = $state<string[]>(['']);
	let editingWebsiteId = $state<string | null>(null);
	const pendingAuditStatuses = new Set(['queued', 'running']);

	const hasPendingAudits = $derived(
		data.audits.some((audit) => pendingAuditStatuses.has(auditStatus(audit)))
	);

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

	function auditStatus(audit: AuditListItem) {
		return audit.status || 'queued';
	}

	function statusLabel(status: string) {
		return status.replaceAll('_', ' ');
	}

	function websiteDisplayName(website: WebsiteGroup['website']) {
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

	function editWebsiteName(websiteId?: string) {
		if (!websiteId) return;
		editingWebsiteId = websiteId;
		void tick().then(() => {
			document.querySelector<HTMLInputElement>(`[data-website-name="${websiteId}"]`)?.focus();
		});
	}

	function stopEditingWebsiteName() {
		editingWebsiteId = null;
	}

	function cancelWebsiteNameEdit(event: MouseEvent) {
		event.preventDefault();
		stopEditingWebsiteName();
	}

	function stopStatusRefresh() {
		if (!refreshInterval) return;
		window.clearInterval(refreshInterval);
		refreshInterval = undefined;
	}

	$effect(() => {
		if (!hasPendingAudits) {
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
										name="displayName"
										type="text"
										value={websiteDisplayName(group.website)}
										aria-label={`Display name for ${websiteDisplayName(group.website)}`}
										data-website-name={group.website.id}
										onkeydown={(event) => {
											if (event.key === 'Escape') {
												event.preventDefault();
												stopEditingWebsiteName();
											}
										}}
									/>
									<div class="website-name-actions">
										<button
											type="submit"
											class="website-name-action"
											aria-label="Save display name"
										>
											<Check size={15} />
										</button>
										<button
											type="button"
											class="website-name-action"
											aria-label="Cancel display name edit"
											onclick={cancelWebsiteNameEdit}
										>
											<X size={15} />
										</button>
									</div>
								</form>
							{:else}
								<div class="website-name-display">
									<span class="website-name-text">{websiteDisplayName(group.website)}</span>
									<button
										type="button"
										class="website-name-edit"
										onclick={() => editWebsiteName(group.website.id)}
										aria-label={`Edit display name for ${websiteDisplayName(group.website)}`}
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
							<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
							<a class="audit-card" href={audit.targetHref}>
								<div>
									<strong>{auditTimestamp(audit) || 'Audit'}</strong>
								</div>
								<span class={`audit-status-chip audit-status-${auditStatus(audit)}`}>
									{statusLabel(auditStatus(audit))}
								</span>
							</a>
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
		border: 1px solid transparent;
		border-radius: 999px;
		background: transparent;
		color: var(--text-muted);
		cursor: pointer;
	}

	.website-name-edit:hover,
	.website-name-action:hover {
		border-color: rgba(148, 163, 184, 0.24);
		background: rgba(255, 255, 255, 0.04);
		color: var(--text-primary);
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
		display: grid;
		grid-template-rows: auto auto;
		gap: 10px;
		min-height: 96px;
		min-width: 0;
		border: 1px solid rgba(148, 163, 184, 0.14);
		border-radius: 12px;
		padding: 14px;
		background: rgba(255, 255, 255, 0.03);
	}

	.audit-card:hover {
		border-color: rgba(148, 163, 184, 0.3);
		background: rgba(255, 255, 255, 0.05);
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

		.sheet-actions {
			flex-direction: column-reverse;
		}
	}
</style>
