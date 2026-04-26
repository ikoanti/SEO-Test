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
		</div>
	</div>
	<div class="page-head-actions">
		<div class="action-capsule">
			<span class="run-status">{status || 'queued'}</span>
			<form method="POST" action="?/restart">
				<button type="submit" class="icon-button restart-button" disabled={isPending}>
					<RotateCcw size={16} />
					<span>Restart audit</span>
				</button>
			</form>
		</div>
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

	.heading-copy h1 {
		max-width: 100%;
		line-height: 1.05;
		word-break: break-word;
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
		justify-content: center;
		padding: 10px 14px;
		color: var(--text-muted);
		font-size: 0.9rem;
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

	.action-capsule {
		display: inline-flex;
		align-items: stretch;
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 9999px;
		background: var(--surface-soft);
		overflow: hidden;
	}

	.action-capsule form {
		display: contents;
	}

	.restart-button {
		padding: 10px 14px;
		border-radius: 0;
		border: 0;
		border-left: 1px solid rgba(255, 255, 255, 0.08);
		background: transparent;
	}

	.restart-button:disabled {
		cursor: not-allowed;
		opacity: 0.65;
	}

	@media (max-width: 760px) {
		.audit-page-head h1 {
			font-size: clamp(2.1rem, 10vw, 3rem);
		}

		.page-head-main {
			flex-direction: column;
			align-items: stretch;
		}

		.heading-copy {
			align-items: flex-start;
		}

		.back-link {
			align-self: flex-start;
		}

		.page-head-actions {
			justify-content: flex-start;
			width: 100%;
		}

		.action-capsule {
			width: 100%;
		}

		.run-status,
		.restart-button {
			flex: 1 1 0;
			justify-content: center;
		}
	}
</style>
