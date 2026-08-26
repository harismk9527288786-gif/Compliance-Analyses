import express from 'express';
import { db } from '../db';
import {
  hashPassword,
  verifyPassword,
  generateRandomToken,
  hashToken,
  createRateLimiter,
} from './security';
import { sanitizeUser, AuthRole, UserRecord, OrganizationRecord } from './types';
import { requireAuth, requireRole, AUTH_COOKIE_NAME } from './middleware';

export const authRouter = express.Router();

const isProduction = process.env.NODE_ENV === 'production' || !!process.env.VERCEL;
const SESSION_TTL_HOURS = parseInt(process.env.SESSION_TTL_HOURS || '168', 10); // 7 days default
const SESSION_TTL_MS = SESSION_TTL_HOURS * 60 * 60 * 1000;

// Rate Limiters
const authLimiter = createRateLimiter(15, 60 * 1000, 'Too many authentication attempts. Please wait one minute before trying again.');
const passwordResetLimiter = createRateLimiter(5, 15 * 60 * 1000, 'Too many password reset attempts. Please wait 15 minutes before trying again.');

function setSessionCookie(res: express.Response, sessionId: string) {
  res.cookie(AUTH_COOKIE_NAME, sessionId, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_MS,
  });
}

/**
 * POST /api/auth/register
 * Direct self-registration: Creates a new user (and organization if specified),
 * hashes password, generates authenticated session, and returns user profile.
 */
