import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer-core';
import assert from 'assert';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const MTC_F316_PATH = 'C:\\Users\\asus\\ownloads\\WW2604-133 IMP004774 EN 10204 3.1 Material Test Report F316-REV.1-poi-1 - Stem..pdf';
const MTC_F6A_PATH = 'C:\\Users\\asus\\ownloads\\WW2604-133 IMP004775 EN 10204 3.1 Material Test Report F6a-REV.1.pdf';
const MDS_F316_PATH = 'C:\\Users\\asus\\ownloads\\MDS-QE-F-ASS-ASTM-A182-F316-NACE-XX-001-[N1157]-REV A.pdf';
const MDS_F6A_PATH = 'C:\\Users\\asus\\ownloads\\MDS-QE-F-MSS-ASTM-A182-F6a-NACE-XX-001-[N1157]-REV A.pdf';
const DB_FILE = path.join(process.cwd(), 'data', 'mtc_compliance_database.json');

const BASE_URL = 'http://localhost:3000';

function getDbAnalyses(orgId = 'org-apex-01') {
  if (!fs.existsSync(DB_FILE)) return [];
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      const raw = fs.readFileSync(DB_FILE, 'utf8');
      const db = JSON.parse(raw);
      return Object.values(db.analyses || {}).filter((a) => a.organizationId === orgId);
    } catch (e) {
      const wait = Date.now() + 50;
      while (Date.now() < wait) {}
    }
  }
  return [];
}

