<script>
  import logoUrl from '../../logo.png';

  const TOKEN_KEY = 'seo-mini-tool.authToken';

  let authToken = localStorage.getItem(TOKEN_KEY) || '';
  let user = null;
  let authReady = false;
  let authLoading = false;
  let authError = '';
  let loginEmail = '';
  let loginPassword = '';

  let auditUrl = '';
  let auditLoading = false;
  let auditError = '';
  let auditData = null;

  let reportLoading = false;
  let reportError = '';
  let reportHtml = '';

  const sectionConfig = [
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

  const statusLabel = {
    ok: 'Passed',
    warn: 'Warning',
    err: 'Failed'
  };

  const statusClass = {
    ok: 'ok',
    warn: 'warn',
    err: 'err'
  };

  async function apiFetch(path, options = {}) {
    const headers = new Headers(options.headers || {});
    if (!headers.has('Content-Type') && options.body && !(options.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }
    if (authToken) {
      headers.set('Authorization', `Bearer ${authToken}`);
    }

    const response = await fetch(path, {
      ...options,
      headers
    });

    const contentType = response.headers.get('content-type') || '';
    const data = contentType.includes('application/json')
      ? await response.json()
      : await response.text();

    if (response.status === 401) {
      clearSession();
      throw new Error(typeof data === 'string' ? data : data?.error || 'Authentication required.');
    }

    if (!response.ok) {
      throw new Error(typeof data === 'string' ? data : data?.error || 'Request failed.');
    }

    return data;
  }

  function persistSession(token, nextUser) {
    authToken = token;
    user = nextUser;
    localStorage.setItem(TOKEN_KEY, token);
  }

  function clearSession() {
    authToken = '';
    user = null;
    localStorage.removeItem(TOKEN_KEY);
    auditData = null;
    reportHtml = '';
  }

  async function restoreSession() {
    if (!authToken) {
      authReady = true;
      return;
    }

    authLoading = true;
    authError = '';
    try {
      const session = await apiFetch('/api/auth/session');
      persistSession(session.token, session.user);
    } catch (error) {
      authError = error.message;
    } finally {
      authLoading = false;
      authReady = true;
    }
  }

  async function handleLogin() {
    authLoading = true;
    authError = '';
    try {
      const session = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: loginEmail.trim(),
          password: loginPassword
        })
      });
      persistSession(session.token, session.user);
      loginPassword = '';
    } catch (error) {
      authError = error.message;
    } finally {
      authLoading = false;
      authReady = true;
    }
  }

  async function runAudit() {
    auditLoading = true;
    auditError = '';
    reportHtml = '';
    reportError = '';
    try {
      auditData = await apiFetch('/api/audit', {
        method: 'POST',
        body: JSON.stringify({ url: auditUrl.trim() })
      });
    } catch (error) {
      auditError = error.message;
    } finally {
      auditLoading = false;
    }
  }

  async function generateReport() {
    if (!auditData?.domain) {
      return;
    }

    reportLoading = true;
    reportError = '';
    try {
      const result = await apiFetch('/api/generate-report', {
        method: 'POST',
        body: JSON.stringify({
          domain: auditData.domain,
          auditData
        })
      });
      reportHtml = result.report;
    } catch (error) {
      reportError = error.message;
    } finally {
      reportLoading = false;
    }
  }

  function logout() {
    clearSession();
    authReady = true;
    authError = '';
  }

  function sectionItems(section) {
    return Array.isArray(section?.items) ? section.items : [];
  }

  function sectionStats(section) {
    return section?.stats || '';
  }

  function pageSpeedEntries(pageSpeed) {
    if (!pageSpeed) return [];
    return [
      { label: 'Mobile', value: pageSpeed.mobile },
      { label: 'Desktop', value: pageSpeed.desktop }
    ];
  }

  restoreSession();
</script>

<svelte:head>
  <title>GoldenWeb SEO Mini Audit Tool</title>
</svelte:head>

