#!/usr/bin/env node
/**
 * Device Mockup Generator
 *
 * Takes screenshots and places them into realistic device frames
 * (MacBook Pro, iPhone 15, iPad) using HTML/CSS rendered via Playwright.
 */

import { chromium } from '@playwright/test';
import sharp from 'sharp';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Overridable so the regional captures can be framed into their own folders,
// for example SCREENSHOTS_DIR=public/images/app-screenshots/us
// MOCKUPS_DIR=public/mockups/us. Defaults keep the original UK behaviour.
const SCREENSHOTS_DIR = process.env.SCREENSHOTS_DIR
  ? path.resolve(process.cwd(), process.env.SCREENSHOTS_DIR)
  : path.join(process.cwd(), 'public', 'screenshots');
const MOCKUPS_DIR = process.env.MOCKUPS_DIR
  ? path.resolve(process.cwd(), process.env.MOCKUPS_DIR)
  : path.join(process.cwd(), 'public', 'mockups');

// Device frame dimensions and styling
const DEVICES = {
  macbook: {
    name: 'MacBook Pro',
    screenWidth: 1440,
    screenHeight: 900,
    maxOutputWidth: 1200,
    // Realistic MacBook Pro 16" bezel proportions
    bezelTop: 8,
    bezelBottom: 50, // Larger for the bottom chin
    bezelLeft: 8,
    bezelRight: 8,
    cornerRadius: 12,
    shadowBlur: 60,
    shadowOpacity: 0.3,
  },
  iphone: {
    name: 'iPhone 15',
    screenWidth: 390,
    screenHeight: 844,
    maxOutputWidth: 600,
    // iPhone 15 has uniform bezels with Dynamic Island
    bezelTop: 20,
    bezelBottom: 20,
    bezelLeft: 4,
    bezelRight: 4,
    cornerRadius: 55,
    shadowBlur: 40,
    shadowOpacity: 0.25,
    notch: true, // Add Dynamic Island
  },
  ipad: {
    name: 'iPad Pro',
    screenWidth: 1024,
    screenHeight: 1366,
    maxOutputWidth: 800,
    bezelTop: 30,
    bezelBottom: 30,
    bezelLeft: 30,
    bezelRight: 30,
    cornerRadius: 30,
    shadowBlur: 50,
    shadowOpacity: 0.28,
  },
};

/**
 * Generate HTML for device mockup
 */
function generateDeviceHTML(device, screenshotPath, screenshotName) {
  const d = DEVICES[device];
  const totalWidth = d.screenWidth + d.bezelLeft + d.bezelRight;
  const totalHeight = d.screenHeight + d.bezelTop + d.bezelBottom;

  // Calculate viewport to ensure we have enough space for shadows
  const viewportWidth = totalWidth + d.shadowBlur * 2;
  const viewportHeight = totalHeight + d.shadowBlur * 2;

  const shadowOffset = d.shadowBlur;

  // Dynamic Island for iPhone
  const dynamicIsland =
    device === 'iphone'
      ? `
    <div style="
      position: absolute;
      top: ${shadowOffset + 8}px;
      left: 50%;
      transform: translateX(-50%);
      width: 126px;
      height: 37px;
      background: #000;
      border-radius: 19px;
      z-index: 10;
    "></div>
  `
      : '';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: ${shadowOffset}px;
    }
    .device-container {
      position: relative;
      width: ${totalWidth}px;
      height: ${totalHeight}px;
      margin: ${shadowOffset}px;
    }
    .device-frame {
      position: relative;
      width: 100%;
      height: 100%;
      background: ${
        device === 'macbook'
          ? 'linear-gradient(135deg, #2d3436 0%, #1e272e 100%)'
          : device === 'iphone'
            ? 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)'
            : '#2d3436'
      };
      border-radius: ${d.cornerRadius}px;
      box-shadow: 
        0 ${shadowOffset / 2}px ${d.shadowBlur}px rgba(0, 0, 0, ${d.shadowOpacity}),
        0 ${shadowOffset}px ${d.shadowBlur * 1.5}px rgba(0, 0, 0, ${d.shadowOpacity * 0.6});
      overflow: hidden;
    }
    .screen {
      position: absolute;
      top: ${d.bezelTop}px;
      left: ${d.bezelLeft}px;
      width: ${d.screenWidth}px;
      height: ${d.screenHeight}px;
      background: #000;
      border-radius: ${Math.max(d.cornerRadius - 6, 4)}px;
      overflow: hidden;
    }
    .screen img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    /* Reflection overlay for realism */
    .screen::after {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 40%;
      background: linear-gradient(
        180deg,
        rgba(255, 255, 255, 0.08) 0%,
        rgba(255, 255, 255, 0) 100%
      );
      pointer-events: none;
    }
    ${
      device === 'macbook'
        ? `
    /* MacBook keyboard notch */
    .device-frame::after {
      content: '';
      position: absolute;
      bottom: 15px;
      left: 50%;
      transform: translateX(-50%);
      width: 120px;
      height: 4px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 2px;
    }
    `
        : ''
    }
  </style>
