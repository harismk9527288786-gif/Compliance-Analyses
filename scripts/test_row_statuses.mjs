import puppeteer from 'puppeteer';
import fs from 'fs';

const db = JSON.parse(fs.readFileSync('./data/mtc_compliance_database.json', 'utf8'));
const analysisIds = Object.keys(db.analyses || {});
const latestId = analysisIds[analysisIds.length - 1];

async function run() {
  console.log('Testing browser DOM table cells for analysis:', latestId);
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
    await new Promise((r) => setTimeout(r, 1000));
  }

  // Navigate directly to the analysis view
  await page.goto(`http://localhost:3000/?analysis=${latestId}`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('table tbody tr', { timeout: 10000 });

  const rows = await page.evaluate(() => {
    const trs = Array.from(document.querySelectorAll('table tbody tr'));
    return trs.map((tr) => {
      const tds = Array.from(tr.querySelectorAll('td')).map((td) => td.innerText.replace(/\s+/g, ' ').trim());
      const entireRowText = tr.innerText.replace(/\s+/g, ' ').trim();
      return {
        property: tds[0] || '',
        limit: tds[2] || '',
        value: tds[3] || '',
        statusColumn: tds[4] || '',
        entireRowText,
      };
    });
  });

  console.log(`\nFound ${rows.length} rows in the active findings table:\n`);
  for (const r of rows) {
    const hasDeviation = r.statusColumn.includes('DEVIATION');
    const hasPass = r.statusColumn.includes('PASS');
    const rowHasPassWord = /\bPASS\b/.test(r.entireRowText);
    console.log(`Property: ${r.property.split('·')[0].trim().padEnd(25)} | Value: ${r.value.padEnd(15)} | Status Column: ${r.statusColumn.padEnd(12)} | Row Contains "PASS": ${rowHasPassWord}`);
  }

  await browser.close();
}

run().catch(console.error);
