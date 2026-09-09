#!/usr/bin/env node

/**
 * Keyword Ranking Tracker
 * Uses DataForSEO SERP API to check swimly.uk rankings for priority keywords
 *
 * Usage:
 *   node track-keyword-rankings.js
 */

import https from 'https';
import { writeFile } from 'fs/promises';

const DATAFORSEO_LOGIN = process.env.DATAFORSEO_LOGIN || 'mike@elysium-studios.co.uk';
const DATAFORSEO_PASSWORD = process.env.DATAFORSEO_PASSWORD || 'd886a68c67b470d9';
const TARGET_DOMAIN = 'swimly.uk';

const PRIORITY_KEYWORDS = [
  // Cluster 1: Direct Product
  { keyword: 'swim club management software', cluster: 'Direct Product' },
  { keyword: 'swimming club software UK', cluster: 'Direct Product' },
  { keyword: 'swim club app', cluster: 'Direct Product' },
  { keyword: 'swim club billing software', cluster: 'Direct Product' },

  // Cluster 2: Problem-Based
  { keyword: 'how to collect swim club fees', cluster: 'Problem-Based' },
  { keyword: 'swim club direct debit', cluster: 'Problem-Based' },
  { keyword: 'swimming club payment software', cluster: 'Problem-Based' },

  // Cluster 3: Comparison
  { keyword: 'SwimClub Manager alternative', cluster: 'Comparison' },
  { keyword: 'best swim club software UK', cluster: 'Comparison' },

  // Cluster 4: Compliance
  { keyword: 'Wavepower swimming club requirements', cluster: 'Compliance' },
  { keyword: 'swim club GDPR compliance', cluster: 'Compliance' },
  { keyword: 'swim club DBS check requirements', cluster: 'Compliance' },

  // Cluster 5: Operational
  { keyword: 'how to run a swimming club committee', cluster: 'Operational' },
  { keyword: 'swim club AGM agenda', cluster: 'Operational' },

  // Cluster 6: Local
  { keyword: 'swimming club software London', cluster: 'Local' },
  { keyword: 'swim club management Kent', cluster: 'Local' },
];

/**
 * Make DataForSEO API request
 */