authRouter.post('/register', authLimiter, async (req, res) => {
  try {
    // `role` is intentionally not destructured from the body — see the role
    // assignment below. Accepting it here was a privilege-escalation hole.
    const { name, email, password, organizationName } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Please enter your full name.' });
    }
    if (!email || typeof email !== 'string' || !email.trim() || !email.includes('@')) {
      return res.status(400).json({ error: 'Please enter a valid work email address.' });
    }
    if (!password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();
    const cleanPassword = typeof password === 'string' ? password.trim() : '';
    const existingUser = db.getUserByEmail(cleanEmail);

    if (existingUser) {
      return res.status(400).json({ error: 'An account with this email address already exists. Please sign in.' });
    }

    // Determine organization
    let org: OrganizationRecord;
    let isNewOrganization = false;
    const orgs = db.getOrganizations();

    if (organizationName && typeof organizationName === 'string' && organizationName.trim()) {
      const cleanOrgName = organizationName.trim();
      const code = cleanOrgName
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '-')
        .replace(/-+/g, '-')
        .slice(0, 10) || 'ORG';
      const orgId = `org-${Date.now().toString(36)}-${generateRandomToken(4)}`;

      org = db.createOrganization({
        id: orgId,
        name: cleanOrgName,
        code,
        tier: 'Enterprise Quality Suite',
        requireMfa: false,
        allowExternalAi: true,
        retentionMonths: 24,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      isNewOrganization = true;
    } else {
      // Default to the first seed organization if not specified
      org = orgs[0] || db.createOrganization({
        id: 'org-apex-01',
        name: 'Apex Valve & Flow Engineering Ltd.',
        code: 'APEX-VALVES',
        tier: 'Enterprise Quality Suite',
        requireMfa: true,
        allowExternalAi: true,
        retentionMonths: 24,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    // Role is deliberately NOT taken from the request body. This endpoint is
    // unauthenticated, so honouring a client-supplied `role` let anyone POST
    // {"role":"ADMIN"} and mint themselves an administrator account inside the
    // existing tenant. Privilege assignment belongs to the authenticated paths:
    // POST /invite (admin invites a member at a chosen role) and
    // PATCH /users/:id/role (admin changes a role).
    //
    // Someone who registers a brand-new organization owns it, so they become
    // its ADMIN. Anyone joining an already-existing organization gets the same
    // default as before, and can be promoted later by an admin.
    const assignedRole: AuthRole = isNewOrganization ? 'ADMIN' : 'QUALITY_ENGINEER';

    const passwordHash = await hashPassword(cleanPassword);
    const userId = `user-${Date.now()}-${generateRandomToken(4)}`;

    const newUser: UserRecord = {
      id: userId,
      name: cleanName,
      email: cleanEmail,
      password_hash: passwordHash,
      role: assignedRole,
      organization_id: org.id,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_login_at: new Date().toISOString(),
      avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(cleanName)}&backgroundColor=059669,0284c7`,
    };

    db.createUser(newUser);

    // Create session and set cookie
    const sessionId = generateRandomToken(32);
    const forwarded = req.headers['x-forwarded-for'];
    const ipAddress = typeof forwarded === 'string'
      ? forwarded.split(',')[0].trim()
      : (req.socket.remoteAddress || req.ip || '127.0.0.1');

    db.createSession({
      id: sessionId,
      user_id: newUser.id,
      organization_id: org.id,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
      last_active_at: new Date().toISOString(),
      ip_address: ipAddress,
      user_agent: req.headers['user-agent'] || 'Unknown',
    });

    setSessionCookie(res, sessionId);

    db.addAuditEvent(org.id, {
      actorId: newUser.id,
      actorName: newUser.name,
      actorRole: newUser.role,
      action: 'USER_REGISTERED',
      objectType: 'auth',
      objectId: newUser.id,
      objectName: newUser.name,
      details: { email: newUser.email, role: newUser.role, orgName: org.name },
    });

    const safeUser = sanitizeUser(newUser, org);
    return res.status(201).json({
      success: true,
      user: safeUser,
      organization: org,
    });
  } catch (err: any) {
    console.error('Registration error:', err);
    return res.status(500).json({ error: 'An unexpected server error occurred during account creation.' });
  }
});

/**
 * POST /api/auth/login
 * Real password verification, session creation, and secure HttpOnly cookie issuance.
 */
authRouter.post('/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || typeof email !== 'string' || !email.trim()) {
      return res.status(400).json({ error: 'Please enter your email address.' });
    }
    if (!password || typeof password !== 'string') {
      return res.status(400).json({ error: 'Please enter your password.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();
    const user = db.getUserByEmail(cleanEmail);

    if (!user) {
      // Record failed login audit event with dummy organization
      db.addAuditEvent('org-apex-01', {
        actorId: 'unknown',
        actorName: cleanEmail,
        actorRole: 'VIEWER',
        action: 'LOGIN_FAILED',
        objectType: 'auth',
        objectId: cleanEmail,
        objectName: 'Failed Login Attempt',
        details: { reason: 'User not found' },
      });

      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    if (!user.is_active) {
      db.addAuditEvent(user.organization_id, {
        actorId: user.id,
        actorName: user.name,
        actorRole: user.role,
        action: 'LOGIN_FAILED',
        objectType: 'auth',
        objectId: user.id,
        objectName: 'Deactivated User Login Attempt',
        details: { email: user.email },
      });
      return res.status(403).json({
        error: 'Your account has been deactivated. Please contact your administrator.',
      });
    }

    // Verify Password against scrypt hash
    const isValidPassword = await verifyPassword(cleanPassword, user.password_hash);
    if (!isValidPassword) {
      db.addAuditEvent(user.organization_id, {
        actorId: user.id,
        actorName: user.name,
        actorRole: user.role,
        action: 'LOGIN_FAILED',
        objectType: 'auth',
        objectId: user.id,
        objectName: 'Failed Login Attempt',
        details: { reason: 'Invalid password' },
      });
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const organization = db.getOrganization(user.organization_id);
    if (!organization) {
      return res.status(500).json({ error: 'Associated organization not found.' });
    }

    // Create Authenticated Session
    const sessionId = generateRandomToken(32);
    const forwarded = req.headers['x-forwarded-for'];
    const ipAddress = typeof forwarded === 'string'
      ? forwarded.split(',')[0].trim()
      : (req.socket.remoteAddress || req.ip || '127.0.0.1');

    db.createSession({
      id: sessionId,
      user_id: user.id,
      organization_id: user.organization_id,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
      last_active_at: new Date().toISOString(),
      ip_address: ipAddress,
      user_agent: req.headers['user-agent'] || 'Unknown',
    });

    // Record login timestamp
    db.recordUserLogin(user.id);

    // Set secure HttpOnly session cookie
    setSessionCookie(res, sessionId);

    // Audit Event
    db.addAuditEvent(user.organization_id, {
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      action: 'USER_LOGIN',
      objectType: 'auth',
      objectId: user.id,
      objectName: user.name,
      details: { email: user.email, ip: ipAddress },
    });

    const safeUser = sanitizeUser(user, organization);
    return res.json({
      success: true,
      user: safeUser,
      organization,
    });
  } catch (err: any) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'An unexpected server error occurred during login.' });
  }
});

/**
 * POST /api/auth/logout
 * Invalidate session on server and clear HttpOnly cookie.
 */
authRouter.post('/logout', (req, res) => {
  try {
    const sessionId = req.cookies ? req.cookies[AUTH_COOKIE_NAME] : undefined;
    if (sessionId) {
      db.deleteSession(sessionId);
    }

    if (req.user && req.organization) {
      db.addAuditEvent(req.organization.id, {
        actorId: req.user.id,
        actorName: req.user.name,
        actorRole: req.user.role,
        action: 'USER_LOGOUT',
        objectType: 'auth',
        objectId: req.user.id,
        objectName: req.user.name,
        details: { email: req.user.email },
      });
    }

    res.clearCookie(AUTH_COOKIE_NAME, { path: '/' });
    return res.json({ success: true, message: 'Logged out successfully.' });
  } catch (err: any) {
    console.error('Logout error:', err);
    res.clearCookie(AUTH_COOKIE_NAME, { path: '/' });
    return res.json({ success: true });
  }
});

/**
 * GET /api/auth/me
 * Returns the currently authenticated user profile, organization, and permissions.
 */
authRouter.get('/me', requireAuth, (req, res) => {
  if (!req.user || !req.organization) {
    return res.status(401).json({ error: 'Not authenticated.' });
  }
  const safeProfile = sanitizeUser(req.user, req.organization);
  return res.json({
    user: safeProfile,
    organization: req.organization,
    permissions: safeProfile.permissions,
  });
});

/**
 * POST /api/auth/forgot-password
 * Generates single-use secure reset token with 1-hour expiration.
 * Generic response prevents email enumeration.
 */
authRouter.post('/forgot-password', passwordResetLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== 'string' || !email.trim()) {
      return res.status(400).json({ error: 'Please provide your email address.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = db.getUserByEmail(cleanEmail);

    let devResetToken: string | undefined = undefined;

    if (user && user.is_active) {
      const rawToken = generateRandomToken(32);
      const tokenHash = hashToken(rawToken);
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

      db.createPasswordResetToken({
        id: `pwd-reset-${Date.now()}-${generateRandomToken(4)}`,
        user_id: user.id,
        token_hash: tokenHash,
        created_at: new Date().toISOString(),
        expires_at: expiresAt,
        is_used: false,
      });

      db.addAuditEvent(user.organization_id, {
        actorId: user.id,
        actorName: user.name,
        actorRole: user.role,
        action: 'PASSWORD_RESET_REQUESTED',
        objectType: 'auth',
        objectId: user.id,
        objectName: 'Password Reset Request',
        details: { email: user.email },
      });

      // In local/development mode, provide the token in response for quick testing
      if (!isProduction) {
        devResetToken = rawToken;
      }
    }

    return res.json({
      success: true,
      message: 'If an account associated with that email exists, password reset instructions have been generated.',
      resetToken: devResetToken,
    });
  } catch (err: any) {
    console.error('Forgot password error:', err);
    return res.status(500).json({ error: 'Failed to process password reset request.' });
  }
});

/**
 * POST /api/auth/reset-password
 * Verifies single-use reset token and securely updates password.
 */
authRouter.post('/reset-password', passwordResetLimiter, async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || typeof token !== 'string' || !token.trim()) {
      return res.status(400).json({ error: 'Password reset token is missing or invalid.' });
    }
    const cleanNewPassword = typeof newPassword === 'string' ? newPassword.trim() : '';
    if (cleanNewPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters long.' });
    }

    const tokenHash = hashToken(token.trim());
    const resetRecord = db.getPasswordResetToken(tokenHash);

    if (!resetRecord) {
      return res.status(400).json({ error: 'Password reset token is invalid or has expired.' });
    }

    const user = db.getUserById(resetRecord.user_id);
    if (!user) {
      return res.status(400).json({ error: 'User account not found.' });
    }

    // Hash new password
    const newPasswordHash = await hashPassword(cleanNewPassword);
    db.updateUser(user.id, { password_hash: newPasswordHash });

    // Invalidate reset token and all active sessions
    db.markPasswordResetTokenUsed(resetRecord.id);
    db.deleteUserSessions(user.id);

    db.addAuditEvent(user.organization_id, {
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      action: 'PASSWORD_RESET_COMPLETED',
      objectType: 'auth',
      objectId: user.id,
      objectName: 'Password Reset Completed',
      details: { email: user.email },
    });

    return res.json({
      success: true,
      message: 'Your password has been successfully updated. You may now sign in.',
    });
  } catch (err: any) {
    console.error('Reset password error:', err);
    return res.status(500).json({ error: 'Failed to reset password.' });
  }
});

/**
 * POST /api/auth/invite
 * Admin-only: Invites a new team member to their organization with assigned role.
 */
authRouter.post('/invite', requireAuth, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { email, role } = req.body;

    if (!email || typeof email !== 'string' || !email.trim() || !email.includes('@')) {
      return res.status(400).json({ error: 'Please provide a valid work email address.' });
    }

    const validRoles: AuthRole[] = ['ADMIN', 'QUALITY_ENGINEER', 'REVIEWER', 'VIEWER'];
    const assignedRole = (role as AuthRole) || 'QUALITY_ENGINEER';
    if (!validRoles.includes(assignedRole)) {
      return res.status(400).json({ error: `Invalid role specified. Valid options: ${validRoles.join(', ')}` });
    }

    const cleanEmail = email.trim().toLowerCase();
    const existingUser = db.getUserByEmail(cleanEmail);

    if (existingUser && existingUser.is_active) {
      return res.status(400).json({ error: 'A user account with this email address already exists.' });
    }

    const rawToken = generateRandomToken(32);
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

    const invitation = db.createInvitation({
      id: `inv-${Date.now()}-${generateRandomToken(4)}`,
      email: cleanEmail,
      role: assignedRole,
      organization_id: req.user!.organization_id,
      token_hash: tokenHash,
      invited_by: req.user!.id,
      created_at: new Date().toISOString(),
      expires_at: expiresAt,
      is_accepted: false,
    });

    db.addAuditEvent(req.user!.organization_id, {
      actorId: req.user!.id,
      actorName: req.user!.name,
      actorRole: req.user!.role,
      action: 'USER_INVITED',
      objectType: 'invitation',
      objectId: invitation.id,
      objectName: `Invitation to ${cleanEmail}`,
      details: { email: cleanEmail, assignedRole, invitedBy: req.user!.email },
    });

    return res.status(201).json({
      success: true,
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        expires_at: invitation.expires_at,
        inviteToken: rawToken,
        inviteLink: `/login?invitation=${rawToken}`,
      },
    });
  } catch (err: any) {
    console.error('Invite user error:', err);
    return res.status(500).json({ error: 'Failed to create user invitation.' });
  }
});

/**
 * POST /api/auth/accept-invite
 * Accepts invitation, creates password, activates account, and logs user in.
 */
authRouter.post('/accept-invite', async (req, res) => {
  try {
    const { token, name, password } = req.body;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Invitation token is missing.' });
    }
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Please enter your full name.' });
    }
    const cleanPassword = typeof password === 'string' ? password.trim() : '';
    if (cleanPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    const tokenHash = hashToken(token.trim());
    const invitation = db.getInvitationByTokenHash(tokenHash);

    if (!invitation) {
      return res.status(400).json({ error: 'Invitation token is invalid or has expired.' });
    }

    const org = db.getOrganization(invitation.organization_id);
    if (!org) {
      return res.status(400).json({ error: 'Organization associated with invitation not found.' });
    }

    const passwordHash = await hashPassword(cleanPassword);
    const userId = `user-${Date.now()}-${generateRandomToken(4)}`;
    const cleanName = name.trim();

    const newUser: UserRecord = {
      id: userId,
      name: cleanName,
      email: invitation.email,
      password_hash: passwordHash,
      role: invitation.role,
      organization_id: invitation.organization_id,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_login_at: new Date().toISOString(),
      avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(cleanName)}&backgroundColor=059669,0284c7`,
    };

    db.createUser(newUser);
    db.markInvitationAccepted(invitation.id);

    // Create session and log user in
    const sessionId = generateRandomToken(32);
    db.createSession({
      id: sessionId,
      user_id: newUser.id,
      organization_id: newUser.organization_id,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
      last_active_at: new Date().toISOString(),
      ip_address: req.ip || '127.0.0.1',
      user_agent: req.headers['user-agent'] || 'Unknown',
    });

    setSessionCookie(res, sessionId);

    db.addAuditEvent(org.id, {
      actorId: newUser.id,
      actorName: newUser.name,
      actorRole: newUser.role,
      action: 'USER_ACTIVATED',
      objectType: 'auth',
      objectId: newUser.id,
      objectName: newUser.name,
      details: { email: newUser.email, role: newUser.role },
    });

    return res.status(201).json({
      success: true,
      user: sanitizeUser(newUser, org),
      organization: org,
    });
  } catch (err: any) {
    console.error('Accept invite error:', err);
    return res.status(500).json({ error: 'Failed to accept invitation and activate account.' });
  }
});

/**
 * GET /api/auth/users
 * Admin-only: Get all users and pending invitations in the admin's organization.
 */
authRouter.get('/users', requireAuth, requireRole(['ADMIN']), (req, res) => {
  try {
    const orgId = req.user!.organization_id;
    const users = db.getUsersByOrg(orgId).map((u) => sanitizeUser(u, req.organization!));
    const invitations = db.getOrgInvitations(orgId).map((inv) => ({
      id: inv.id,
      email: inv.email,
      role: inv.role,
      created_at: inv.created_at,
      expires_at: inv.expires_at,
    }));

    return res.json({ users, invitations });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch organization users.' });
  }
});

/**
 * PATCH /api/auth/users/:id/role
 * Admin-only: Change a user's role within the organization.
 */
authRouter.patch('/users/:id/role', requireAuth, requireRole(['ADMIN']), (req, res) => {
  try {
    const targetUserId = req.params.id;
    const { role } = req.body;
    const validRoles: AuthRole[] = ['ADMIN', 'QUALITY_ENGINEER', 'REVIEWER', 'VIEWER'];

    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: `Invalid role. Must be one of: ${validRoles.join(', ')}` });
    }

    const targetUser = db.getUserById(targetUserId);
    if (!targetUser || targetUser.organization_id !== req.user!.organization_id) {
      return res.status(404).json({ error: 'User not found in your organization.' });
    }

    const previousRole = targetUser.role;
    const updated = db.updateUser(targetUserId, { role });

    db.addAuditEvent(req.user!.organization_id, {
      actorId: req.user!.id,
      actorName: req.user!.name,
      actorRole: req.user!.role,
      action: 'ROLE_CHANGED',
      objectType: 'user',
      objectId: targetUserId,
      objectName: targetUser.name,
      details: { previousRole, newRole: role, updatedBy: req.user!.email },
    });

    return res.json({ success: true, user: sanitizeUser(updated!, req.organization!) });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to update user role.' });
  }
});