</head>
<body>
  <div class="device-container">
    <div class="device-frame">
      ${dynamicIsland}
      <div class="screen">
        <img src="${screenshotPath}" alt="${screenshotName}" />
      </div>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Render device mockup using Playwright
 */
async function renderMockup(browser, device, screenshotPath, screenshotName) {
  const d = DEVICES[device];
  const totalWidth = d.screenWidth + d.bezelLeft + d.bezelRight;
  const totalHeight = d.screenHeight + d.bezelTop + d.bezelBottom;
  const viewportWidth = totalWidth + d.shadowBlur * 2;
  const viewportHeight = totalHeight + d.shadowBlur * 2;

  console.log(`Rendering ${d.name} mockup for: ${screenshotName}...`);

  const page = await browser.newPage({
    viewport: {
      width: viewportWidth,
      height: viewportHeight,
    },
  });

  // Read screenshot and convert to base64 data URL
  const screenshotBuffer = await fs.readFile(screenshotPath);
  const screenshotBase64 = screenshotBuffer.toString('base64');
  const screenshotDataUrl = `data:image/png;base64,${screenshotBase64}`;

  const html = generateDeviceHTML(device, screenshotDataUrl, screenshotName);
  await page.setContent(html);

  // Wait for the image to load
  await page.waitForFunction(
    () => {
      const img = document.querySelector('.screen img');
      return img && img.complete && img.naturalHeight > 0;
    },
    { timeout: 10000 }
  );

  await page.waitForLoadState('networkidle');

  // Take screenshot of the rendered mockup
  const mockupBuffer = await page.screenshot({
    type: 'png',
    fullPage: true,
  });

  await page.close();

  return mockupBuffer;
}

/**
 * Optimise and save mockup in multiple formats
 */
async function saveMockup(buffer, outputName, maxWidth) {
  const basenamePath = path.join(MOCKUPS_DIR, outputName);

  // Resize if needed and save as PNG
  const pngPath = `${basenamePath}.png`;
  await sharp(buffer)
    .resize(maxWidth, null, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .png({ quality: 90 })
    .toFile(pngPath);

  console.log(`  ✓ Saved PNG: ${outputName}.png`);

  // Save as WebP with optimisation
  const webpPath = `${basenamePath}.webp`;
  await sharp(buffer)
    .resize(maxWidth, null, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: 85 })
    .toFile(webpPath);

  console.log(`  ✓ Saved WebP: ${outputName}.webp`);

  return { pngPath, webpPath };
}

/**
 * Process all screenshots and generate mockups
 */
async function main() {
  console.log('Starting device mockup generation...\n');

  // Ensure output directory exists
  await fs.mkdir(MOCKUPS_DIR, { recursive: true });

  // Get list of screenshots
  const files = await fs.readdir(SCREENSHOTS_DIR);
  const screenshots = files.filter((f) => f.endsWith('.png'));

  if (screenshots.length === 0) {
    console.error('No screenshots found in', SCREENSHOTS_DIR);
    console.error('Please run capture-screenshots.ts first.');
    process.exit(1);
  }

  console.log(`Found ${screenshots.length} screenshots\n`);

  const browser = await chromium.launch({
    headless: true,
  });

  try {
    for (const screenshot of screenshots) {
      const screenshotPath = path.join(SCREENSHOTS_DIR, screenshot);
      const nameWithoutExt = path.parse(screenshot).name;

      // Determine device based on filename
      let device;
      if (nameWithoutExt.includes('-desktop')) {
        device = 'macbook';
      } else if (nameWithoutExt.includes('-mobile')) {
        device = 'iphone';
      } else {
        console.log(`⊘ Skipping ${screenshot} (unknown device type)`);
        continue;
      }

      const d = DEVICES[device];

      // Generate mockup
      const mockupBuffer = await renderMockup(browser, device, screenshotPath, nameWithoutExt);

      // Save in multiple formats
      const outputName =
        nameWithoutExt.replace('-desktop', '').replace('-mobile', '') + `-${device}`;
      await saveMockup(mockupBuffer, outputName, d.maxOutputWidth);
    }

    console.log('\n✓ Mockup generation complete!\n');
  } catch (error) {
    console.error('\n✗ Error during mockup generation:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

// Run if executed directly. Comparing against a hand-built "file://" + path
// string fails whenever the checkout path contains characters that get
// percent-encoded in import.meta.url, such as the spaces and apostrophe in
// "Documents - Michael's MacBook Pro (2)", which silently skipped main().
const isMainModule = import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMainModule) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { main };
