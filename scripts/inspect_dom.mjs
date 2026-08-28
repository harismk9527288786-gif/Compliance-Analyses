import puppeteer from 'puppeteer-core';
import fs from 'fs';

async function run() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  await page.goto(`http://localhost:3000`, { waitUntil: 'networkidle0' });

  const emailInput = await page.$('input[type="email"]');
  if (emailInput) {
    await page.type('input[type="email"]', 'admin@apexvalves.com');
    await page.type('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
  }

  // Click on the first analysis row in dashboard
  await page.waitForSelector('table tbody tr', { timeout: 10000 });
  const rows = await page.$$('table tbody tr');
  console.log('Clicking on first analysis row...');
  await rows[0].click();

  // Wait for the findings table in AnalysisView
  await page.waitForFunction(() => {
    return Array.from(document.querySelectorAll('table thead th')).some(th => th.innerText.includes('Compliance Status Rail'));
  }, { timeout: 10000 });

  const findingsHeaders = await page.evaluate(() => {
    const ths = Array.from(document.querySelectorAll('table thead th')).map(th => th.innerText.trim());
    return ths;
  });

  const findingsRows = await page.evaluate(() => {
    const trs = Array.from(document.querySelectorAll('table tbody tr'));
    return trs.map(tr => {
      const tds = Array.from(tr.querySelectorAll('td')).map(td => td.innerText.replace(/\s+/g, ' ').trim());
      return tds;
    });
  });

  console.log('FINDINGS HEADERS:', findingsHeaders);
  console.log('\nFINDINGS ROWS:');
  findingsRows.forEach((r, i) => {
    console.log(`${i + 1}. ${r.join('  |  ')}`);
  });

  await browser.close();
}

run().catch(console.error);
