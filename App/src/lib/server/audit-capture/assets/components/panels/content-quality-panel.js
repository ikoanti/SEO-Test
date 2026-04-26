class ContentQualityPanel extends HTMLElement {
	constructor() {
		super();
		this.attachShadow({ mode: 'open' });
		this._panel = {
			title: 'Thin Content',
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
		const { escapeHtml } = window.AutomagicHtml;
		const styles = window.AutomagicAuditStyles || {};
		const panel = this._panel ?? {};
		const entries = Array.isArray(panel.entries) ? panel.entries : [];

		this.shadowRoot.innerHTML = `
      ${styles['panels-shared'] ? `<style>${styles['panels-shared']}</style>` : '<link rel="stylesheet" href="./styles/panels/shared.css">'}
      <section class="section">
        <h1 class="title">${escapeHtml(panel.title ?? 'Thin Content')}</h1>
        <p class="copy">${escapeHtml(panel.description ?? '')}</p>
      </section>
      <section class="section">
        <div class="summary">
          <p class="summary-label">Detected</p>
          <p class="summary-count">${escapeHtml(panel.count ?? entries.length)}</p>
          <p class="summary-note">Thin content pages found on ${escapeHtml(panel.domain ?? 'this domain')}</p>
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
                    <p class="card-title">${escapeHtml(entry.issue ?? 'Thin content detected')}</p>
                  </div>
                  <div class="meta">
                    <div>
                      <p class="meta-label">Page</p>
                      <p class="meta-value">${escapeHtml(entry.page ?? '')}</p>
                    </div>
                    <div>
                      <p class="meta-label">Word Count</p>
                      <p class="meta-value">${escapeHtml(entry.wordCount ?? entry.value ?? '')}</p>
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

if (!customElements.get('content-quality-panel')) {
	customElements.define('content-quality-panel', ContentQualityPanel);
}
