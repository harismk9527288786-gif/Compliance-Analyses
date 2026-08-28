import puppeteer from 'puppeteer-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const MTC_PATH = 'C:\\Users\\asus\\ownloads\\WW2604-133 IMP004774 EN 10204 3.1 Material Test Report F316-REV.1-poi-1 - Stem..pdf';
const MDS_PATH = 'C:\\Users\\asus\\ownloads\\MDS-QE-F-MSS-ASTM-A182-F6a-NACE-XX-001-[N1157]-REV A.pdf';

async function testModal() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err));

  await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });

  const emailInput = await page.$('input[type="email"]');
  if (emailInput) {
    await page.type('input[type="email"]', 'admin@apexvalves.com');
    await page.type('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await new Promise((r) => setTimeout(r, 1000));
  }

  // Open modal
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent.includes('Verify New MTC'));
    btn?.click();
  });
  await page.waitForFunction(() => document.body.innerText.includes('Verify Material Test Certificate'));

  const fileInputs = await page.$$('input[type="file"]');
  await fileInputs[0].uploadFile(MTC_PATH);
  await fileInputs[1].uploadFile(MDS_PATH);
  await new Promise((r) => setTimeout(r, 1000));

  // Click execute
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent.includes('Execute Compliance Check'));
    btn?.click();
  });

  await new Promise((r) => setTimeout(r, 2000));
  const fullText = await page.evaluate(() => document.body.innerText);
  console.log('UI Text after execute click:\n', fullText);

  await browser.close();
}

testModal().catch(console.error);
