<script lang="ts">
	import AppHeader from '$lib/components/AppHeader.svelte';
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { ArrowUp } from 'lucide-svelte';
	import { onMount } from 'svelte';

	let { children, data } = $props();
	let showReturnToTop = $state(false);

	function updateReturnToTopVisibility() {
		showReturnToTop = window.scrollY > window.innerHeight / 2;
	}

	function returnToTop() {
		window.scrollTo({ top: 0, behavior: 'smooth' });
	}

	onMount(() => {
		updateReturnToTopVisibility();
		window.addEventListener('scroll', updateReturnToTopVisibility, { passive: true });
		window.addEventListener('resize', updateReturnToTopVisibility);

		return () => {
			window.removeEventListener('scroll', updateReturnToTopVisibility);
			window.removeEventListener('resize', updateReturnToTopVisibility);
		};
	});
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

{#if data.isCaptureRoute}
	{@render children()}
{:else}
	<div class="shell">
		<AppHeader user={data.user} />

		<main>
			{@render children()}
		</main>
	</div>
{/if}

{#if showReturnToTop && !data.isCaptureRoute}
	<button class="return-to-top" type="button" aria-label="Return to top" onclick={returnToTop}>
		<ArrowUp size={20} />
		<span>Top</span>
	</button>
{/if}

<style>
	.shell {
		max-width: 1200px;
		margin: 0 auto;
		padding: 24px;
		position: relative;
	}

	main {
		padding-top: 0;
	}

	.return-to-top {
		position: fixed;
		right: clamp(1rem, 3vw, 2rem);
		bottom: clamp(1rem, 3vw, 2rem);
		z-index: 100;
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		border: 1px solid var(--border-color);
		border-radius: 999px;
		padding: 0.75rem 1rem;
		background: rgba(24, 31, 43, 0.94);
		color: var(--text-primary);
		font: inherit;
		font-size: 0.92rem;
		font-weight: 900;
		cursor: pointer;
		backdrop-filter: blur(12px);
	}

	.return-to-top :global(svg) {
		color: var(--goldenweb-primary);
	}

	.return-to-top:focus-visible {
		outline: 2px solid var(--goldenweb-primary);
		outline-offset: 3px;
	}

	@media (max-width: 640px) {
		.return-to-top {
			right: 1rem;
			bottom: 1rem;
			padding: 0.7rem 0.9rem;
		}
	}
</style>
