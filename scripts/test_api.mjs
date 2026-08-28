import fs from 'fs';

const MTC_PATH = 'C:\\Users\\asus\\ownloads\\WW2604-133 IMP004774 EN 10204 3.1 Material Test Report F316-REV.1-poi-1 - Stem..pdf';
const MDS_PATH = 'C:\\Users\\asus\\ownloads\\MDS-QE-F-MSS-ASTM-A182-F6a-NACE-XX-001-[N1157]-REV A.pdf';

async function testApi() {
  console.log('Testing direct API flow...');
  const t0 = Date.now();

  // 1. Login
  const loginRes = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@apexvalves.com', password: 'password123' }),
  });
  const cookie = loginRes.headers.get('set-cookie');
  console.log('Logged in, status:', loginRes.status);

  // 2. Upload MTC
  const mtcFormData = new FormData();
  mtcFormData.append('file', new Blob([fs.readFileSync(MTC_PATH)]), 'WW2604-133.pdf');
  mtcFormData.append('type', 'mtc');
  mtcFormData.append('userId', 'usr-admin-1');

  const mtcRes = await fetch('http://localhost:3000/api/documents', {
    method: 'POST',
    headers: { Cookie: cookie },
    body: mtcFormData,
  });
  const mtcJson = await mtcRes.json();
  console.log(`Uploaded MTC in ${Date.now() - t0}ms, doc ID:`, mtcJson.document?.id);

  // 3. Upload MDS
  const t1 = Date.now();
  const mdsFormData = new FormData();
  mdsFormData.append('file', new Blob([fs.readFileSync(MDS_PATH)]), 'MDS-F6a.pdf');
  mdsFormData.append('type', 'mds');
  mdsFormData.append('userId', 'usr-admin-1');

  const mdsRes = await fetch('http://localhost:3000/api/documents', {
    method: 'POST',
    headers: { Cookie: cookie },
    body: mdsFormData,
  });
  const mdsJson = await mdsRes.json();
  console.log(`Uploaded MDS in ${Date.now() - t1}ms, doc ID:`, mdsJson.document?.id);

  // 4. Create Analysis
  const t2 = Date.now();
  const analysisRes = await fetch('http://localhost:3000/api/analyses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookie,
    },
    body: JSON.stringify({
      mtcDocumentId: mtcJson.document.id,
      mdsDocumentId: mdsJson.document.id,
    }),
  });
  const analysisJson = await analysisRes.json();
  console.log(`Created Analysis in ${Date.now() - t2}ms, status:`, analysisRes.status);
  console.log('Analysis ID:', analysisJson.analysis?.id);
  console.log('Total Findings:', analysisJson.findings?.length);
  console.log('Deviations:', analysisJson.analysis?.deviationCount);
  console.log('Pass Count:', analysisJson.analysis?.passCount);
}

testApi().catch(console.error);
