#!/usr/bin/env node

/**
 * Canonical URL Verification Tool
 * Checks that all internal links, sitemaps, and structured data use non-www URLs
 *
 * Purpose:
 * - Verify swimly.uk (not www.swimly.uk) is used consistently
 * - Catch any www URLs that would confuse Google
 * - Ensure clean canonical signal
 *
 * Usage:
 *   node gsc-verify-canonicals.js
 */

import { readdir, readFile } from 'fs/promises';
import { resolve, join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST_DIR = resolve(__dirname, '../dist');
const WWW_PATTERN = /https?:\/\/www\.swimly\.uk/gi;
const CANONICAL_DOMAIN = 'https://swimly.uk';

/**
 * Recursively find all HTML and XML files
 */
async function findFiles(dir, pattern = /\.(html|xml)$/) {
  const files = [];

  async function scan(currentDir) {
    const entries = await readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name);

      if (entry.isDirectory()) {
        await scan(fullPath);
      } else if (pattern.test(entry.name)) {
        files.push(fullPath);
      }
    }
  }

  await scan(dir);
  return files;
}

/**
 * Check file for www URLs
 */
async function checkFile(filePath) {
  const content = await readFile(filePath, 'utf8');
  const matches = content.match(WWW_PATTERN);

  if (!matches) {
    return { clean: true };
  }

  // Extract context around each match
  const issues = matches.map((match) => {
    const index = content.indexOf(match);
    const start = Math.max(0, index - 50);
    const end = Math.min(content.length, index + match.length + 50);
    const context = content.substring(start, end);

    return {
      url: match,
      context: context.replace(/\n/g, ' ').trim(),
    };
  });

  return {
    clean: false,
    count: matches.length,
    issues,
  };
}

/**
 * Main execution
 */
async function main() {
  console.log('🔍 Canonical URL Verification Tool\n');
  console.log(`📁 Scanning: ${DIST_DIR}`);
  console.log(`🎯 Looking for: www.swimly.uk (should be swimly.uk)\n`);

  try {
    const files = await findFiles(DIST_DIR);
    console.log(`   Found ${files.length} HTML/XML files\n`);

    let totalIssues = 0;
    const problematicFiles = [];

    for (const file of files) {
      const relativePath = file.replace(DIST_DIR, '');
      const result = await checkFile(file);

      if (!result.clean) {
        totalIssues += result.count;
        problematicFiles.push({
          path: relativePath,
          ...result,
        });
      }
    }

    if (totalIssues === 0) {
      console.log('✅ All files clean! No www URLs found.\n');
      console.log('   All internal references use:', CANONICAL_DOMAIN);
      console.log('   Canonical signal: STRONG ✓\n');
      return;
    }

    console.log(
      `⚠️  Found ${totalIssues} www URL references in ${problematicFiles.length} files:\n`
    );

    for (const file of problematicFiles) {
      console.log(`📄 ${file.path} (${file.count} issue${file.count > 1 ? 's' : ''})`);

      for (const issue of file.issues.slice(0, 3)) {
        console.log(`   ❌ ${issue.url}`);
        console.log(`      ...${issue.context}...`);
      }

      if (file.issues.length > 3) {
        console.log(`   ... and ${file.issues.length - 3} more`);
      }

      console.log('');
    }

    console.log('🔧 Fix Required:\n');
    console.log('   1. Find source files generating these URLs');
    console.log('   2. Replace www.swimly.uk with swimly.uk');
    console.log('   3. Rebuild site and re-run this script');
    console.log('   4. Re-submit sitemap to GSC after fixing\n');

    process.exit(1);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
