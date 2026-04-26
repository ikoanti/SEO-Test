<script lang="ts">
	import { resolve } from '$app/paths';
	import { ChevronDown, LogOut, UserRound } from 'lucide-svelte';
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import logo from '$lib/assets/logo.png';

	let { children, data } = $props();
	let profileMenuOpen = $state(false);
	let profileMenuElement = $state<HTMLDivElement | null>(null);

	const toggleProfileMenu = () => {
		profileMenuOpen = !profileMenuOpen;
	};

	const closeProfileMenu = () => {
		profileMenuOpen = false;
	};

	const handleDocumentClick = ({ target }: MouseEvent) => {
		if (!profileMenuOpen || !profileMenuElement) return;
		if (target instanceof Node && profileMenuElement.contains(target)) return;
		closeProfileMenu();
	};

	const handleDocumentKeydown = ({ key }: KeyboardEvent) => {
		if (key === 'Escape') {
			closeProfileMenu();
		}
	};
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
<svelte:document onclick={handleDocumentClick} onkeydown={handleDocumentKeydown} />

<div class="shell">
	<div class="brand-row">
		<div class="brand-side brand-side-left">
			<a class="brand-mark" href={resolve('/audits')} aria-label="GoldenWeb home">
				<img src={logo} alt="GoldenWeb Logo" />
			</a>
		</div>
		{#if data.user}
			<div class="brand-copy">
				<h1>SEO Mini Audit Tool</h1>
				<p class="brand-subtitle">By Iraki Antidze</p>
			</div>
		{/if}
		<div class="brand-side brand-side-right">
			{#if data.user}
				<div class="profile-menu" bind:this={profileMenuElement}>
					<button
						type="button"
						class="profile-trigger"
						aria-haspopup="menu"
						aria-expanded={profileMenuOpen}
						onclick={toggleProfileMenu}
					>
						<UserRound size={16} />
						<span>{data.user.name || data.user.email || 'Account'}</span>
						<ChevronDown size={16} />
					</button>
					{#if profileMenuOpen}
						<div class="profile-dropdown" role="menu">
							<div class="profile-meta">
								<p>{data.user.name || 'Account'}</p>
								{#if data.user.email}
									<span>{data.user.email}</span>
								{/if}
							</div>
							<form method="POST" action="/api/auth/logout">
								<button type="submit" class="profile-action" role="menuitem">
									<LogOut size={16} />
									<span>Log out</span>
								</button>
							</form>
						</div>
					{/if}
				</div>
			{/if}
		</div>
	</div>

	<main>
		{@render children()}
	</main>
</div>
