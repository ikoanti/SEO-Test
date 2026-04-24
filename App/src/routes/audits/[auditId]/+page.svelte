<script lang="ts">
	let { data }: { data: any } = $props();

	const sections = [
		['h1Tags', 'H1 Tags'],
		['metaTitles', 'Meta Titles'],
		['imageAltTags', 'Image Alt Tags'],
		['canonicalUrls', 'Canonical URLs'],
		['internalLinks', 'Internal Links'],
		['sitemap', 'Sitemap'],
		['robotsTxt', 'Robots.txt'],
		['structuredData', 'Structured Data'],
		['security', 'Security'],
		['mixedContent', 'Mixed Content'],
		['contentQuality', 'Content Quality'],
		['webIcons', 'Web Icons'],
		['ssl', 'SSL'],
		['mobileUsability', 'Mobile Usability'],
		['flash', 'Flash'],
		['charset', 'Charset'],
		['loremIpsum', 'Lorem Ipsum'],
		['openGraph', 'Open Graph'],
		['shopifyUrls', 'Shopify URLs'],
		['internationalDomains', 'International Domains'],
		['trustSignals', 'Trust Signals'],
		['lazyLoadImages', 'Lazy Load Images']
	];
</script>

<section class="page-head">
	<div>
		<p class="eyebrow">Audit</p>
		<h1>{data.auditRecord.name || data.auditRecord.url}</h1>
		<p class="muted">{data.auditRecord.url}</p>
	</div>
	<a class="back-link" href="/audits">← Back to audits</a>
</section>

<section class="grid four">
	<div class="card compact"><span>Passed</span><strong>{data.summary.summary?.passed ?? 0}</strong></div>
	<div class="card compact"><span>Warnings</span><strong>{data.summary.summary?.warnings ?? 0}</strong></div>
	<div class="card compact"><span>Failed</span><strong>{data.summary.summary?.failed ?? 0}</strong></div>
	<div class="card compact"><span>Domain</span><strong>{data.summary.domain ?? data.audit.domain}</strong></div>
</section>

<section class="card">
	<h2>Top metrics</h2>
	<pre>{JSON.stringify(data.summary, null, 2)}</pre>
</section>

<section class="grid two">
	{#each sections as [key, label]}
		{@const section = data.audit[key]}
		<div class="card">
			<h2>{label}</h2>
			{#if section?.items?.length}
				<ul class="list detail-list">
					{#each section.items as item}
						<li>
							<strong>{item.title || item.status}</strong>
							<span>{item.detail}</span>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="muted">No items.</p>
			{/if}
		</div>
	{/each}
</section>
