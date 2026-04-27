class BrokenLinksPanel extends HTMLElement {
	constructor() {
		super();
		this.attachShadow({ mode: 'open' });
		this._panel = {
			title: 'Broken Links',
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
      ${styles['broken-links-panel'] ? `<style>${styles['broken-links-panel']}</style>` : '<link rel="stylesheet" href="./styles/panels/broken-links-panel.css">'}
      <section class="section">
        <h1 class="title">${escapeHtml(panel.title ?? 'Broken Links')}</h1>
        <p class="copy">${escapeHtml(panel.description ?? '')}</p>
      </section>
      <section class="section">
        <div class="summary">
          <p class="summary-label">Detected</p>
          <p class="summary-count">${escapeHtml(panel.count ?? entries.length)}</p>
          <p class="summary-note">Broken links found on ${escapeHtml(panel.domain ?? 'this domain')}</p>
        </div>
      </section>
      <section class="section">
        <div class="list">
          ${entries
						.map(
							(entry, index) => `
                <article class="card">
                  <div class="card-head">
                    <div class="badge">×</div>
                    <p class="card-title">Broken link #${index + 1}</p>
                  </div>
                  <div class="meta">
                    <div>
                      <p class="meta-label">Page</p>
                      <p class="meta-value">${formatValue(entry.page ?? '')}</p>
                    </div>
                    <div>
                      <p class="meta-label">Link</p>
                      <p class="meta-value">${formatValue(entry.link ?? '')}</p>
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

if (!customElements.get('broken-links-panel')) {
	customElements.define('broken-links-panel', BrokenLinksPanel);
}
