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
</script>

<section class="page-head">
	<div>
		<h1>Audits</h1>
		<p class="muted">Create a new audit and open any existing audit result.</p>
	</div>
	<form method="POST" action="?/create" class="audit-create-form audit-create-inline">
		<input
			name="url"
			type="url"
			value={form?.url ?? ''}
			placeholder="https://example.com"
			aria-label="Audit URL"
			required
		/>
		<button type="submit" class="icon-button">
			<Plus size={18} />
			<span>Run</span>
		</button>
	</form>
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
	<h2>Audit list</h2>
	{#if data.audits.length === 0}
		<p class="empty-state">{data.query ? 'No audits matched your search.' : 'No audits yet.'}</p>
	{:else}
		<ul class="list audit-list">
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