async function runReproduction() {
  console.log('========================================================================');
  console.log('  LIFECYCLE REPRODUCTION & STRESS TEST: DASHBOARD RECORD DISAPPEARANCE  ');
  console.log('========================================================================\n');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  const networkTraces = [];

  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('/api/analyses')) {
      try {
        const status = response.status();
        const method = response.request().method();
        const json = await response.json();
        networkTraces.push({
          time: new Date().toISOString(),
          method,
          url,
          status,
          count: json.analyses ? json.analyses.length : (json.analysis ? 1 : undefined),
          analysisId: json.analysis ? json.analysis.id : undefined,
          analysisIds: json.analyses ? json.analyses.map((a) => a.id) : undefined,
        });
      } catch (_) {}
    }
  });

  page.on('console', (msg) => {
    const txt = msg.text();
    if (txt.includes('[TRACE') || txt.includes('error') || txt.includes('Error')) {
      console.log('    [BROWSER CONSOLE]', txt);
    }
  });

  // 1. Navigate & Authenticate
  console.log('[Step 1] Navigating to application & authenticating...');
  await page.goto(BASE_URL, { waitUntil: 'networkidle0', timeout: 30000 });

  const emailInput = await page.$('input[type="email"]');
  if (emailInput) {
    await page.type('input[type="email"]', 'admin@apexvalves.com');
    await page.type('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await new Promise((r) => setTimeout(r, 1500));
  }

  // Get auth cookie for API queries
  const cookies = await page.cookies();
  const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');

  // Clear existing analyses to start from zero baseline
  console.log('[Step 2] Clearing analyses to establish clean 0 baseline...');
  await fetch(`${BASE_URL}/api/analyses/clear`, {
    method: 'POST',
    headers: { Cookie: cookieHeader },
  });
  await new Promise((r) => setTimeout(r, 500));

  // Reload page to start with 0
  await page.goto(BASE_URL, { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 1000));

  const resultsTable = [];

  const testPairs = [
    { name: 'Pair 1 (F316 MTC + F316 MDS)', mtc: MTC_F316_PATH, mds: MDS_F316_PATH },
    { name: 'Pair 2 (F316 MTC + F6a MDS)', mtc: MTC_F316_PATH, mds: MDS_F6A_PATH },
    { name: 'Pair 3 (F6a MTC + F6a MDS)', mtc: MTC_F6A_PATH, mds: MDS_F6A_PATH },
    { name: 'Pair 4 (F6a MTC + F316 MDS)', mtc: MTC_F6A_PATH, mds: MDS_F316_PATH },
    { name: 'Pair 5 (F316 MTC + F316 MDS #2)', mtc: MTC_F316_PATH, mds: MDS_F316_PATH },
    { name: 'Pair 6 (F316 MTC + F6a MDS #2)', mtc: MTC_F316_PATH, mds: MDS_F6A_PATH },
    { name: 'Pair 7 (F6a MTC + F6a MDS #2)', mtc: MTC_F6A_PATH, mds: MDS_F6A_PATH },
    { name: 'Pair 8 (F6a MTC + F316 MDS #2)', mtc: MTC_F6A_PATH, mds: MDS_F316_PATH },
    { name: 'Pair 9 (F316 MTC + F316 MDS #3)', mtc: MTC_F316_PATH, mds: MDS_F316_PATH },
    { name: 'Pair 10 (F6a MTC + F6a MDS #3)', mtc: MTC_F6A_PATH, mds: MDS_F6A_PATH },
  ];

  console.log(`\n[Step 3] Executing N = ${testPairs.length} Evaluations Sequentially with 4-Way Comparison...\n`);

  let lastAnalysisId = null;
  for (let i = 0; i < testPairs.length; i++) {
    const pair = testPairs[i];
    const expectedCount = i + 1;
    console.log(`--- [Evaluation ${expectedCount}/${testPairs.length}] ${pair.name} ---`);

    // 1. Open New Verification Modal
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(
        (b) => b.textContent.includes('Verify New MTC') || b.textContent.includes('New Verification')
      );
      btn?.click();
    });

    await page.waitForFunction(() => document.body.innerText.includes('Verify Material Test Certificate'), { timeout: 10000 });

    // 2. Upload Files
    const fileInputs = await page.$$('input[type="file"]');
    assert(fileInputs.length >= 2, 'Must find MTC and MDS file inputs');
    await fileInputs[0].uploadFile(pair.mtc);
    await fileInputs[1].uploadFile(pair.mds);
    await new Promise((r) => setTimeout(r, 1000));

    // 3. Click Submit
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent.includes('Execute Compliance Check'));
      btn?.click();
    });

    // 4. Wait for Analysis View to load with a NEW analysisId
    await page.waitForFunction(
      (prevId) => {
        const id = new URL(window.location.href).searchParams.get('analysis');
        return id && id !== prevId && !document.body.innerText.includes('Executing Compliance Verification');
      },
      { timeout: 40000 },
      lastAnalysisId
    );

    const currentUrl = await page.url();
    const urlObj = new URL(currentUrl);
    const createdAnalysisId = urlObj.searchParams.get('analysis') || 'unknown';
    lastAnalysisId = createdAnalysisId;
    console.log(`  ✓ Analysis Created: ${createdAnalysisId}`);

    // TRACE 1 & 2: Direct Database Inspection
    const dbRecords = getDbAnalyses();
    const dbHasRecord = dbRecords.some((a) => a.id === createdAnalysisId);
    const dbCount = dbRecords.length;

    // TRACE 3: Dashboard API Direct Call
    const apiRes = await fetch(`${BASE_URL}/api/analyses`, {
      headers: { Cookie: cookieHeader },
    });
    const apiJson = await apiRes.json();
    const apiRecords = apiJson.analyses || [];
    const apiHasRecord = apiRecords.some((a) => a.id === createdAnalysisId);
    const apiCount = apiRecords.length;

    // 5. Click "Back to Dashboard" in the browser UI
    const navResult = await page.evaluate(() => {
      const backBtn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent.includes('Back to Dashboard'));
      if (backBtn) {
        backBtn.click();
        return 'clicked_back_btn';
      }
      const navBtn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent.trim() === 'Dashboard');
      if (navBtn) {
        navBtn.click();
        return 'clicked_nav_btn';
      }
      return 'no_btn_found: ' + Array.from(document.querySelectorAll('button')).map((b) => b.textContent.trim()).slice(0, 5).join(' | ');
    });
    console.log(`  Navigation action: ${navResult}`);

    try {
      await page.waitForFunction(
        () => {
          const t = document.body.innerText.toLowerCase();
          return t.includes('active fleet verdict') && t.includes('certificate verification records');
        },
        { timeout: 15000 }
      );
    } catch (waitErr) {
      const pageText = await page.evaluate(() => document.body.innerText.slice(0, 400));
      console.error('  Waiting for Dashboard failed! Current page text snippet:', pageText);
      throw waitErr;
    }
    await new Promise((r) => setTimeout(r, 600));

    // TRACE 4: Frontend State & Rendered UI in DOM
    const domMetrics = await page.evaluate(() => {
      const fullText = document.body.innerText;

      // Extract Active Fleet Verdict badge: "X Records"
      const fleetMatch = fullText.match(/Active Fleet Verdict\s*(\d+)\s*Records/i);
      const fleetCount = fleetMatch ? parseInt(fleetMatch[1], 10) : null;

      // Extract Total Evaluated MTCs
      const totalMatch = fullText.match(/Total Evaluated MTCs\s*(\d+)/i);
      const totalCount = totalMatch ? parseInt(totalMatch[1], 10) : null;

      // Extract Tab All (X)
      const allTabBtn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent.trim().startsWith('All ('));
      const allMatch = allTabBtn ? allTabBtn.textContent.match(/All \((\d+)\)/) : null;
      const allTabCount = allMatch ? parseInt(allMatch[1], 10) : null;

      // Count table rows
      const table = Array.from(document.querySelectorAll('table')).find((t) =>
        Array.from(t.querySelectorAll('th')).some((th) => th.textContent.includes('Property / Test Parameter') || th.textContent.includes('MTC Number') || th.textContent.includes('Material Grade'))
      );
      const rowCount = table ? table.querySelectorAll('tbody tr').length : document.querySelectorAll('tbody tr').length;

      return {
        fleetCount,
        totalCount,
        allTabCount,
        rowCount,
      };
    });

    const dbStatus = dbHasRecord && dbCount === expectedCount;
    const apiStatus = apiHasRecord && apiCount === expectedCount;
    const domBadgeStatus = domMetrics.allTabCount === expectedCount;
    const domRowStatus = domMetrics.rowCount === expectedCount;

    console.log(`  [TRACE 2 DB]       Count: ${dbCount} (Has ID: ${dbHasRecord}) -> ${dbStatus ? 'OK' : 'MISMATCH'}`);
    console.log(`  [TRACE 3 API]      Count: ${apiCount} (Has ID: ${apiHasRecord}) -> ${apiStatus ? 'OK' : 'MISMATCH'}`);
    console.log(`  [TRACE 4 DOM UI]   All Tab: ${domMetrics.allTabCount} | Total MTCs: ${domMetrics.totalCount} | Rows: ${domMetrics.rowCount} -> ${domBadgeStatus ? 'OK' : 'MISMATCH'}`);

    resultsTable.push({
      eval: expectedCount,
      pair: pair.name.split(' ')[1],
      db: dbCount,
      dbOk: dbStatus,
      api: apiCount,
      apiOk: apiStatus,
      domTab: domMetrics.allTabCount,
      domRows: domMetrics.rowCount,
      uiOk: domBadgeStatus && domRowStatus,
    });

    if (!dbStatus || !apiStatus || !domBadgeStatus) {
      console.error(`\n>>> FAILURE DETECTED ON EVALUATION ${expectedCount} <<<`);
      console.error(`Expected: ${expectedCount} | DB: ${dbCount} | API: ${apiCount} | DOM All(): ${domMetrics.allTabCount}`);
      console.error('Recent Network Traces for /api/analyses:');
      console.error(JSON.stringify(networkTraces.slice(-5), null, 2));
    }
  }

  console.log('\n========================================================================');
  console.log('                          FINAL TRACE SUMMARY TABLE                     ');
  console.log('========================================================================');
  console.log('Eval # | Expected | DB Count | API Count | DOM All() | DOM Rows | Overall');
  console.log('-------|----------|----------|-----------|-----------|----------|--------');
  for (const r of resultsTable) {
    const pass = r.dbOk && r.apiOk && r.uiOk;
    console.log(
      `  ${String(r.eval).padEnd(5)}| ${String(r.eval).padEnd(9)}| ${String(r.db).padEnd(9)}| ${String(r.api).padEnd(10)}| ${String(r.domTab).padEnd(10)}| ${String(r.domRows).padEnd(9)}| ${pass ? 'PASS ✓' : 'FAIL ✗'}`
    );
  }
  console.log('========================================================================\n');

  await browser.close();

  const allPassed = resultsTable.every((r) => r.dbOk && r.apiOk && r.uiOk);
  if (!allPassed) {
    console.error('Reproduction identified discrepancies!');
    process.exit(1);
  } else {
    console.log('All evaluations completed with 100% 4-way consistency!');
  }
}

runReproduction().catch((err) => {
  console.error('Reproduction script error:', err);
  process.exit(1);
});
