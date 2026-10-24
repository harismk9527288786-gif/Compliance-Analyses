import puppeteer from 'puppeteer';

async function run() {
  console.log('Testing reject flow...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });

  const emailInput = await page.$('input[type="email"]');
  if (emailInput) {
    await page.type('input[type="email"]', 'admin@apexvalves.com');
    await page.type('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await new Promise((r) => setTimeout(r, 2000));
  }

  // Load benchmark MTC
  const loadBtn = await page.evaluateHandle(() => {
    return Array.from(document.querySelectorAll('button')).find(el => el.textContent.includes('Load Benchmark'));
  });
  if (loadBtn) {
    await loadBtn.click();
    await new Promise((r) => setTimeout(r, 2000));
  }

  // Click reject
  const rejectBtn = await page.evaluateHandle(() => {
    return Array.from(document.querySelectorAll('button')).find(el => el.textContent.includes('Reject'));
  });

  if (rejectBtn) {
    await rejectBtn.click();
    await new Promise((r) => setTimeout(r, 1000));

    // Type reason
    await page.type('textarea', 'Reason for reject');

    // Submit
    const submitRejectBtn = await page.evaluateHandle(() => {
      return Array.from(document.querySelectorAll('button')).find(el => el.textContent.includes('Submit Formal Rejection'));
    });

    if (submitRejectBtn) {
       await submitRejectBtn.click();
       await new Promise((r) => setTimeout(r, 1000));
       const bodyText = await page.evaluate(() => document.body.innerText);
       console.log("Toast shown:", bodyText.includes('the certificate is rejected'));
       console.log("On History view:", bodyText.includes('Verification History & Audit Log'));
       console.log("Shows REJECTED in History view:", bodyText.includes('REJECTED'));
    } else {
        console.log("Could not find submit rejection button");
    }
  } else {
      console.log("Could not find reject button");
  }

  await browser.close();
}

run().catch(console.error);
