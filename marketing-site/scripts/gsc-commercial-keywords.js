#!/usr/bin/env node

/**
 * Google Search Console Commercial Keyword Analysis
 * Focus on product/commercial queries, not club name searches
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { google } from 'googleapis';
import { resolve, dirname } from 'path';

const CREDENTIALS_PATH = resolve(process.env.HOME, '.config/google/clawd-docs.json');
const SITE_URL = 'sc-domain:swimly.uk';
const DAYS_BACK = 28;

// Commercial keyword patterns
const COMMERCIAL_PATTERNS = [
  /swim(ming)?\s*club\s*software/i,
  /swim(ming)?\s*club\s*management/i,
  /swim(ming)?\s*club\s*billing/i,
  /swim(ming)?\s*club\s*app/i,
  /swim(ming)?\s*club\s*membership/i,
  /swim(ming)?\s*club\s*payment/i,
  /swim(ming)?\s*club\s*direct\s*debit/i,
  /swim(ming)?\s*club\s*fees/i,
  /swim(ming)?\s*club\s*attendance/i,
  /swim(ming)?\s*club\s*system/i,
  /swim(ming)?\s*school\s*software/i,
  /swim(ming)?\s*school\s*management/i,
  /club\s*management\s*software/i,
  /membership\s*management/i,
  /how\s*to\s*(manage|run|collect)/i,
  /teamunify/i,
  /swimclub\s*manager/i,
  /club\s*organiser/i,
  /gomotion/i,
  /clubspark/i,
  /alternative/i,
  /comparison/i,
  /best\s*swim/i,
  /vs\s/i,
  /compared/i,
];

// Exclude club name patterns
const EXCLUDE_PATTERNS = [
  /^\w+\s+(swimming|sc|asc)\s+club$/i, // "cityname swimming club"
  /^swimming\s+club\s+\w+$/i, // "swimming club cityname"
  /^\w+\s+stingrays$/i,
  /^\w+\s+dolphins$/i,
  /^\w+\s+sharks$/i,
  /^\w+\s+seals$/i,
  /atlantis$/i,
  /\s(sc|asc)$/i, // ending in sc/asc
];

function isCommercialQuery(query) {
  // Exclude club names first
  for (const pattern of EXCLUDE_PATTERNS) {
    if (pattern.test(query)) {
      return false;
    }
  }

  // Check if matches commercial patterns
  for (const pattern of COMMERCIAL_PATTERNS) {
    if (pattern.test(query)) {
      return true;
    }
  }

  return false;
}

async function authenticate() {
  const credentials = JSON.parse(await readFile(CREDENTIALS_PATH, 'utf8'));
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
  });
  return await auth.getClient();
}

function getDateString(daysAgo = 0) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().split('T')[0];
}

async function main() {
  console.log(`\n🎯 Commercial Keyword Analysis (Last ${DAYS_BACK} days)\n`);

  const auth = await authenticate();
  const searchconsole = google.searchconsole({ version: 'v1', auth });

  const startDate = getDateString(DAYS_BACK);
  const endDate = getDateString(0);

  // Fetch ALL queries with their pages
  console.log('Fetching query data from GSC...');
  const response = await searchconsole.searchanalytics.query({
    siteUrl: SITE_URL,
    requestBody: {
      startDate,
      endDate,
      dimensions: ['query', 'page'],
      rowLimit: 25000, // Max
    },
  });

  const allRows = response.data.rows || [];
  console.log(`Retrieved ${allRows.length} query-page combinations\n`);

  // Filter for commercial queries
  const commercialRows = allRows
    .filter((row) => isCommercialQuery(row.keys[0]))
    .map((row) => ({
      query: row.keys[0],
      page: row.keys[1],
      clicks: row.clicks || 0,
      impressions: row.impressions || 0,
      ctr: ((row.ctr || 0) * 100).toFixed(2),
      position: (row.position || 0).toFixed(1),
    }))
    .sort((a, b) => parseFloat(a.position) - parseFloat(b.position));

  console.log(`Found ${commercialRows.length} commercial query-page combinations\n`);

  // Group by position ranges
  const page1 = commercialRows.filter((r) => r.position < 10);
  const page2to5 = commercialRows.filter((r) => r.position >= 10 && r.position <= 50);
  const beyond50 = commercialRows.filter((r) => r.position > 50);

  console.log(`Position 1-9 (Page 1): ${page1.length}`);
  console.log(`Position 10-50 (Pages 2-5): ${page2to5.length}`);
  console.log(`Position 50+: ${beyond50.length}\n`);

  // Generate markdown report
  let report = `# Commercial Keyword Analysis: swimly.uk\n\n`;
  report += `**Analysis Period:** ${startDate} to ${endDate} (${DAYS_BACK} days)  \n`;
  report += `**Generated:** ${new Date().toISOString().split('T')[0]}\n\n`;

  report += `## Executive Summary\n\n`;
  report += `- **Total commercial queries tracked:** ${commercialRows.length}\n`;
  report += `- **Ranking on Page 1 (positions 1-9):** ${page1.length}\n`;
  report += `- **Ranking on Pages 2-5 (positions 10-50):** ${page2to5.length}\n`;
  report += `- **Beyond Page 5 (position 50+):** ${beyond50.length}\n\n`;

  if (page1.length > 0) {
    report += `## Page 1 Rankings (Position 1-9)\n\n`;
    report += `These are performing well. Monitor and optimise further for position 1-3.\n\n`;
    report += `| Query | Page | Position | Impressions | Clicks | CTR |\n`;
    report += `|-------|------|----------|-------------|--------|-----|\n`;
    page1.forEach((row) => {
      const path = new URL(row.page).pathname;
      report += `| ${row.query} | ${path} | ${row.position} | ${row.impressions} | ${row.clicks} | ${row.ctr}% |\n`;
    });
    report += `\n`;
  }

  if (page2to5.length > 0) {
    report += `## Pages 2-5 Rankings (Position 10-50) - PRIORITY FOR IMPROVEMENT\n\n`;
    report += `These queries have potential. Push them to Page 1 with targeted content improvements.\n\n`;
    report += `| Query | Page | Position | Impressions | Clicks | CTR |\n`;
    report += `|-------|------|----------|-------------|--------|-----|\n`;
    page2to5.forEach((row) => {
      const path = new URL(row.page).pathname;
      report += `| ${row.query} | ${path} | ${row.position} | ${row.impressions} | ${row.clicks} | ${row.ctr}% |\n`;
    });
    report += `\n`;
  } else {
    report += `## Pages 2-5 Rankings (Position 10-50)\n\n`;
    report += `No commercial queries currently ranking in this range.\n\n`;
  }

  if (beyond50.length > 0) {
    report += `## Beyond Page 5 (Position 50+)\n\n`;
    report += `These need significant work or may indicate missing dedicated landing pages.\n\n`;
    report += `| Query | Page | Position | Impressions |\n`;
    report += `|-------|------|----------|-------------|\n`;
    beyond50.slice(0, 20).forEach((row) => {
      const path = new URL(row.page).pathname;
      report += `| ${row.query} | ${path} | ${row.position} | ${row.impressions} |\n`;
    });
    if (beyond50.length > 20) {
      report += `\n*Showing top 20 of ${beyond50.length} queries beyond position 50*\n`;
    }
    report += `\n`;
  }

  // Recommendations
  report += `## Recommendations\n\n`;

  if (page2to5.length > 0) {
    report += `### Priority 1: Push Page 2-5 Rankings to Page 1\n\n`;

    // Group by page
    const pageGroups = {};
    page2to5.forEach((row) => {
      const path = new URL(row.page).pathname;
      if (!pageGroups[path]) {
        pageGroups[path] = [];
      }
      pageGroups[path].push(row);
    });

    Object.entries(pageGroups).forEach(([path, queries]) => {
      report += `**${path}**\n`;
      report += `Ranking for ${queries.length} commercial ${queries.length === 1 ? 'query' : 'queries'}:\n`;
      queries.forEach((q) => {
        report += `- "${q.query}" (position ${q.position})\n`;
      });
      report += `\nActions:\n`;
      report += `- Review content depth and relevance for these queries\n`;
      report += `- Add FAQ sections targeting these specific questions\n`;
      report += `- Improve internal linking to this page\n`;
      report += `- Consider adding supporting schema markup\n`;
      report += `- Ensure meta title/description optimised for top query\n\n`;
    });
  }

  if (beyond50.length > 0) {
    report += `### Priority 2: Create Dedicated Landing Pages\n\n`;
    report += `Queries ranking 50+ may lack dedicated, optimised pages. Consider:\n\n`;

    // Find common themes
    const themes = {
      software: beyond50.filter((r) => /software/i.test(r.query)),
      billing: beyond50.filter((r) => /billing|payment|fees|direct debit/i.test(r.query)),
      management: beyond50.filter((r) => /management|manage/i.test(r.query)),
      comparison: beyond50.filter((r) => /vs|alternative|comparison|compared/i.test(r.query)),
      other: [],
    };

    themes.other = beyond50.filter(
      (r) =>
        !themes.software.includes(r) &&
        !themes.billing.includes(r) &&
        !themes.management.includes(r) &&
        !themes.comparison.includes(r)
    );

    if (themes.software.length > 0) {
      report += `**Software/Product queries (${themes.software.length}):**\n`;
      themes.software.slice(0, 5).forEach((r) => (report += `- "${r.query}"\n`));
      report += `\nConsider: Enhanced product pages, clearer value propositions\n\n`;
    }

    if (themes.billing.length > 0) {
      report += `**Billing/Payment queries (${themes.billing.length}):**\n`;
      themes.billing.slice(0, 5).forEach((r) => (report += `- "${r.query}"\n`));
      report += `\nConsider: Dedicated billing feature page expansion or guide\n\n`;
    }

    if (themes.management.length > 0) {
      report += `**Management queries (${themes.management.length}):**\n`;
      themes.management.slice(0, 5).forEach((r) => (report += `- "${r.query}"\n`));
      report += `\nConsider: "How to manage a swimming club" comprehensive guide\n\n`;
    }

    if (themes.comparison.length > 0) {
      report += `**Comparison queries (${themes.comparison.length}):**\n`;
      themes.comparison.slice(0, 5).forEach((r) => (report += `- "${r.query}"\n`));
      report += `\nConsider: Additional comparison pages or roundup article\n\n`;
    }
  }

  report += `## Next Steps\n\n`;
  report += `1. Review pages ranking positions 10-50 and implement content improvements\n`;
  report += `2. Create missing landing pages for high-impression queries with poor rankings\n`;
  report += `3. Build internal links from blog posts to commercial pages\n`;
  report += `4. Monitor changes over next 28 days and measure improvement\n`;
  report += `5. Consider running this report monthly to track progress\n`;

  // Save report
  const reportsDir = resolve(process.env.HOME, 'clawd/projects/swim-team/reports');
  await mkdir(reportsDir, { recursive: true });
  const reportPath = resolve(reportsDir, 'seo-commercial-keywords-march-2026.md');
  await writeFile(reportPath, report);

  console.log(`\n✅ Report saved to: ${reportPath}\n`);

  // Also print summary to console
  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  console.log(`Page 1 (1-9): ${page1.length} queries`);
  console.log(`Pages 2-5 (10-50): ${page2to5.length} queries - PRIORITY FOR IMPROVEMENT`);
  console.log(`Beyond Page 5 (50+): ${beyond50.length} queries - NEED LANDING PAGES`);
  console.log('='.repeat(80) + '\n');
}

main().catch((error) => {
  console.error('Error:', error.message);
  process.exit(1);
});
