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

<style>
	.shell {
		max-width: 1200px;
		margin: 0 auto;
		padding: 24px;
		position: relative;
	}

	.brand-row {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		gap: 16px;
		margin-bottom: 24px;
	}

	.brand-side {
		display: flex;
		align-items: center;
	}

	.brand-side-left {
		justify-content: flex-start;
	}

	.brand-side-right {
		justify-content: flex-end;
	}

	.brand-mark {
		display: inline-flex;
		align-items: center;
	}

	.brand-mark img {
		display: block;
		width: auto;
		height: 32px;
	}

	.brand-copy {
		display: flex;
		align-items: baseline;
		justify-content: center;
		gap: 12px;
		flex-wrap: wrap;
		text-align: center;
	}

	.brand-copy h1 {
		margin: 0;
		font-size: clamp(1.4rem, 2.6vw, 2rem);
		font-weight: 700;
		color: #fff;
	}

	.brand-subtitle {
		margin: 0;
		color: var(--text-muted);
		font-size: 0.95rem;
		white-space: nowrap;
	}

	.profile-menu {
		position: relative;
	}

	.profile-trigger {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 10px 14px;
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 9999px;
		background: var(--surface-soft);
		cursor: pointer;
		list-style: none;
		color: var(--text-main);
	}

	.profile-trigger::-webkit-details-marker {
		display: none;
	}

	.profile-dropdown {
		position: absolute;
		top: calc(100% + 10px);
		right: 0;
		z-index: 20;
		min-width: 220px;
		padding: 12px;
		border: 1px solid var(--border);
		border-radius: 16px;
		background: var(--card-bg);
		box-shadow: var(--card-shadow);
	}

	.profile-meta {
		margin-bottom: 10px;
		padding: 4px 4px 12px;
		border-bottom: 1px solid rgba(148, 163, 184, 0.14);
	}

	.profile-meta p,
	.profile-meta span {
		display: block;
		margin: 0;
	}

	.profile-meta p {
		font-weight: 600;
	}

	.profile-meta span {
		margin-top: 4px;
		color: var(--text-muted);
		font-size: 0.9rem;
	}

	.profile-action {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		width: 100%;
		padding: 12px 14px;
		border-radius: 12px;
	}

	main {
		padding-top: 0;
	}

	@media (max-width: 900px) {
		.brand-row {
			grid-template-columns: 1fr;
			justify-items: center;
		}

		.brand-copy {
			flex-direction: column;
			align-items: flex-start;
			gap: 6px;
		}

		.brand-side-left,
		.brand-side-right {
			justify-content: center;
		}

		.profile-dropdown {
			right: auto;
			left: 50%;
			transform: translateX(-50%);
		}
	}
</style>
