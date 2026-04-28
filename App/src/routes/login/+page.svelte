<script lang="ts">
	import { LogIn } from 'lucide-svelte';
	let { data } = $props();
</script>

<div class="auth-card">
	<h1 class="auth-title">GoldenWeb SEO Mini Audit Tool</h1>
	<p class="auth-byline">By Iraki Antidze & George Tchelidze</p>

	<form method="POST" action="/api/auth/login" class="stack">
		<input type="hidden" name="redirectTo" value={data.redirectTo} />
		<label>
			<span>Email</span>
			<input name="email" type="email" value={data.email} required />
		</label>
		<label>
			<span>Password</span>
			<input name="password" type="password" required />
		</label>
		{#if data.error}
			<p class="error">{data.error}</p>
		{/if}
		<button type="submit" class="icon-button">
			<LogIn size={18} />
			<span>Sign in</span>
		</button>
	</form>
</div>

<style>
	.auth-card {
		max-width: 620px;
		margin: 96px auto 0;
		padding: 28px 28px 24px;
		background: var(--card-bg);
		border: 1px solid var(--border);
		border-radius: 18px;
	}

	.auth-card h1 {
		margin: 0;
		font-size: clamp(2rem, 4vw, 3rem);
		font-weight: 800;
		color: #fff;
	}

	.auth-title {
		max-width: 12ch;
		margin-bottom: 10px !important;
		font-size: clamp(2.1rem, 5vw, 3.2rem);
		line-height: 1.05;
		letter-spacing: -0.04em;
		text-wrap: balance;
	}

	.auth-byline {
		margin: 0 0 20px;
		color: var(--text-muted);
		font-size: 1rem;
		font-weight: 500;
	}
</style>
