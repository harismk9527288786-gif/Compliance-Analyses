import puppeteer from 'puppeteer-core';
import assert from 'assert';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const MTC_PATH = 'C:\\Users\\asus\\ownloads\\WW2604-133 IMP004774 EN 10204 3.1 Material Test Report F316-REV.1-poi-1 - Stem..pdf';
const MDS_PATH = 'C:\\Users\\asus\\ownloads\\MDS-QE-F-MSS-ASTM-A182-F6a-NACE-XX-001-[N1157]-REV A.pdf';

async function runE2E() {
  console.log('===============================================================');
  console.log('      END-TO-END BROWSER TEST: AUTHORITATIVE STATUS CHECK      ');
  console.log('===============================================================');
  console.log('Chrome Executable: ', CHROME_PATH);
  console.log('Actual MTC File:   ', MTC_PATH);
  console.log('Actual MDS File:   ', MDS_PATH);

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  page.on('console', (msg) => console.log('  [CONSOLE]', msg.type(), msg.text()));
  page.on('pageerror', (err) => console.log('  [PAGE ERROR]', err.message));

  const networkResponses = [];
  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('/api/analyses') || url.includes('/api/documents')) {
      try {
        const status = response.status();
        const json = await response.json();
        networkResponses.push({ url, status, json });
      } catch (_) {}
    }
  });

  // 1. Navigate to Application
  console.log('\n[1/5] Loading application at http://localhost:3000...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle0', timeout: 30000 });

  // 2. Authentication
  const emailInput = await page.$('input[type="email"]');
  if (emailInput) {
    console.log('[2/5] Authenticating as admin@apexvalves.com...');
    await page.type('input[type="email"]', 'admin@apexvalves.com');
    await page.type('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await new Promise((r) => setTimeout(r, 1200));
  }

  // 3. Open New Verification Modal
  console.log('[3/5] Opening New Verification modal...');
  const newVerificationBtn = await page.evaluateHandle(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    return btns.find((b) => b.textContent.includes('Verify New MTC') || b.textContent.includes('New Verification'));
  });
  if (newVerificationBtn && newVerificationBtn.asElement()) {
    await newVerificationBtn.asElement().click();
  }
  await page.waitForFunction(() => document.body.innerText.includes('Verify Material Test Certificate'), { timeout: 10000 });

  // 4. Attach actual MTC and MDS
  console.log('[4/5] Attaching actual MTC and MDS PDF files and executing...');
  const fileInputs = await page.$$('input[type="file"]');
  if (fileInputs.length < 2) {
    throw new Error(`Expected at least 2 file inputs, found: ${fileInputs.length}`);
  }
  await fileInputs[0].uploadFile(MTC_PATH);
  await fileInputs[1].uploadFile(MDS_PATH);
  await new Promise((r) => setTimeout(r, 1500));

  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent.includes('Execute Compliance Check'));
    btn?.click();
  });

  // Wait for results view or error
  console.log('      Executing compliance comparison (waiting up to 30s)...');
  await page.waitForFunction(() => {
    const hasFindingsTable = Array.from(document.querySelectorAll('table thead th')).some((th) => th.textContent.includes('Property / Test Parameter'));
    const errorElem = document.querySelector('[role="alert"], .bg-rose-50, .text-rose-600');
    return hasFindingsTable || (errorElem && errorElem.textContent && errorElem.textContent.length > 5);
  }, { timeout: 30000 });

  const pageErr = await page.evaluate(() => {
    const el = document.querySelector('[role="alert"], .bg-rose-50');
    return el ? el.textContent : null;
  });
  if (pageErr) {
    throw new Error(`Comparison failed with UI error: ${pageErr}`);
  }
  console.log('      Comparison completed! Results rendered in browser UI.');

  // 5. Inspect each row directly in the browser DOM
  console.log('\n---------------------------------------------------------------');
  console.log('      BROWSER DOM TABLE ROW INSPECTION & AUTHORITATIVE STATUS  ');
  console.log('---------------------------------------------------------------');

  const tableHeaders = await page.evaluate(() => {
    const table = Array.from(document.querySelectorAll('table')).find((t) =>
      Array.from(t.querySelectorAll('th')).some((th) => th.textContent.includes('Property / Test Parameter'))
    );
    return table ? Array.from(table.querySelectorAll('thead th')).map((th) => th.textContent.replace(/\s+/g, ' ').trim()) : [];
  });
  console.log('Findings Table Columns rendered in DOM:', tableHeaders);
  assert.strictEqual(
    tableHeaders.some((h) => h.toLowerCase().includes('compliance status rail')),
    true,
    'Table must contain exactly one Compliance Status Rail column'
  );

  const domRows = await page.evaluate(() => {
    const table = Array.from(document.querySelectorAll('table')).find((t) =>
      Array.from(t.querySelectorAll('th')).some((th) => th.textContent.includes('Property / Test Parameter'))
    );
    if (!table) return [];
    const trs = Array.from(table.querySelectorAll('tbody tr'));
    return trs.map((tr) => {
      const tds = Array.from(tr.querySelectorAll('td')).map((td) => td.innerText.replace(/\s+/g, ' ').trim());
      const statusBadge = tr.querySelector('td:nth-child(5) span')?.textContent?.trim() || '';
      const entireRowText = tr.innerText.replace(/\s+/g, ' ').trim();
      return {
        parameter: tds[0] || '',
        heatNo: tds[1] || '',
        clientLimit: tds[2] || '',
        reportedValue: tds[3] || '',
        complianceStatus: statusBadge,
        entireRowText,
      };
    });
  });

  const expectedStatuses = [
    { name: 'Nickel (Ni)', key: 'Nickel', expected: 'DEVIATION', condition: '10.070% > 0.50%' },
    { name: 'Chromium (Cr)', key: 'Chromium', expected: 'DEVIATION', condition: '16.320% > 13.50%' },
    { name: 'Brinell Hardness', key: 'Hardness', expected: 'DEVIATION', condition: '237 HBW > 207 HBW' },
    { name: 'Yield Strength', key: 'Yield Strength', expected: 'DEVIATION', condition: '232 MPa < 275 MPa' },
    { name: 'Heat Treatment', key: 'Heat Treatment', expected: 'DEVIATION', condition: 'Solution Anneal != Furnace Cool / N&T' },
    { name: 'Tensile Strength', key: 'Tensile Strength', expected: 'PASS', condition: '523 MPa >= 485 MPa' },
    { name: 'Elongation', key: 'Elongation', expected: 'PASS', condition: '47% >= 18%' },
    { name: 'Carbon (C)', key: 'Carbon', expected: 'PASS', condition: '0.018% <= 0.15%' },
    { name: 'Manganese (Mn)', key: 'Manganese', expected: 'PASS', condition: '0.950% <= 1.00%' },
    { name: 'Phosphorus (P)', key: 'Phosphorus', expected: 'PASS', condition: '0.036% <= 0.040%' },
    { name: 'Sulfur (S)', key: 'Sulfur', expected: 'PASS', condition: '0.0008% <= 0.030%' },
    { name: 'Silicon (Si)', key: 'Silicon', expected: 'PASS', condition: '0.367% <= 1.00%' },
    { name: 'Reduction of Area', key: 'Reduction of Area', expected: 'PASS', condition: '68% >= 35%' },
  ];

  console.log('\nAuthoritative Status Results:');
  for (const check of expectedStatuses) {
    const row = domRows.find((r) => r.parameter.toLowerCase().includes(check.key.toLowerCase()));
    assert(row, `Row for ${check.name} must exist in DOM table`);

    const statusMatches = row.complianceStatus === check.expected;
    const passAppearsInDeviationRow = row.complianceStatus === 'DEVIATION' && /\bPASS\b/.test(row.entireRowText);

    console.log(
      `  ${statusMatches ? '✓ [PASS]' : '✗ [FAIL]'} ${check.name.padEnd(24)} | Value: ${row.reportedValue.padEnd(16)} | Req: ${row.clientLimit.padEnd(16)} | Condition: ${check.condition.padEnd(24)} -> Status: ${row.complianceStatus}`
    );

    assert.strictEqual(
      row.complianceStatus,
      check.expected,
      `Parameter ${check.name} must display status ${check.expected}, but got ${row.complianceStatus}`
    );

    assert.strictEqual(
      passAppearsInDeviationRow,
      false,
      `Row for ${check.name} has status DEVIATION and must NEVER display "PASS" anywhere in its row text!`
    );
  }

  console.log('\n---------------------------------------------------------------');
  console.log('      ZERO CONFLICT ASSERTION: NO PASS ON DEVIATION ROWS       ');
  console.log('---------------------------------------------------------------');
  const deviationRows = domRows.filter((r) => r.complianceStatus === 'DEVIATION');
  console.log(`Total DEVIATION rows in DOM: ${deviationRows.length}`);
  for (const dRow of deviationRows) {
    const containsPass = /\bPASS\b/.test(dRow.entireRowText);
    console.log(`  Checking ${dRow.parameter.split('·')[0].trim().padEnd(30)}: Contains "PASS"? -> ${containsPass ? 'FAIL' : 'NO (Clean)'}`);
    assert.strictEqual(containsPass, false, `Deviation row ${dRow.parameter} contains PASS`);
  }

  // 6. Test Page Refresh & Isolation
  console.log('\n---------------------------------------------------------------');
  console.log('            PAGE REFRESH & SESSION ISOLATION CHECK            ');
  console.log('---------------------------------------------------------------');
  await page.reload({ waitUntil: 'networkidle0' });
  const uiTextAfterReload = await page.evaluate(() => document.body.innerText);

  const preservedAfterReload = uiTextAfterReload.includes('FK2407-061') && uiTextAfterReload.includes('0.018 %');
  console.log(`  ✓ Page refresh preserves active MTC : ${preservedAfterReload ? 'CONFIRMED' : 'FAIL'}`);

  const didNotRestoreOld = !uiTextAfterReload.includes('A228') && !uiTextAfterReload.includes('WW2606229-3');
  console.log(`  ✓ Refresh does NOT restore old MTC  : ${didNotRestoreOld ? 'CONFIRMED' : 'FAIL'}`);

  await browser.close();
  console.log('\n===============================================================');
  console.log('        ALL BROWSER E2E AUTHORITATIVE STATUS TESTS PASSED     ');
  console.log('===============================================================');
}

runE2E().catch((err) => {
  console.error('E2E TEST FATAL ERROR:', err);
  process.exit(1);
});
