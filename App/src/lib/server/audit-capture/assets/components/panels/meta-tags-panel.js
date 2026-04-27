class MetaTagsPanel extends HTMLElement {
	constructor() {
		super();
		this.attachShadow({ mode: 'open' });
		this._panel = {
			title: 'Unoptimized Meta Tags',
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

	groupEntries(entries) {
		const groups = [];
		const groupedIndexes = new Map();

		for (const entry of entries) {
			const isDuplicate = /^Duplicate meta (title|description) detected$/.test(entry.issue ?? '');
			const groupKey = isDuplicate && entry.value ? `${entry.issue}::${entry.value}` : '';

			if (!groupKey) {
				groups.push({ ...entry, pages: entry.page ? [entry.page] : [] });
				continue;
			}

			if (!groupedIndexes.has(groupKey)) {
				groupedIndexes.set(groupKey, groups.length);
				groups.push({ ...entry, pages: [] });
			}

			const group = groups[groupedIndexes.get(groupKey)];
			if (entry.page) group.pages.push(entry.page);
		}

		return groups;
	}

	renderPageList(pages) {
		const { formatValue } = window.AutomagicHtml;
		if (!Array.isArray(pages) || pages.length === 0) return '';
		return `
      <ul class="meta-value-list">
        ${pages.map((page) => `<li>${formatValue(page)}</li>`).join('')}
      </ul>
    `;
	}

	renderValue(entry) {
		const { escapeHtml, formatValue } = window.AutomagicHtml;
		if (!entry.value) return '';
		const label = entry.issue?.includes('description') ? 'Description' : 'Title';
		return `
      <div>
        <p class="meta-label">${escapeHtml(label)}</p>
        <p class="meta-value meta-value-strong">${formatValue(entry.value)}</p>
      </div>
    `;
	}

	render() {
		const { escapeHtml, formatValue } = window.AutomagicHtml;
		const styles = window.AutomagicAuditStyles || {};
		const panel = this._panel ?? {};
		const entries = Array.isArray(panel.entries) ? panel.entries : [];
		const groups = this.groupEntries(entries);

		this.shadowRoot.innerHTML = `
      ${styles['panels-shared'] ? `<style>${styles['panels-shared']}</style>` : '<link rel="stylesheet" href="./styles/panels/shared.css">'}
      <section class="section">
        <h1 class="title">${escapeHtml(panel.title ?? 'Unoptimized Meta Tags')}</h1>
        <p class="copy">${escapeHtml(panel.description ?? '')}</p>
      </section>
      <section class="section">
        <div class="summary">
          <p class="summary-label">Detected</p>
          <p class="summary-count">${escapeHtml(panel.count ?? entries.length)}</p>
          <p class="summary-note">Meta tag issues found on ${escapeHtml(panel.domain ?? 'this domain')}</p>
        </div>
      </section>
      <section class="section">
        <div class="list">
          ${groups
						.map(
							(entry) => `
                <article class="card">
                  <div class="card-head">
                    <div class="badge">×</div>
                    <p class="card-title">${escapeHtml(entry.issue ?? 'Meta tag issue')}</p>
                  </div>
                  <div class="meta">
                    ${this.renderValue(entry)}
                    <div>
                      <p class="meta-label">${Array.isArray(entry.pages) && entry.pages.length > 1 ? 'Pages' : 'Page'}</p>
                      ${this.renderPageList(entry.pages)}
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

if (!customElements.get('meta-tags-panel')) {
	customElements.define('meta-tags-panel', MetaTagsPanel);
}