function makeRequest(endpoint, data) {
  return new Promise((resolve, reject) => {
    const auth = Buffer.from(`${DATAFORSEO_LOGIN}:${DATAFORSEO_PASSWORD}`).toString('base64');
    const postData = JSON.stringify(data);

    const options = {
      hostname: 'api.dataforseo.com',
      path: endpoint,
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(new Error('Invalid JSON response'));
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

/**
 * Check ranking for a single keyword
 */
async function checkKeywordRanking(keyword) {
  const payload = [
    {
      language_code: 'en',
      location_code: 2826, // United Kingdom
      keyword,
      depth: 100, // Check top 100 results
      device: 'desktop',
      os: 'windows',
    },
  ];

  try {
    const response = await makeRequest('/v3/serp/google/organic/live/advanced', payload);

    if (response.status_code === 20000) {
      const items = response.tasks[0].result[0].items || [];

      // Find swimly.uk in results
      let position = null;
      let url = null;
      let title = null;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type === 'organic') {
          const domain = item.domain || '';
          if (domain.includes(TARGET_DOMAIN)) {
            position = item.rank_absolute;
            url = item.url;
            title = item.title;
            break;
          }
        }
      }

      // Get top 3 competitors
      const competitors = items
        .filter((item) => item.type === 'organic' && !item.domain?.includes(TARGET_DOMAIN))
        .slice(0, 3)
        .map((item) => ({
          position: item.rank_absolute,
          domain: item.domain,
          url: item.url,
          title: item.title,
        }));

      return {
        keyword,
        position,
        url,
        title,
        competitors,
      };
    } else {
      throw new Error(`API Error: ${response.status_message}`);
    }
  } catch (error) {
    console.error(`Error checking "${keyword}":`, error.message);
    return {
      keyword,
      position: null,
      url: null,
      title: null,
      competitors: [],
      error: error.message,
    };
  }
}

/**
 * Add delay between requests (rate limiting)
 */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Main execution
 */
async function main() {
  console.log('🔍 Swimly Keyword Ranking Tracker');
  console.log(`📅 Date: ${new Date().toISOString().split('T')[0]}`);
  console.log(`🎯 Target: ${TARGET_DOMAIN}`);
  console.log(`📊 Keywords: ${PRIORITY_KEYWORDS.length}\n`);

  const results = [];
  let quickWins = [];
  let contentGaps = [];

  for (let i = 0; i < PRIORITY_KEYWORDS.length; i++) {
    const item = PRIORITY_KEYWORDS[i];
    console.log(`[${i + 1}/${PRIORITY_KEYWORDS.length}] Checking: "${item.keyword}"...`);

    const result = await checkKeywordRanking(item.keyword);
    results.push({
      ...item,
      ...result,
      date: new Date().toISOString().split('T')[0],
    });

    if (result.position) {
      console.log(`   ✅ Position ${result.position}`);

      // Quick win: ranking 11-30 (page 2-3)
      if (result.position >= 11 && result.position <= 30) {
        quickWins.push({
          keyword: item.keyword,
          position: result.position,
          url: result.url,
        });
      }
    } else {
      console.log(`   ❌ Not ranking in top 100`);

      // Content gap: not ranking at all
      contentGaps.push({
        keyword: item.keyword,
        cluster: item.cluster,
        topCompetitors: result.competitors,
      });
    }

    // Rate limiting: 1 request per second
    if (i < PRIORITY_KEYWORDS.length - 1) {
      await delay(1000);
    }
  }

  console.log('\n📈 Results Summary\n');

  // Group by cluster
  const byCluster = results.reduce((acc, r) => {
    if (!acc[r.cluster]) acc[r.cluster] = [];
    acc[r.cluster].push(r);
    return acc;
  }, {});

  for (const [cluster, keywords] of Object.entries(byCluster)) {
    console.log(`\n${cluster}:`);
    keywords.forEach((k) => {
      const pos = k.position ? `#${k.position}` : 'Not ranking';
      console.log(`  ${pos.padEnd(15)} ${k.keyword}`);
    });
  }

  console.log('\n🎯 Quick Wins (Ranking 11-30):\n');
  if (quickWins.length === 0) {
    console.log('  None found (either ranking top 10 or not at all)\n');
  } else {
    quickWins.forEach((qw) => {
      console.log(`  #${qw.position} - ${qw.keyword}`);
      console.log(`       ${qw.url}\n`);
    });
  }

  console.log('📝 Content Gaps (Not Ranking):\n');
  if (contentGaps.length === 0) {
    console.log('  None! All keywords ranking.\n');
  } else {
    contentGaps.forEach((gap) => {
      console.log(`  "${gap.keyword}" (${gap.cluster})`);
      if (gap.topCompetitors.length > 0) {
        console.log('     Top competitors:');
        gap.topCompetitors.forEach((c) => {
          console.log(`       #${c.position} - ${c.domain}`);
        });
      }
      console.log('');
    });
  }

  // Save to JSON
  const outputFile = `../docs/keyword-rankings-${new Date().toISOString().split('T')[0]}.json`;
  await writeFile(
    outputFile,
    JSON.stringify(
      {
        date: new Date().toISOString().split('T')[0],
        target: TARGET_DOMAIN,
        keywords: results,
        quickWins,
        contentGaps,
        summary: {
          totalKeywords: results.length,
          ranking: results.filter((r) => r.position).length,
          notRanking: results.filter((r) => !r.position).length,
          top10: results.filter((r) => r.position && r.position <= 10).length,
          page2: results.filter((r) => r.position && r.position >= 11 && r.position <= 20).length,
          page3: results.filter((r) => r.position && r.position >= 21 && r.position <= 30).length,
        },
      },
      null,
      2
    )
  );

  console.log(`\n💾 Results saved to: ${outputFile}\n`);

  // Create markdown report
  const mdReport = generateMarkdownReport(results, quickWins, contentGaps);
  const mdFile = `../docs/KEYWORD-BASELINE-${new Date().toISOString().split('T')[0]}.md`;
  await writeFile(mdFile, mdReport);

  console.log(`📄 Report saved to: ${mdFile}\n`);
}

/**
 * Generate markdown report
 */
function generateMarkdownReport(results, quickWins, contentGaps) {
  const date = new Date().toISOString().split('T')[0];
  const ranking = results.filter((r) => r.position).length;
  const notRanking = results.filter((r) => !r.position).length;
  const top10 = results.filter((r) => r.position && r.position <= 10).length;

  let md = `# Keyword Ranking Baseline — Swimly\n`;
  md += `**Date:** ${date}  \n`;
  md += `**Domain:** ${TARGET_DOMAIN}  \n`;
  md += `**Keywords Tracked:** ${results.length}\n\n`;
  md += `---\n\n`;

  md += `## Summary\n\n`;
  md += `- **Ranking in top 100:** ${ranking} keywords\n`;
  md += `- **Not ranking:** ${notRanking} keywords\n`;
  md += `- **Top 10:** ${top10} keywords\n`;
  md += `- **Quick wins (11-30):** ${quickWins.length} keywords\n\n`;

  md += `---\n\n`;
  md += `## Rankings by Cluster\n\n`;

  const byCluster = results.reduce((acc, r) => {
    if (!acc[r.cluster]) acc[r.cluster] = [];
    acc[r.cluster].push(r);
    return acc;
  }, {});

  for (const [cluster, keywords] of Object.entries(byCluster)) {
    md += `### ${cluster}\n\n`;
    md += `| Keyword | Position | URL |\n`;
    md += `|---------|----------|-----|\n`;
    keywords.forEach((k) => {
      const pos = k.position ? `#${k.position}` : 'Not ranking';
      const url = k.url ? `[Link](${k.url})` : '-';
      md += `| ${k.keyword} | ${pos} | ${url} |\n`;
    });
    md += `\n`;
  }

  md += `---\n\n`;
  md += `## Quick Wins (Position 11-30)\n\n`;

  if (quickWins.length === 0) {
    md += `No quick wins identified. Keywords are either ranking top 10 or not ranking at all.\n\n`;
  } else {
    md += `These keywords are on page 2-3 of Google. Small improvements could push them to page 1.\n\n`;
    quickWins.forEach((qw) => {
      md += `### "${qw.keyword}" — Position ${qw.position}\n`;
      md += `- **Current URL:** ${qw.url}\n`;
      md += `- **Action:** Improve content, add internal links, build backlinks\n\n`;
    });
  }

  md += `---\n\n`;
  md += `## Content Gaps (Not Ranking)\n\n`;

  if (contentGaps.length === 0) {
    md += `Excellent! All tracked keywords are ranking in top 100.\n\n`;
  } else {
    md += `These keywords need dedicated content or better optimisation.\n\n`;
    contentGaps.forEach((gap) => {
      md += `### "${gap.keyword}" (${gap.cluster})\n`;
      md += `**Top Competitors:**\n`;
      if (gap.topCompetitors.length > 0) {
        gap.topCompetitors.forEach((c) => {
          md += `- #${c.position}: ${c.domain} — [${c.title}](${c.url})\n`;
        });
      } else {
        md += `- No competitors found\n`;
      }
      md += `\n`;
    });
  }

  md += `---\n\n`;
  md += `## Next Steps\n\n`;
  md += `1. **Monitor monthly:** Re-run this tracker on the 1st of each month\n`;
  md += `2. **Focus on quick wins:** Target keywords ranking 11-30 first\n`;
  md += `3. **Create content for gaps:** Write blog posts targeting non-ranking keywords\n`;
  md += `4. **Track in GSC:** Compare with Google Search Console data\n\n`;

  md += `---\n\n`;
  md += `**Generated:** ${new Date().toISOString()}  \n`;
  md += `**Tool:** DataForSEO SERP API  \n`;
  md += `**Location:** United Kingdom (location_code: 2826)\n`;

  return md;
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
