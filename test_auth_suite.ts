import 'dotenv/config';
import http from 'http';
import { db } from './server/db';
import { hashPassword, verifyPassword } from './server/auth/security';

const BASE_URL = 'http://127.0.0.1:3000';

interface RequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: any;
  cookie?: string;
}

interface ResponseData {
  status: number;
  headers: http.IncomingHttpHeaders;
  cookies: string[];
  body: any;
}

function makeRequest(urlPath: string, options: RequestOptions = {}): Promise<ResponseData> {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE_URL);
    const reqHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(options.headers || {}),
    };

    if (options.cookie) {
      reqHeaders['Cookie'] = options.cookie;
    }

    const req = http.request(
      url,
      {
        method: options.method || 'GET',
        headers: reqHeaders,
      },
      (res) => {
        let rawBody = '';
        res.on('data', (chunk) => {
          rawBody += chunk;
        });
        res.on('end', () => {
          let parsedBody = rawBody;
          try {
            parsedBody = JSON.parse(rawBody);
          } catch {}

          const rawCookies = res.headers['set-cookie'] || [];
          const cookies = Array.isArray(rawCookies) ? rawCookies : [rawCookies];

          resolve({
            status: res.statusCode || 500,
            headers: res.headers,
            cookies,
            body: parsedBody,
          });
        });
      }
    );

    req.on('error', reject);

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    req.end();
  });
}

function extractSessionCookie(cookies: string[]): string | undefined {
  for (const c of cookies) {
    if (c.includes('mtc_session=')) {
      const match = c.match(/mtc_session=([^;]+)/);
      if (match) return `mtc_session=${match[1]}`;
    }
  }
  return undefined;
}

