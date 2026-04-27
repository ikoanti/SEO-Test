class LazyLoadingPanel extends HTMLElement {
	constructor() {
		super();
		this.attachShadow({ mode: 'open' });
		this._panel = {
			title: 'Unoptimized Lazy Loading',
			description: '',
			domain: 'this domain',
			count: 0,
			entries: []
		};
	}

	set panel(value) {
		this._panel = value ?? this._panel;
		this.render();
	}

	get panel() {
		return this._panel;
	}

	connectedCallback() {
		this.render();
	}

	render() {
		const { escapeHtml, formatValue } = window.AutomagicHtml;
		const styles = window.AutomagicAuditStyles || {};
		const panel = this._panel ?? {};
		const entries = Array.isArray(panel.entries) ? panel.entries : [];

		this.shadowRoot.innerHTML = `
      ${styles['panels-shared'] ? `<style>${styles['panels-shared']}</style>` : '<link rel="stylesheet" href="./styles/panels/shared.css">'}
      <section class="section">
        <h1 class="title">${escapeHtml(panel.title ?? 'Unoptimized Lazy Loading')}</h1>
        <p class="copy">${escapeHtml(panel.description ?? '')}</p>
      </section>
      <section class="section">
        <div class="summary">
          <p class="summary-label">Detected</p>
          <p class="summary-count">${escapeHtml(panel.count ?? entries.length)}</p>
          <p class="summary-note">Images missing lazy loading found on ${escapeHtml(panel.domain ?? 'this domain')}</p>
        </div>
      </section>
      <section class="section">
        <div class="list">
          ${entries
						.map(
							(entry) => `
                <article class="card">
                  <div class="card-head">
                    <div class="badge">×</div>
                    <p class="card-title">${escapeHtml(entry.issue ?? 'Image missing lazy loading')}</p>
                  </div>
                  <div class="meta">
                    <div>
                      <p class="meta-label">Page</p>
                      <p class="meta-value">${formatValue(entry.page ?? '')}</p>
                    </div>
                    <div>
                      <p class="meta-label">Image</p>
                      <p class="meta-value">${formatValue(entry.image ?? '')}</p>
                    </div>
                  </div>
                </article>
              `
						)
						.join('')}
        </div>
      </section>
    `;
	}
}

if (!customElements.get('lazy-loading-panel')) {
	customElements.define('lazy-loading-panel', LazyLoadingPanel);
}
