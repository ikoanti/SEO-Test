<script lang="ts">
	import { resolve } from '$app/paths';
	import { ArrowLeft, RotateCcw } from 'lucide-svelte';

	let {
		title,
		status,
		isPending = false
	}: {
		title?: string;
		status?: string;
		isPending?: boolean;
	} = $props();
</script>

<section class="page-head audit-page-head">
	<div class="page-head-main">
		<a class="back-link icon-link" href={resolve('/audits')}>
			<ArrowLeft size={16} />
			<span>Back to audits</span>
		</a>
		<div class="heading-copy">
			<h1>{title}</h1>
			<span class="run-status">Run status: {status || 'queued'}</span>
		</div>
	</div>
	<div class="page-head-actions">
		<form method="POST" action="?/restart">
			<button type="submit" class="icon-button restart-button" disabled={isPending}>
				<RotateCcw size={16} />
				<span>Restart audit</span>
			</button>
		</form>
	</div>
</section>

<style>
	.audit-page-head h1 {
		font-size: clamp(1.8rem, 3vw, 2.5rem);
	}

	.page-head-main {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.heading-copy {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.back-link {
		flex: 0 0 auto;
		padding: 10px 14px;
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 9999px;
		background: var(--surface-soft);
		transition:
			border-color 0.2s ease,
			background-color 0.2s ease;
	}

	.back-link:hover {
		border-color: var(--border);
		background: rgba(15, 23, 42, 0.9);
	}

	.run-status {
		display: inline-flex;
		align-items: center;
		padding: 0.35rem 0.7rem;
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 9999px;
		background: var(--surface-soft);
		color: var(--text-muted);
		font-size: 0.82rem;
		font-weight: 600;
		text-transform: capitalize;
		white-space: nowrap;
	}

	.page-head-actions {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.restart-button {
		padding: 10px 14px;
	}

	.restart-button:disabled {
		cursor: not-allowed;
		opacity: 0.65;
	}

	@media (max-width: 760px) {
		.page-head-main {
			align-items: flex-start;
		}

		.heading-copy {
			align-items: flex-start;
		}

		.page-head-actions {
			justify-content: flex-start;
		}
	}
</style>
