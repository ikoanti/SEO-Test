<script lang="ts">
	import { resolve } from '$app/paths';
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import logo from '$lib/assets/logo.png';

	let { children, data } = $props();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<div class="shell">
	<div class="brand-row">
		<a class="brand-mark" href={resolve('/audits')} aria-label="GoldenWeb home">
			<img src={logo} alt="GoldenWeb Logo" />
		</a>
	</div>

	{#if data.user}
		<header class="topbar">
			<div>
				<p class="eyebrow">GoldenWeb</p>
				<h1>SEO Mini Audit Tool</h1>
				<p class="brand-subtitle">By Iraki Antidze</p>
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
