import puppeteer from 'puppeteer-core';
import assert from 'assert';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const MTC_F316_PATH = 'C:\\Users\\asus\\ownloads\\WW2604-133 IMP004774 EN 10204 3.1 Material Test Report F316-REV.1-poi-1 - Stem..pdf';
const MDS_F316_PATH = 'C:\\Users\\asus\\ownloads\\MDS-QE-F-ASS-ASTM-A182-F316-NACE-XX-001-[N1157]-REV A.pdf';
const MDS_F6A_PATH = 'C:\\Users\\asus\\ownloads\\MDS-QE-F-MSS-ASTM-A182-F6a-NACE-XX-001-[N1157]-REV A.pdf';

async function runE2E() {
  console.log('===============================================================');
  console.log('      END-TO-END BROWSER TEST: F316 PAIRING & COMPATIBILITY    ');
  console.log('===============================================================');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  page.on('console', (msg) => console.log('  [CONSOLE]', msg.type(), msg.text()));
  page.on('pageerror', (err) => console.log('  [PAGE ERROR]', err.message));

  // 1. Navigate & Authenticate
  console.log('\n[1/6] Loading application at http://localhost:3000...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle0', timeout: 30000 });

  const emailInput = await page.$('input[type="email"]');
  if (emailInput) {
    console.log('[2/6] Authenticating as admin@apexvalves.com...');
    await page.type('input[type="email"]', 'admin@apexvalves.com');
    await page.type('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await new Promise((r) => setTimeout(r, 1200));
  }

  // 2. Test Real F316 Pair (MTC F316 + MDS F316)
  console.log('\n[3/6] Opening modal for Pair A (F316 MTC + F316 MDS)...');
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent.includes('Verify New MTC') || b.textContent.includes('New Verification')
    );
    btn?.click();
  });
  await page.waitForFunction(() => document.body.innerText.includes('Verify Material Test Certificate'), { timeout: 10000 });

  console.log('      Attaching real F316 MTC and real F316 MDS...');
  const fileInputs = await page.$$('input[type="file"]');
  assert(fileInputs.length >= 2, 'Must have at least 2 file inputs');
  await fileInputs[0].uploadFile(MTC_F316_PATH);
  await fileInputs[1].uploadFile(MDS_F316_PATH);
  await new Promise((r) => setTimeout(r, 1500));

  console.log('      Executing compliance verification...');
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent.includes('Execute Compliance Check'));
    btn?.click();
  });

  await page.waitForFunction(() => {
    return Array.from(document.querySelectorAll('table thead th')).some((th) => th.textContent.includes('Property / Test Parameter'));
  }, { timeout: 30000 });
  console.log('      Compliance analysis completed for F316 pair!');

  // 3. Assert Metadata Header Values in Browser DOM
  console.log('\n[4/6] Verifying Metadata Panels in Browser DOM...');
  const domMetadata = await page.evaluate(() => {
    const text = document.body.innerText;
    return {
      hasF316Grade: text.includes('ASTM A182 F316'),
      hasF6aGrade: text.includes('ASTM A182 Grade F6a Class 1'),
      hasFKHeat: text.includes('FK2407-061'),
      hasIMPHeat: text.includes('IMP004774'),
      fullText: text,
    };
  });

  assert(domMetadata.hasF316Grade, 'Browser DOM must display material grade "ASTM A182 F316"');
  assert(!domMetadata.hasF6aGrade, 'Browser DOM must NOT display F6a material grade "ASTM A182 Grade F6a Class 1"');
  assert(domMetadata.hasFKHeat, 'Browser DOM must display real heat number "FK2407-061"');
  console.log('  ✓ Material Grade in DOM: ASTM A182 F316 (CONFIRMED)');
  console.log('  ✓ Ladle Heat in DOM: FK2407-061 (CONFIRMED)');

  // 4. Assert Individual Parameter Statuses in Findings Table
  console.log('\n[5/6] Inspecting Authoritative Status Rail for F316 Requirements...');
  const domRows = await page.evaluate(() => {
    const table = Array.from(document.querySelectorAll('table')).find((t) =>
      Array.from(t.querySelectorAll('th')).some((th) => th.textContent.includes('Property / Test Parameter'))
    );
    if (!table) return [];
    const trs = Array.from(table.querySelectorAll('tbody tr'));
    return trs.map((tr) => {
      const tds = Array.from(tr.querySelectorAll('td')).map((td) => td.innerText.replace(/\s+/g, ' ').trim());
      const statusBadge = tr.querySelector('td:nth-child(5) span')?.textContent?.trim() || '';
      return {
        parameter: tds[0] || '',
        heatNo: tds[1] || '',
        clientLimit: tds[2] || '',
        reportedValue: tds[3] || '',
        complianceStatus: statusBadge,
      };
    });
  });

  const f316Checks = [
    { name: 'Nickel (Ni)', key: 'Nickel', expected: 'PASS', expectedLimitContains: '10' },
    { name: 'Chromium (Cr)', key: 'Chromium', expected: 'PASS', expectedLimitContains: '16' },
    { name: 'Yield Strength', key: 'Yield Strength', expected: 'PASS', expectedLimitContains: '205' },
    { name: 'Tensile Strength', key: 'Tensile Strength', expected: 'PASS', expectedLimitContains: '515' },
    { name: 'Elongation', key: 'Elongation', expected: 'PASS', expectedLimitContains: '30' },
    { name: 'Reduction of Area', key: 'Reduction of Area', expected: 'PASS', expectedLimitContains: '50' },
    { name: 'Hardness', key: 'Hardness', expected: 'PASS', expectedLimitContains: '237' },
    { name: 'Heat Treatment', key: 'Heat Treatment', expected: 'PASS', expectedLimitContains: 'Solution' },
  ];

  for (const c of f316Checks) {
    const row = domRows.find((r) => r.parameter.toLowerCase().includes(c.key.toLowerCase()));
    assert(row, `Table row for ${c.name} must exist in DOM`);
    console.log(`  ✓ ${c.name.padEnd(22)} | Reported: ${row.reportedValue.padEnd(16)} | Limit: ${row.clientLimit.padEnd(20)} | Status: ${row.complianceStatus}`);
    assert.strictEqual(row.complianceStatus, c.expected, `${c.name} must be ${c.expected}`);
    assert(
      row.clientLimit.includes(c.expectedLimitContains),
      `${c.name} client limit must contain "${c.expectedLimitContains}" (got: "${row.clientLimit}")`
    );
  }

  // 5. Test Pair C: Incompatible Mismatch Gate (F316 MTC + F6a MDS)
  console.log('\n[6/6] Testing Hard Material Compatibility Gate (F316 MTC + F6a MDS)...');
  await page.evaluate(() => {
    const backBtn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent.includes('Back to Dashboard'));
    backBtn?.click();
  });
  await new Promise((r) => setTimeout(r, 1000));

  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent.includes('Verify New MTC') || b.textContent.includes('New Verification')
    );
    btn?.click();
  });
  await page.waitForFunction(() => document.body.innerText.includes('Verify Material Test Certificate'), { timeout: 10000 });

  const mismatchInputs = await page.$$('input[type="file"]');
  await mismatchInputs[0].uploadFile(MTC_F316_PATH);
  await mismatchInputs[1].uploadFile(MDS_F6A_PATH);
  await new Promise((r) => setTimeout(r, 1500));

  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent.includes('Execute Compliance Check'));
    btn?.click();
  });

  await page.waitForFunction(() => {
    return document.body.innerText.includes('Specification Incompatibility Blocked');
  }, { timeout: 30000 });

  const mismatchText = await page.evaluate(() => document.body.innerText);
  assert(
    mismatchText.includes('Specification Incompatibility Blocked'),
    'Browser must render "Specification Incompatibility Blocked" banner'
  );
  assert(
    mismatchText.includes('REJECTED NON-CONFORMANT'),
    'Browser must render "REJECTED NON-CONFORMANT" badge'
  );
  assert(
    mismatchText.includes('REVIEW_REQUIRED') || mismatchText.includes('review is required') || mismatchText.includes('Review is required'),
    'Browser must render review required finding'
  );
  console.log('  ✓ Specification Incompatibility Blocked alert rendered in DOM (CONFIRMED)');
  console.log('  ✓ Status REJECTED NON-CONFORMANT badge rendered in DOM (CONFIRMED)');
  console.log('  ✓ Review Required finding rendered in DOM (CONFIRMED)');

  await browser.close();
  console.log('\n===============================================================');
  console.log('       ALL END-TO-END BROWSER TESTS COMPLETED SUCCESSFULLY     ');
  console.log('===============================================================');
}

runE2E().catch((err) => {
  console.error('Fatal E2E error:', err);
  process.exit(1);
});
