const fs = require('fs');

let content = fs.readFileSync('D:\\SEO-Test-main\\server.js', 'utf8');

// Replacement 1: Design Requirements
const reqTarget = `DESIGN REQUIREMENTS:
- Dark color scheme: backgrounds #0d1117 and #161b22, text #e6edf3, muted text #8b949e
- Data visualization: Include HTML/CSS based bar charts, circular progress rings, and gauge charts to visualize key metrics.
- Visual elements:
  1. Header banner: domain name + "Mini Technical SEO & AI Audit" title, gradient background (#6366f1 to #8b5cf6)
  2. "Audit Snapshot" section: colored metric circles for PageSpeed Mobile, Desktop, Passed/Warnings/Failed counts. Green (#10b981) good, orange (#f59e0b) warnings, red (#ef4444) failures
  3. Horizontal pass/warn/fail progress bar
  4. Problem cards: dark background (#161b22), 4px left border colored by priority — red (#ef4444) for Urgent, orange (#f59e0b) for High, yellow (#eab308) for Medium. Rounded corners (8px), border (1px solid #30363d), box shadow, 20px padding, 16px margin-bottom
  5. Quick Win cards: same style but 4px GREEN (#10b981) left border`;

const reqReplacement = `DESIGN REQUIREMENTS:
- Simple, clean document styling resembling a regular Google Doc or printed report (white/light background #ffffff, dark text #333333, muted text #666666). NO dark mode backgrounds.
- Data visualization: Include simple HTML/CSS based bar charts, circular progress rings, and gauge charts to visualize key metrics using clean, professional styling.
- Visual elements:
  1. Header banner: domain name + "Mini Technical SEO & AI Audit" title, clean white background with a subtle border or light gray shading (#f8f9fa).
  2. "Audit Snapshot" section: colored metric circles for PageSpeed Mobile, Desktop, Passed/Warnings/Failed counts. Green (#10b981) good, orange (#f59e0b) warnings, red (#ef4444) failures
  3. Horizontal pass/warn/fail progress bar
  4. Problem cards: clean white background (#ffffff), 4px left border colored by priority — red (#ef4444) for Urgent, orange (#f59e0b) for High, yellow (#eab308) for Medium. Clean square or slightly rounded corners (4px), light gray border (1px solid #e5e7eb), subtle shadow, 20px padding, 16px margin-bottom
  5. Quick Win cards: same style but 4px GREEN (#10b981) left border`;

content = content.replace(new RegExp(reqTarget.replace(/\\n/g, '\\r?\\n')), reqReplacement);

// Replacement 2: HTML Template Block
const blockTarget = `<div style="background:#161b22; border-left:4px solid [COLOR_BY_PRIORITY]; border:1px solid #30363d; border-radius:8px; padding:20px; margin-bottom:16px; box-shadow:0 2px 8px rgba(0,0,0,0.3);">
  <h3 style="color:[COLOR_BY_PRIORITY]; margin:0 0 4px 0;">[EMOJI] Problem N: [Descriptive Title]</h3>
  <div style="color:#8b949e; font-size:0.85rem; margin-bottom:12px;">Priority: [Urgent | High | Medium]</div>
  <p style="color:#e6edf3; line-height:1.7;">[2-4 paragraphs of detailed explanation with exact numbers from the audit data. Explain WHY this is a problem, what the negative SEO/traffic/conversion impact is, and what fixing it would achieve. Use the same consultative, critical tone as these examples:]</p>
</div>`;

const blockReplacement = `<div style="background:#ffffff; border-left:4px solid [COLOR_BY_PRIORITY]; border:1px solid #e5e7eb; border-radius:4px; padding:20px; margin-bottom:16px; box-shadow:0 1px 3px rgba(0,0,0,0.1);">
  <h3 style="color:[COLOR_BY_PRIORITY]; margin:0 0 4px 0;">[EMOJI] Problem N: [Descriptive Title]</h3>
  <div style="color:#666666; font-size:0.85rem; margin-bottom:12px;">Priority: [Urgent | High | Medium]</div>
  <p style="color:#333333; line-height:1.7;">[2-4 paragraphs of detailed explanation with exact numbers from the audit data. Explain WHY this is a problem, what the negative SEO/traffic/conversion impact is, and what fixing it would achieve. Use the same consultative, critical tone as these examples:]</p>
</div>`;

content = content.replace(new RegExp(blockTarget.replace(/\\n/g, '\\r?\\n')), blockReplacement);

fs.writeFileSync('D:\\SEO-Test-main\\server.js', content, 'utf8');
console.log("Success");
