<script lang="ts">
	let {
		checked = false,
		label = 'Selected'
	}: {
		checked?: boolean;
		label?: string;
	} = $props();
</script>

<span class={`custom-checkmark ${checked ? 'is-checked' : ''}`} aria-hidden="true">
	<svg viewBox="0 0 18 18" fill="none">
		<path d="M4.25 9.25L7.25 12.25L13.75 5.75" />
	</svg>
</span>
<span class="sr-only">{label}</span>

<style>
	.custom-checkmark {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.35rem;
		height: 1.35rem;
		margin-top: 0.25rem;
		border: 1px solid var(--border-color);
		border-radius: 0.4rem;
		background: rgba(9, 14, 22, 0.55);
		color: transparent;
		transition:
			background 0.15s ease,
			border-color 0.15s ease,
			color 0.15s ease;
	}

	.custom-checkmark.is-checked {
		border-color: var(--goldenweb-primary);
		background: var(--goldenweb-primary);
		color: #11131f;
	}

	.custom-checkmark svg {
		width: 0.95rem;
		height: 0.95rem;
	}

	.custom-checkmark path {
		stroke: currentColor;
		stroke-width: 2.6;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}
</style>