/**
 * PATCH /api/auth/users/:id/status
 * Admin-only: Activate or deactivate a user account within the organization.
 */
authRouter.patch('/users/:id/status', requireAuth, requireRole(['ADMIN']), (req, res) => {
  try {
    const targetUserId = req.params.id;
    const { isActive } = req.body;

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ error: 'isActive must be a boolean.' });
    }

    if (targetUserId === req.user!.id && !isActive) {
      return res.status(400).json({ error: 'You cannot deactivate your own admin account.' });
    }

    const targetUser = db.getUserById(targetUserId);
    if (!targetUser || targetUser.organization_id !== req.user!.organization_id) {
      return res.status(404).json({ error: 'User not found in your organization.' });
    }

    const updated = db.updateUser(targetUserId, { is_active: isActive });

    if (!isActive) {
      // Invalidate target user's active sessions immediately
      db.deleteUserSessions(targetUserId);
    }

    db.addAuditEvent(req.user!.organization_id, {
      actorId: req.user!.id,
      actorName: req.user!.name,
      actorRole: req.user!.role,
      action: isActive ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
      objectType: 'user',
      objectId: targetUserId,
      objectName: targetUser.name,
      details: { is_active: isActive, modifiedBy: req.user!.email },
    });

    return res.json({ success: true, user: sanitizeUser(updated!, req.organization!) });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to update account status.' });
  }
});
