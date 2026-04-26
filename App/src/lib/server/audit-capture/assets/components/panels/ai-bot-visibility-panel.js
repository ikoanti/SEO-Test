const EXPECTED_BOTS = [
	'Googlebot',
	'AdsBot-Google',
	'Bingbot',
	'Yandex',
	'DuckDuckBot',
	'Baiduspider',
	'GPTBot',
	'ChatGPT',
	'ChatGPT-User',
	'OpenAI',
	'OAI-SearchBot',
	'Google-Extended',
	'anthropic-ai',
	'ClaudeBot',
	'CCBot',
	'PerplexityBot',
	'FacebookBot',
	'Applebot-Extended',
	'Amazonbot',
	'Bytespider'
];

function computeMissingAgents(foundAgents) {
	const normalized = Array.isArray(foundAgents) ? foundAgents : [];
	const hasWildcard = normalized.some((agent) => String(agent).trim() === '*');
	return EXPECTED_BOTS.filter((bot) => {
		const hasSpecific = normalized.some(
			(agent) => String(agent).trim().toLowerCase() === bot.toLowerCase()
		);
		if (bot.toLowerCase() === 'googlebot' && !hasSpecific && hasWildcard) {
			return false;
		}
		return !hasSpecific;
	});
}

class AIBotVisibilityPanel extends HTMLElement {
	constructor() {
		super();
		this.attachShadow({ mode: 'open' });
		this._panel = {
			title: 'Unoptimized Robots.txt',
			description: '',
			domain: 'this domain',
			foundAgents: []
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
		const missingAgents = computeMissingAgents(panel.foundAgents);
		this.shadowRoot.innerHTML = `
      ${styles['panels-shared'] ? `<style>${styles['panels-shared']}</style>` : '<link rel="stylesheet" href="./styles/panels/shared.css">'}
      ${styles['ai-bot-visibility-panel'] ? `<style>${styles['ai-bot-visibility-panel']}</style>` : '<link rel="stylesheet" href="./styles/panels/ai-bot-visibility-panel.css">'}
      <section class="section">
        <h1 class="title">${escapeHtml(panel.title ?? 'Unoptimized Robots.txt')}</h1>
        <p class="copy">${escapeHtml(panel.description ?? '')}</p>
      </section>
      <section class="section">
        <div class="summary">
          <p class="summary-label">Missing</p>
          <p class="summary-count">${escapeHtml(missingAgents.length)}</p>
          <p class="summary-note">AI crawler user-agents missing on ${escapeHtml(panel.domain ?? 'this domain')}</p>
        </div>
      </section>
      <section class="section">
        <div class="list">
          ${missingAgents
						.map(
							(agent) => `
                <article class="card">
                  <div class="card-head">
                    <div class="badge">×</div>
                    <p class="card-title">Missing ${escapeHtml(agent)}</p>
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

if (!customElements.get('ai-bot-visibility-panel')) {
	customElements.define('ai-bot-visibility-panel', AIBotVisibilityPanel);
}
