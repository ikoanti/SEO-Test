<script lang="ts">
	import { resolve } from '$app/paths';
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';

	let { children, data } = $props();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<div class="shell">
	{#if data.user}
		<header class="topbar">
			<div>
				<p class="eyebrow">GoldenWeb</p>
				<h1>Mini SEO Tool</h1>
			</div>
			<nav>
				<a href={resolve('/audits')}>Audits</a>
			</nav>
		</header>
	{/if}

	<main>
		{@render children()}
	</main>
</div>