{#if !authReady || !user}
  <div class="auth-shell">
    <div class="auth-card">
      <img class="auth-logo" src={logoUrl} alt="GoldenWeb" />
      <p class="eyebrow">PocketBase Authentication</p>
      <h1>Sign in to access the audit tool</h1>
      <p class="auth-copy">This screen blocks the application until a valid PocketBase user session is established.</p>

      <form class="auth-form" on:submit|preventDefault={handleLogin}>
        <label>
          <span>Email</span>
          <input bind:value={loginEmail} type="email" autocomplete="email" placeholder="owner@example.com" required />
        </label>
        <label>
          <span>Password</span>
          <input bind:value={loginPassword} type="password" autocomplete="current-password" placeholder="••••••••" required />
        </label>

        {#if authError}
          <div class="message error">{authError}</div>
        {/if}

        <button class="primary-button" type="submit" disabled={authLoading}>
          {#if authLoading}Signing in…{:else}Sign in{/if}
        </button>
      </form>
    </div>
  </div>
{:else}
  <div class="page-shell">
    <header class="topbar">
      <div class="brand">
        <img class="brand-logo" src={logoUrl} alt="GoldenWeb" />
        <div>
          <p class="eyebrow">GoldenWeb</p>
          <h1>SEO Mini Audit Tool</h1>
        </div>
      </div>

      <div class="user-panel">
        <div class="user-meta">
          <span class="user-name">{user.name || user.email}</span>
          <span class="user-email">{user.email}</span>
        </div>
        <button class="secondary-button" type="button" on:click={logout}>Log out</button>
      </div>
    </header>

    <main class="layout">
      <section class="panel search-panel">
        <div class="panel-header">
          <h2>Run audit</h2>
          <p>Server-side audit execution with authenticated API access.</p>
        </div>

        <form class="search-form" on:submit|preventDefault={runAudit}>
          <input bind:value={auditUrl} type="url" placeholder="https://example.com" required />
          <button class="primary-button" type="submit" disabled={auditLoading}>
            {#if auditLoading}Running…{:else}Audit Now{/if}
          </button>
        </form>

        {#if auditError}
          <div class="message error">{auditError}</div>
        {/if}
      </section>

      {#if auditData}
        <section class="summary-grid">
          <article class="panel stat-card">
            <span class="stat-label">Domain</span>
            <strong>{auditData.domain}</strong>
            <small>{auditData.auditedAt}</small>
          </article>
          <article class="panel stat-card success">
            <span class="stat-label">Passed</span>
            <strong>{auditData.summary?.passed ?? 0}</strong>
          </article>
          <article class="panel stat-card warning">
            <span class="stat-label">Warnings</span>
            <strong>{auditData.summary?.warnings ?? 0}</strong>
          </article>
          <article class="panel stat-card danger">
            <span class="stat-label">Failed</span>
            <strong>{auditData.summary?.failed ?? 0}</strong>
          </article>
        </section>

        <section class="two-column">
          <article class="panel">
            <div class="panel-header">
              <h2>PageSpeed</h2>
            </div>
            <div class="metrics-grid">
              {#each pageSpeedEntries(auditData.pageSpeed) as entry}
                <div class="metric-card">
                  <span>{entry.label}</span>
                  <strong>{entry.value?.score ?? 'N/A'}</strong>
                  <ul>
                    {#each Object.entries(entry.value?.metrics || {}) as [metricKey, metricValue]}
                      <li><span>{metricKey}</span><span>{metricValue}</span></li>
                    {/each}
                  </ul>
                </div>
              {/each}
            </div>
          </article>

          <article class="panel">
            <div class="panel-header">
              <h2>Authority</h2>
            </div>
            <div class="metrics-grid">
              <div class="metric-card">
                <span>Open Page Rank</span>
                <strong>{auditData.openPageRank?.pageRank ?? 'N/A'}</strong>
              </div>
              <div class="metric-card">
                <span>Global Rank</span>
                <strong>{auditData.openPageRank?.globalRank ?? 'N/A'}</strong>
              </div>
            </div>
          </article>
        </section>

        <section class="panel">
          <div class="panel-header actions">
            <div>
              <h2>AI report</h2>
              <p>Generate the HTML client report from the authenticated backend.</p>
            </div>
            <button class="primary-button" type="button" on:click={generateReport} disabled={reportLoading}>
              {#if reportLoading}Generating…{:else}Generate Report{/if}
            </button>
          </div>

          {#if reportError}
            <div class="message error">{reportError}</div>
          {/if}

          {#if reportHtml}
            <div class="report-output">
              {@html reportHtml}
            </div>
          {/if}
        </section>

        <section class="sections-grid">
          {#each sectionConfig as [key, label]}
            {@const section = auditData[key]}
            <article class="panel section-card">
              <div class="panel-header">
                <h2>{label}</h2>
                {#if sectionStats(section)}
                  <p>{sectionStats(section)}</p>
                {/if}
              </div>

              {#if sectionItems(section).length > 0}
                <ul class="result-list">
                  {#each sectionItems(section) as item}
                    <li class={`result-item ${statusClass[item.status] || ''}`}>
                      <div class="result-head">
                        <span class={`badge ${statusClass[item.status] || ''}`}>{statusLabel[item.status] || item.status}</span>
                        {#if item.title}
                          <strong>{item.title}</strong>
                        {/if}
                      </div>
                      <p>{item.detail}</p>
                      {#if item.url}
                        <a href={item.url} target="_blank" rel="noreferrer">{item.url}</a>
                      {/if}
                    </li>
                  {/each}
                </ul>
              {:else}
                <p class="muted">No section data returned.</p>
              {/if}
            </article>
          {/each}
        </section>
      {/if}
    </main>
  </div>
{/if}