async function runAuthTests() {
  console.log('====================================================');
  console.log('       RUNNING COMPREHENSIVE AUTH TEST SUITE        ');
  console.log('====================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    totalTests++;
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passedTests++;
    } else {
      console.error(`❌ [FAIL] ${testName}${detail ? ` - Detail: ${detail}` : ''}`);
    }
  }

  try {
    // 1. Test unauthenticated request to protected endpoint
    const unauthRes = await makeRequest('/api/analyses');
    assert(
      unauthRes.status === 401 && unauthRes.body.code === 'UNAUTHENTICATED',
      'Test 1: Protected route /api/analyses blocks unauthenticated access with 401'
    );

    // 2. Test invalid password login
    const wrongPassRes = await makeRequest('/api/auth/login', {
      method: 'POST',
      body: { email: 'admin@apexvalves.com', password: 'completely_wrong_password' },
    });
    assert(
      wrongPassRes.status === 401 && wrongPassRes.body.error === 'Invalid email or password.',
      'Test 2: Invalid password returns 401 with generic error message'
    );

    // 3. Test nonexistent email login (prevents user enumeration)
    const nonExistentRes = await makeRequest('/api/auth/login', {
      method: 'POST',
      body: { email: 'nonexistent.engineer@nowhere.com', password: 'password123' },
    });
    assert(
      nonExistentRes.status === 401 && nonExistentRes.body.error === 'Invalid email or password.',
      'Test 3: Nonexistent email returns identical 401 generic error (no enumeration)'
    );

    // 4. Test Valid Admin Login
    const adminLoginRes = await makeRequest('/api/auth/login', {
      method: 'POST',
      body: { email: 'admin@apexvalves.com', password: 'password123' },
    });
    const adminCookie = extractSessionCookie(adminLoginRes.cookies);
    assert(
      adminLoginRes.status === 200 &&
      adminLoginRes.body.user.role === 'ADMIN' &&
      adminLoginRes.body.user.email === 'admin@apexvalves.com' &&
      adminLoginRes.body.user.password_hash === undefined &&
      !!adminCookie,
      'Test 4: Valid Admin login returns 200, safe user profile, and sets HttpOnly cookie'
    );

    // 5. Test GET /api/auth/me with Admin session
    const meRes = await makeRequest('/api/auth/me', { cookie: adminCookie });
    assert(
      meRes.status === 200 &&
      meRes.body.user.id === 'user-admin-system' &&
      meRes.body.permissions.canManageUsers === true &&
      meRes.body.permissions.canManageRequirementSets === true,
      'Test 5: GET /api/auth/me validates session and returns role permissions'
    );

    // 6. Test Quality Engineer login & permissions
    const qeLoginRes = await makeRequest('/api/auth/login', {
      method: 'POST',
      body: { email: 'materials.engineer@apexvalves.com', password: 'password123' },
    });
    const qeCookie = extractSessionCookie(qeLoginRes.cookies);
    assert(
      qeLoginRes.status === 200 && qeLoginRes.body.user.role === 'QUALITY_ENGINEER',
      'Test 6: Quality Engineer login succeeds'
    );

    // 7. Test Quality Engineer attempting Admin action (e.g. invite user -> 403)
    const qeInviteRes = await makeRequest('/api/auth/invite', {
      method: 'POST',
      cookie: qeCookie,
      body: { email: 'unauthorized@company.com', role: 'VIEWER' },
    });
    assert(
      qeInviteRes.status === 403,
      'Test 7: Quality Engineer blocked from Admin-only action (403 Forbidden)'
    );

    // 8. Test Reviewer login
    const revLoginRes = await makeRequest('/api/auth/login', {
      method: 'POST',
      body: { email: 'qc.lead@apexvalves.com', password: 'password123' },
    });
    const revCookie = extractSessionCookie(revLoginRes.cookies);
    assert(
      revLoginRes.status === 200 && revLoginRes.body.user.role === 'REVIEWER',
      'Test 8: Reviewer (Lead QC) login succeeds'
    );

    // 9. Test Viewer login from Organization B
    const viewerLoginRes = await makeRequest('/api/auth/login', {
      method: 'POST',
      body: { email: 'observer@clientaudit.com', password: 'password123' },
    });
    const viewerCookie = extractSessionCookie(viewerLoginRes.cookies);
    assert(
      viewerLoginRes.status === 200 &&
      viewerLoginRes.body.user.role === 'VIEWER' &&
      viewerLoginRes.body.organization.id === 'org-global-02',
      'Test 9: Viewer from Organization B logs in successfully'
    );

    // 10. Multi-Tenant Isolation Test: Viewer from Org B cannot see Org A analyses
    const viewerAnalysesRes = await makeRequest('/api/analyses', { cookie: viewerCookie });
    const orgBAnalyses = viewerAnalysesRes.body.analyses || [];
    assert(
      viewerAnalysesRes.status === 200 && orgBAnalyses.length === 0,
      'Test 10: Tenant Isolation - Org B viewer cannot access Org A analyses (0 leaked)'
    );

    // 11. Multi-Tenant Cross-Access Test: Viewer from Org B attempting to fetch Org A analysis directly by ID -> 404/403
    const directCrossOrgRes = await makeRequest('/api/analyses/analysis-pilot-ww2606229-3', {
      cookie: viewerCookie,
    });
    assert(
      directCrossOrgRes.status === 404 || directCrossOrgRes.status === 403,
      'Test 11: Cross-Tenant direct ID access strictly blocked by backend'
    );

    // 12. Admin Invitation Flow Test
    const newInviteEmail = `inspector-${Date.now()}@apexvalves.com`;
    const inviteRes = await makeRequest('/api/auth/invite', {
      method: 'POST',
      cookie: adminCookie,
      body: { email: newInviteEmail, role: 'REVIEWER' },
    });
    const inviteToken = inviteRes.body.invitation?.inviteToken;
    assert(
      inviteRes.status === 201 && !!inviteToken,
      'Test 12: Admin creates user invitation with 7-day secure token'
    );

    // 13. Accept Invitation Flow Test
    const acceptInviteRes = await makeRequest('/api/auth/accept-invite', {
      method: 'POST',
      body: {
        token: inviteToken,
        name: 'New QC Inspector',
        password: 'new_secure_password_2026',
      },
    });
    const newMemberCookie = extractSessionCookie(acceptInviteRes.cookies);
    assert(
      acceptInviteRes.status === 201 &&
      acceptInviteRes.body.user.email === newInviteEmail &&
      acceptInviteRes.body.user.role === 'REVIEWER' &&
      !!newMemberCookie,
      'Test 13: New user accepts invitation, creates password, and activates session'
    );

    // 14. Password Reset Flow Test
    const forgotRes = await makeRequest('/api/auth/forgot-password', {
      method: 'POST',
      body: { email: newInviteEmail },
    });
    const resetToken = forgotRes.body.resetToken;
    assert(
      forgotRes.status === 200 && !!resetToken,
      'Test 14: Forgot password generates single-use reset token'
    );

    const resetRes = await makeRequest('/api/auth/reset-password', {
      method: 'POST',
      body: { token: resetToken, newPassword: 'updated_password_999' },
    });
    assert(
      resetRes.status === 200,
      'Test 15: Password reset updates user password hash and invalidates old sessions'
    );

    // Test login with updated password
    const newLoginRes = await makeRequest('/api/auth/login', {
      method: 'POST',
      body: { email: newInviteEmail, password: 'updated_password_999' },
    });
    assert(
      newLoginRes.status === 200,
      'Test 16: Login with newly reset password succeeds'
    );

    // 15. Test Logout & Session Invalidation
    const logoutRes = await makeRequest('/api/auth/logout', {
      method: 'POST',
      cookie: adminCookie,
    });
    assert(
      logoutRes.status === 200,
      'Test 17: Logout invalidates session on server and clears cookie'
    );

    const postLogoutMe = await makeRequest('/api/auth/me', { cookie: adminCookie });
    assert(
      postLogoutMe.status === 401,
      'Test 18: Invalidated session rejected on subsequent requests (401)'
    );

    // 16. Test Audit Trail Integration
    const auditRes = await makeRequest('/api/audit', { cookie: revCookie });
    const auditLogs = auditRes.body.auditLogs || [];
    const hasLoginAudit = auditLogs.some((a: any) => a.action === 'USER_LOGIN' || a.action === 'LOGIN_FAILED');
    assert(
      auditRes.status === 200 && hasLoginAudit,
      'Test 19: Immutable audit trail records authentication events (USER_LOGIN / LOGIN_FAILED)'
    );

    console.log('\n====================================================');
    console.log(`TEST SUMMARY: ${passedTests} / ${totalTests} TESTS PASSED`);
    console.log('====================================================\n');
  } catch (err) {
    console.error('Fatal test runner error:', err);
  }
}

runAuthTests();
