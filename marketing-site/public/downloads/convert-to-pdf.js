const puppeteer = require('puppeteer');
const path = require('path');

const files = [
  'treasurer-one-pager',
  'membership-secretary-one-pager',
  'chair-one-pager',
  'coach-one-pager'
];

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  
  for (const file of files) {
    const page = await browser.newPage();
    const htmlPath = `file://${path.resolve(__dirname, `${file}.html`)}`;
    await page.goto(htmlPath, { waitUntil: 'networkidle0' });
    await page.pdf({
      path: `${file}.pdf`,
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true
    });
    console.log(`Generated: ${file}.pdf`);
    await page.close();
  }
  
  await browser.close();
  console.log('All PDFs generated successfully');
})();
