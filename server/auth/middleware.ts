import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { UserRecord, OrganizationRecord, SessionRecord, AuthRole } from './types';

declare global {
  namespace Express {
    interface Request {
      user?: UserRecord;
      organization?: OrganizationRecord;
      session?: SessionRecord;
    }
  }
}

export const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME || 'mtc_session';

/**
 * Authentication Middleware: Extracts session token from HttpOnly cookie or Authorization header,
 * validates against database store, and attaches authenticated user & organization to req.
 */
export function authenticate(req: Request, res: Response, next: NextFunction) {
  try {
    let sessionId = req.cookies ? req.cookies[AUTH_COOKIE_NAME] : undefined;

    if (!sessionId) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        sessionId = authHeader.substring(7).trim();
      }
    }

    if (!sessionId) {
      return next();
    }

    const session = db.getSession(sessionId);
    if (!session) {
      // Session expired or invalidated on server
      res.clearCookie(AUTH_COOKIE_NAME, { path: '/' });
      return next();
    }

    const user = db.getUserById(session.user_id);
    if (!user || !user.is_active) {
      db.deleteSession(sessionId);
      res.clearCookie(AUTH_COOKIE_NAME, { path: '/' });
      return next();
    }

    let organization = db.getOrganization(session.organization_id);
    if (!organization) {
      const orgs = db.getOrganizations();
      organization = orgs[0];
    }
    if (!organization) {
      db.deleteSession(sessionId);
      res.clearCookie(AUTH_COOKIE_NAME, { path: '/' });
      return next();
    }

    // Attach valid session, user, and tenant organization to request
    req.session = session;
    req.user = user;
    req.organization = organization;

    // Slide session activity timestamp
    db.touchSession(sessionId);

    next();
  } catch (err) {
    console.error('Authentication middleware error:', err);
    next();
  }
}

/**
 * Route Guard: Requires authenticated user with active account.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user || !req.organization) {
    return res.status(401).json({
      error: 'Authentication required. Please sign in to access this resource.',
      code: 'UNAUTHENTICATED',
    });
  }
  if (!req.user.is_active) {
    return res.status(403).json({
      error: 'Your account has been deactivated. Please contact your organization administrator.',
      code: 'ACCOUNT_DEACTIVATED',
    });
  }
  next();
}

/**
 * Role-Based Access Control Guard: Requires user to have at least one of the specified roles.
 */
export function requireRole(allowedRoles: AuthRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required.',
        code: 'UNAUTHENTICATED',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Permission denied. Required role: [${allowedRoles.join(', ')}]. Current role: ${req.user.role}`,
        code: 'INSUFFICIENT_PERMISSIONS',
      });
    }

    next();
  };
}
