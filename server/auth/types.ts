export type AuthRole = 'ADMIN' | 'QUALITY_ENGINEER' | 'REVIEWER' | 'VIEWER';

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  role: AuthRole;
  organization_id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
  avatar?: string;
}

export interface OrganizationRecord {
  id: string;
  name: string;
  code: string;
  tier: string;
  requireMfa: boolean;
  allowExternalAi: boolean;
  retentionMonths: number;
  created_at: string;
  updated_at: string;
}

export interface SessionRecord {
  id: string; // Opaque session ID
  user_id: string;
  organization_id: string;
  created_at: string;
  expires_at: string;
  last_active_at: string;
  ip_address: string;
  user_agent: string;
}

export interface InvitationRecord {
  id: string;
  email: string;
  role: AuthRole;
  organization_id: string;
  token_hash: string;
  invited_by: string; // User ID
  created_at: string;
  expires_at: string;
  is_accepted: boolean;
  accepted_at?: string;
}

export interface PasswordResetTokenRecord {
  id: string;
  user_id: string;
  token_hash: string;
  created_at: string;
  expires_at: string;
  is_used: boolean;
  used_at?: string;
}

export interface SafeUserProfile {
  id: string;
  name: string;
  email: string;
  role: AuthRole;
  organization_id: string;
  organizationName: string;
  organizationCode?: string;
  avatar?: string;
  last_login_at: string | null;
  permissions: {
    canManageUsers: boolean;
    canManageRequirementSets: boolean;
    canUploadAndAnalyze: boolean;
    canReviewAndOverride: boolean;
    canApproveOrReject: boolean;
    canViewAuditTrail: boolean;
    isReadOnly: boolean;
  };
}

export function getRolePermissions(role: AuthRole): SafeUserProfile['permissions'] {
  switch (role) {
    case 'ADMIN':
      return {
        canManageUsers: true,
        canManageRequirementSets: true,
        canUploadAndAnalyze: true,
        canReviewAndOverride: true,
        canApproveOrReject: true,
        canViewAuditTrail: true,
        isReadOnly: false,
      };
    case 'QUALITY_ENGINEER':
      return {
        canManageUsers: false,
        canManageRequirementSets: true,
        canUploadAndAnalyze: true,
        canReviewAndOverride: false,
        canApproveOrReject: false,
        canViewAuditTrail: true,
        isReadOnly: false,
      };
    case 'REVIEWER':
      return {
        canManageUsers: false,
        canManageRequirementSets: false,
        canUploadAndAnalyze: false,
        canReviewAndOverride: true,
        canApproveOrReject: true,
        canViewAuditTrail: true,
        isReadOnly: false,
      };
    case 'VIEWER':
    default:
      return {
        canManageUsers: false,
        canManageRequirementSets: false,
        canUploadAndAnalyze: false,
        canReviewAndOverride: false,
        canApproveOrReject: false,
        canViewAuditTrail: true,
        isReadOnly: true,
      };
  }
}

export function sanitizeUser(user: UserRecord, org: OrganizationRecord): SafeUserProfile {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    organization_id: user.organization_id,
    organizationName: org.name,
    organizationCode: org.code,
    avatar: user.avatar,
    last_login_at: user.last_login_at,
    permissions: getRolePermissions(user.role),
  };
}
