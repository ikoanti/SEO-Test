<script lang="ts">
	import type { ActionData } from './$types';

	type AuditListItem = {
		id: string;
		name?: string;
		url: string;
		status?: string;
		targetHref: string;
	};

	let { data, form }: { data: { audits: AuditListItem[] }; form?: ActionData } = $props();
</script>

<section class="page-head">
	<div>
		<p class="eyebrow">Workspace</p>
		<h1>Audits</h1>
		<p class="muted">Create a new audit and open any existing audit result.</p>
	</div>
</section>

<div class="two grid">
	<section class="card">
		<h2>Create audit</h2>
		<form method="POST" action="?/create" class="stack">
			<label>
				<span>Name</span>
				<input name="name" value={form?.name ?? ''} placeholder="Example audit" required />
			</label>
			<label>
				<span>Website</span>
				<input
					name="url"
					type="url"
					value={form?.url ?? ''}
					placeholder="https://example.com"
					required
				/>
			</label>
			{#if form?.createError}
				<p class="error">{form.createError}</p>
			{/if}
			<button type="submit">Run audit</button>
		</form>
	</section>

	<section class="card">
		<h2>Audit list</h2>
		{#if data.audits.length === 0}
			<p class="muted">No audits yet.</p>
		{:else}
			<ul class="list">
				{#each data.audits as audit (audit.id)}
					<li>
						<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
						<a href={audit.targetHref}>
							<strong>{audit.name || audit.url}</strong>
							<span>{audit.url}</span>
							<span class="muted">Status: {audit.status || 'queued'}</span>
						</a>
					</li>
				{/each}
			</ul>
		{/if}
	</section>
</div>
