const fs = require('fs');

let content = fs.readFileSync('D:\\SEO-Test-main\\server.js', 'utf8');

const target = `═══ SECTION 3 — AUDIT SNAPSHOT & AI VISIBILITY ═══
Visual metrics dashboard with PageSpeed scores, Speed Index commentary, pass/warn/fail counts, and progress bars.
Include a critical "AI Visibility" sub-section with commentary on: AI Visibility Score, Monthly Audience, Mentions, Topic Opportunities — highlight how the current AI visibility is leaving massive opportunities on the table. Create CSS-based illustrations (bar charts or gauge charts) for these scores.
Also comment critically on PageSpeed scores and Speed Index, highlighting negative impact on user retention and rankings.`;

const replacement = `═══ SECTION 3 — AUDIT SNAPSHOT, SPEED INDEX & AI VISIBILITY ═══
Visual metrics dashboard with pass/warn/fail counts and progress bars.
Create a dedicated "Speed Index & Performance" sub-section: Include CSS-based visual gauges, data cards, or bar charts for PageSpeed Mobile/Desktop scores, and explicitly highlight Speed Index metrics (FCP, LCP, CLS, TBT) using styled visual boxes or progress rings. Comment critically on these scores and their negative impact on user retention and rankings.
Include a "Domain Authority" sub-section featuring Open Page Rank data: Create a beautiful visual representation (e.g., a styled badge, rank bar, or data card) for the Page Rank and Global Rank, commenting on site authority.
Include a critical "AI Visibility" sub-section with commentary on: AI Visibility Score, Monthly Audience, Mentions, Topic Opportunities — highlight how the current AI visibility is leaving massive opportunities on the table. Create CSS-based illustrations (bar charts or gauge charts) for these scores.`;

// Handle \r\n vs \n
const targetRegex = new RegExp(target.replace(/\n/g, '\\r?\\n'));

if (targetRegex.test(content)) {
    content = content.replace(targetRegex, replacement);
    fs.writeFileSync('D:\\SEO-Test-main\\server.js', content, 'utf8');
    console.log("Success");
} else {
    console.log("Target not found");
}
