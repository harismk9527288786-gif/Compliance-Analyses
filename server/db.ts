import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import pg from 'pg';
import {
  DocumentRecord,
  RequirementSet,
  CertificateRecord,
  AnalysisRecord,
  ComplianceFinding,
  AuditEvent,
  ExternalFeedbackDraft,
  FindingStatus,
  RetentionPolicyInfo,
} from '../src/types';
import {
  UserRecord,
  OrganizationRecord,
  SessionRecord,
  InvitationRecord,
  PasswordResetTokenRecord,
  AuthRole,
  SafeUserProfile,
  sanitizeUser,
} from './auth/types';
import { PILOT_MDS_REQUIREMENT_SET, PILOT_SUPPLIER_MTC } from '../src/engine/pilotData';
import { evaluateCompliance } from '../src/engine/rules';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'mtc_compliance_database.json');

// Default Seed Organizations with 30-Day Retention Policy
export const SEED_ORGANIZATIONS: OrganizationRecord[] = [
  {
    id: 'org-apex-01',
    name: 'Apex Valve & Flow Engineering Ltd.',
    code: 'APEX-VALVES',
    tier: 'Enterprise Quality Suite',
    requireMfa: true,
    allowExternalAi: true,
    retentionMonths: 1,
    retentionDays: 30,
    retentionPolicy: '30-Day Guaranteed Cloud Retention Policy',
    created_at: new Date('2026-01-01T00:00:00Z').toISOString(),
    updated_at: new Date('2026-01-01T00:00:00Z').toISOString(),
  },
  {
    id: 'org-global-02',
    name: 'Global Metallurgy & Inspection Corp',
    code: 'GMIC-QC',
    tier: 'Professional QC',
    requireMfa: false,
    allowExternalAi: true,
    retentionMonths: 1,
    retentionDays: 30,
    retentionPolicy: '30-Day Guaranteed Cloud Retention Policy',
    created_at: new Date('2026-01-01T00:00:00Z').toISOString(),
    updated_at: new Date('2026-01-01T00:00:00Z').toISOString(),
  },
];

// Pre-computed scrypt hash for default initial password "password123"
// Generated using standard Node.js crypto.scrypt (keylen: 64, salt: 16 bytes hex)
const DEFAULT_PASSWORD_HASH =
  'scrypt$9ce9625d882cadfc116b50d0aadc67df$b97424690a01441b7888f132e5abf767521081d29d3d2f481684c1a54e3a345b4e8565c579bc9868fb03bc98020b8e622fb4cff4b9474beb6b51863c259fddb1';

// Pre-seeded Demo Users (One for each primary role)
export const SEED_USERS: UserRecord[] = [
  {
    id: 'user-lead-qc',
    name: 'Sarah Jenkins',
    email: 'qc.lead@apexvalves.com',
    password_hash: DEFAULT_PASSWORD_HASH,
    role: 'REVIEWER',
    organization_id: 'org-apex-01',
    is_active: true,
    created_at: new Date('2026-01-01T00:00:00Z').toISOString(),
    updated_at: new Date('2026-01-01T00:00:00Z').toISOString(),
    last_login_at: null,
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'user-materials-engineer',
    name: 'Dr. Marcus Vance (PE)',
    email: 'materials.engineer@apexvalves.com',
    password_hash: DEFAULT_PASSWORD_HASH,
    role: 'QUALITY_ENGINEER',
    organization_id: 'org-apex-01',
    is_active: true,
    created_at: new Date('2026-01-01T00:00:00Z').toISOString(),
    updated_at: new Date('2026-01-01T00:00:00Z').toISOString(),
    last_login_at: null,
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'user-quality-auditor',
    name: 'Elena Rostova',
    email: 'auditor@apexvalves.com',
    password_hash: DEFAULT_PASSWORD_HASH,
    role: 'REVIEWER',
    organization_id: 'org-apex-01',
    is_active: true,
    created_at: new Date('2026-01-01T00:00:00Z').toISOString(),
    updated_at: new Date('2026-01-01T00:00:00Z').toISOString(),
    last_login_at: null,
    avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'user-admin-system',
    name: 'David Chen',
    email: 'admin@apexvalves.com',
    password_hash: DEFAULT_PASSWORD_HASH,
    role: 'ADMIN',
    organization_id: 'org-apex-01',
    is_active: true,
    created_at: new Date('2026-01-01T00:00:00Z').toISOString(),
    updated_at: new Date('2026-01-01T00:00:00Z').toISOString(),
    last_login_at: null,
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 'user-viewer-guest',
    name: 'Robert Miller',
    email: 'observer@clientaudit.com',
    password_hash: DEFAULT_PASSWORD_HASH,
    role: 'VIEWER',
    organization_id: 'org-global-02',
    is_active: true,
    created_at: new Date('2026-01-01T00:00:00Z').toISOString(),
    updated_at: new Date('2026-01-01T00:00:00Z').toISOString(),
    last_login_at: null,
    avatar: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=150&auto=format&fit=crop&q=80',
  },
];

interface DatabaseSchema {
  organizations: Record<string, OrganizationRecord>;
  users: Record<string, UserRecord>;
  sessions: Record<string, SessionRecord>;
  invitations: Record<string, InvitationRecord>;
  passwordResetTokens: Record<string, PasswordResetTokenRecord>;
  documents: Record<string, DocumentRecord>;
  requirementSets: Record<string, RequirementSet>;
  certificates: Record<string, CertificateRecord>;
  analyses: Record<string, AnalysisRecord>;
  findings: Record<string, ComplianceFinding[]>;
  feedbackDrafts: Record<string, ExternalFeedbackDraft>;
  auditLogs: AuditEvent[];
}

export class DatabaseStore {
  private data: DatabaseSchema = {
    organizations: {},
    users: {},
    sessions: {},
    invitations: {},
    passwordResetTokens: {},
    documents: {},
    requirementSets: {},
    certificates: {},
    analyses: {},
    findings: {},
    feedbackDrafts: {},
    auditLogs: [],
  };

  private initPromise: Promise<void> | null = null;
  private pendingWritePromise: Promise<void> | null = null;
  private pgPool: pg.Pool | null = null;
  private lastSyncedAtTime = 0;
  public isPostgresConnected = false;

  constructor() {
    this.loadFromDisk();
    this.ensureSeedData();
    this.initPromise = this.initPostgres().catch((err) => {
      console.warn('Optional PostgreSQL initialization notice:', err.message);
    });

    // Run 30-day retention maintenance check every 60 minutes
    setInterval(() => {
      this.enforce30DayRetention();
    }, 60 * 60 * 1000);
  }

  private async initPostgres(): Promise<void> {
    const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_URL_NON_POOLING;
    if (!dbUrl) return;

    try {
      const isProduction = process.env.NODE_ENV === 'production' || !!process.env.VERCEL;
      const needsSsl =
        isProduction ||
        dbUrl.includes('sslmode=require') ||
        dbUrl.includes('ssl=true') ||
        dbUrl.includes('postgres.') ||
        dbUrl.includes('supabase') ||
        dbUrl.includes('neon.tech') ||
        dbUrl.includes('render.com') ||
        dbUrl.includes('vercel-storage');

      this.pgPool = new pg.Pool({
        connectionString: dbUrl,
        ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      });

      this.pgPool.on('error', (err) => {
        console.warn('PostgreSQL pool background client warning:', err.message);
      });

      await this.pgPool.query(`
        CREATE TABLE IF NOT EXISTS mtc_database_store (
          id VARCHAR(50) PRIMARY KEY,
          data JSONB NOT NULL,
          updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );
      `);

      const res = await this.pgPool.query('SELECT data FROM mtc_database_store WHERE id = $1', ['main_store']);
      if (res.rows.length > 0 && res.rows[0].data) {
        const parsed = res.rows[0].data;
        this.data = {
          organizations: { ...(this.data.organizations || {}), ...(parsed.organizations || {}) },
          users: { ...(this.data.users || {}), ...(parsed.users || {}) },
          sessions: { ...(this.data.sessions || {}), ...(parsed.sessions || {}) },
          invitations: { ...(this.data.invitations || {}), ...(parsed.invitations || {}) },
          passwordResetTokens: { ...(this.data.passwordResetTokens || {}), ...(parsed.passwordResetTokens || {}) },
          documents: { ...(this.data.documents || {}), ...(parsed.documents || {}) },
          requirementSets: { ...(this.data.requirementSets || {}), ...(parsed.requirementSets || {}) },
          certificates: { ...(this.data.certificates || {}), ...(parsed.certificates || {}) },
          analyses: { ...(this.data.analyses || {}), ...(parsed.analyses || {}) },
          findings: { ...(this.data.findings || {}), ...(parsed.findings || {}) },
          feedbackDrafts: { ...(this.data.feedbackDrafts || {}), ...(parsed.feedbackDrafts || {}) },
          auditLogs: parsed.auditLogs || this.data.auditLogs || [],
        };
        this.persistToDisk();
      } else {
        await this.persistToPostgres();
      }
      this.isPostgresConnected = true;
      this.lastSyncedAtTime = Date.now();
      console.log('Successfully connected to PostgreSQL database persistence store.');
    } catch (err: any) {
      console.warn('PostgreSQL connection fallback to persistent local store:', err.message);
    }
  }

  public async syncFromPostgres(force = false): Promise<void> {
    if (!this.pgPool || !this.isPostgresConnected) return;
    const now = Date.now();
    if (!force && now - this.lastSyncedAtTime < 500) {
      return;
    }
    try {
      const res = await this.pgPool.query('SELECT data FROM mtc_database_store WHERE id = $1', ['main_store']);
      if (res.rows.length > 0 && res.rows[0].data) {
        const parsed = res.rows[0].data;
        this.data = {
          organizations: parsed.organizations || {},
          users: parsed.users || {},
          sessions: parsed.sessions || {},
          invitations: parsed.invitations || {},
          passwordResetTokens: parsed.passwordResetTokens || {},
          documents: parsed.documents || {},
          requirementSets: parsed.requirementSets || {},
          certificates: parsed.certificates || {},
          analyses: parsed.analyses || {},
          findings: parsed.findings || {},
          feedbackDrafts: parsed.feedbackDrafts || {},
          auditLogs: parsed.auditLogs || [],
        };
        this.lastSyncedAtTime = now;
      }
    } catch (err: any) {
      console.warn('PostgreSQL sync notice:', err.message);
    }
  }

  public async ensureReady(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise;
    }
    if (this.pgPool && this.isPostgresConnected) {
      await this.syncFromPostgres();
    }
  }

  public async persistToPostgres(): Promise<void> {
    if (!this.pgPool) return;
    try {
      await this.pgPool.query(
        `INSERT INTO mtc_database_store (id, data, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
        ['main_store', JSON.stringify(this.data)]
      );
      this.lastSyncedAtTime = Date.now();
    } catch (err: any) {
      console.error('Failed to sync data with PostgreSQL:', err.message);
    }
  }

  private loadFromDisk(): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }

      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          this.data = {
            organizations: parsed.organizations || {},
            users: parsed.users || {},
            sessions: parsed.sessions || {},
            invitations: parsed.invitations || {},
            passwordResetTokens: parsed.passwordResetTokens || {},
            documents: parsed.documents || {},
            requirementSets: parsed.requirementSets || {},
            certificates: parsed.certificates || {},
            analyses: parsed.analyses || {},
            findings: parsed.findings || {},
            feedbackDrafts: parsed.feedbackDrafts || {},
            auditLogs: parsed.auditLogs || [],
          };
        }
      }
    } catch (e) {
      console.error('Error loading database from disk, starting with clean memory store:', e);
    }
  }

  public persistToDisk(): void {
    try {
      if (!process.env.VERCEL) {
        if (!fs.existsSync(DATA_DIR)) {
          fs.mkdirSync(DATA_DIR, { recursive: true });
        }
        fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
      }
    } catch (e: any) {
      if (e.code !== 'EROFS') {
        console.error('Failed to write database to disk:', e.message);
      }
    }
  }

  public async persist(): Promise<void> {
    this.persistToDisk();
    if (this.pgPool && this.isPostgresConnected) {
      await this.persistToPostgres();
    }
  }

  public hasPendingWrites(): boolean {
    return this.pendingWritePromise !== null;
  }

  public async flushWrites(): Promise<void> {
    this.persistToDisk();
    if (this.pendingWritePromise) {
      await this.pendingWritePromise;
    } else if (this.pgPool && this.isPostgresConnected) {
      await this.persistToPostgres();
    }
  }

  private scheduleSave(): void {
    this.persistToDisk();
    if (this.pgPool && this.isPostgresConnected) {
      this.pendingWritePromise = this.persistToPostgres().finally(() => {
        this.pendingWritePromise = null;
      });
    }
  }

  private ensureSeedData(): void {
    // 1. Seed Organizations
    for (const org of SEED_ORGANIZATIONS) {
      if (!this.data.organizations[org.id]) {
        this.data.organizations[org.id] = { ...org };
      }
    }

    // 2. Seed Users — only create records that are missing entirely.
    // Never touch an existing record: the previous version re-seeded any user
    // whose password_hash no longer matched the built-in demo hash, which meant
    // every restart silently reverted real password changes (and name/role
    // edits) back to the "password123" demo values, so a freshly changed
    // password would stop working on the next boot.
    for (const user of SEED_USERS) {
      if (!this.data.users[user.id]) {
        this.data.users[user.id] = { ...user };
      }
    }

    // 3. Seed Default Pilot Requirement Sets & Pilot Analysis for Apex Org
    const apexOrgId = 'org-apex-01';
    const pilotReqSetId = PILOT_MDS_REQUIREMENT_SET.id;
    if (!this.data.requirementSets[pilotReqSetId]) {
      this.data.requirementSets[pilotReqSetId] = {
        ...PILOT_MDS_REQUIREMENT_SET,
        organizationId: apexOrgId,
      };
    }

    // Seed Standard Templates
    const shellId = 'reqset-shell-mesc-spe-77-302';
    if (!this.data.requirementSets[shellId]) {
      this.data.requirementSets[shellId] = {
        id: shellId,
        clientName: 'Shell Global Solutions',
        materialGrade: 'ASTM A105N',
        mdsNumber: 'MESC SPE 77/302',
        revision: 'Rev 2024.1',
        title: 'Shell MESC SPE 77/302 - Carbon Steel Valves & Forgings',
        effectiveDate: '2024-01-15',
        status: 'approved',
        approvedBy: 'user-materials-engineer',
        approvedAt: new Date().toISOString(),
        organizationId: apexOrgId,
        requirements: PILOT_MDS_REQUIREMENT_SET.requirements,
      };
    }

    const aramcoId = 'reqset-saudi-aramco-04-samss-048';
    if (!this.data.requirementSets[aramcoId]) {
      this.data.requirementSets[aramcoId] = {
        id: aramcoId,
        clientName: 'Saudi Aramco',
        materialGrade: 'ASTM A105N',
        mdsNumber: '04-SAMSS-048',
        revision: 'Rev 4',
        title: 'Saudi Aramco 04-SAMSS-048 - Valve Body & Trim Metallurgy',
        effectiveDate: '2023-11-01',
        status: 'approved',
        approvedBy: 'user-materials-engineer',
        approvedAt: new Date().toISOString(),
        organizationId: apexOrgId,
        requirements: PILOT_MDS_REQUIREMENT_SET.requirements,
      };
    }

    // Pre-seed Pilot Analysis
    const pilotAnalysisId = 'analysis-pilot-ww2606229-3';
    if (!this.data.analyses[pilotAnalysisId]) {
      const pilotFindings = evaluateCompliance({
        analysisId: pilotAnalysisId,
        requirements: PILOT_MDS_REQUIREMENT_SET.requirements,
        certificate: PILOT_SUPPLIER_MTC,
      });

      const passCount = pilotFindings.filter((f) => f.status === 'PASS').length;
      const devCount = pilotFindings.filter((f) => f.status === 'DEVIATION').length;
      const gapCount = pilotFindings.filter((f) => f.status === 'DOCUMENTATION_GAP').length;
      const reqCount = pilotFindings.filter((f) => f.status === 'REVIEW_REQUIRED').length;

      this.data.certificates[PILOT_SUPPLIER_MTC.id] = { ...PILOT_SUPPLIER_MTC };

      this.data.analyses[pilotAnalysisId] = {
        id: pilotAnalysisId,
        organizationId: apexOrgId,
        title: 'Pilot Benchmark Analysis: Western Forge (WW2606229-3) vs Hawa MDS Rev A',
        mtcDocumentId: 'doc-mtc-ww2606229-3',
        mtcFilename: 'Western_Forge_MTC_WW2606229-3.pdf',
        requirementSetId: PILOT_MDS_REQUIREMENT_SET.id,
        requirementSetTitle: PILOT_MDS_REQUIREMENT_SET.title,
        materialGrade: 'ASTM A105N',
        supplierName: 'Western Forge & Flange Co.',
        clientName: 'Hawa Valves Quality Directorate',
        poNumber: 'PO-2026-APEX-8821',
        mtcNumber: 'WW2606229-3',
        heats: ['HEAT-8821A', 'HEAT-8821B'],
        status: 'ready_for_review',
        createdAt: new Date().toISOString(),
        createdBy: 'user-lead-qc',
        createdByName: 'Sarah Jenkins (Lead QC)',
        passCount,
        deviationCount: devCount,
        documentationGapCount: gapCount,
        reviewRequiredCount: reqCount,
        totalFindings: pilotFindings.length,
        reviewedCount: 0,
        ruleEngineVersion: 'MTC-CoreEngine v2.4.0',
        aiModelUsed: 'gemini-3.7-flash',
      };

      this.data.findings[pilotAnalysisId] = pilotFindings;

      const deviations = pilotFindings.filter((f) => f.status === 'DEVIATION');
      const gaps = pilotFindings.filter((f) => f.status === 'DOCUMENTATION_GAP');

      this.data.feedbackDrafts[pilotAnalysisId] = {
        id: `feedback-${pilotAnalysisId}`,
        analysisId: pilotAnalysisId,
        title: 'Supplier Quality Review & Clarification Request: Western Forge WW2606229-3',
        overallStatus: devCount > 0 ? 'REVIEW REQUIRED' : 'COMPLIANT',
        salutation: 'Dear Western Forge & Flange Quality Directorate,',
        openingStatement:
          'The submitted Material Test Certificate (WW2606229-3) for PO PO-2026-APEX-8821 has been analyzed against project specification Hawa Valves MDS Rev A.',
        conformingSummary:
          'Chemical composition and standard tensile mechanical properties for approved heats have been verified against applicable ASTM A105N thresholds.',
        clarificationPoints: [
          ...deviations.map((d, i) => ({
            id: `dev-pt-${i + 1}`,
            itemNumber: i + 1,
            title: `${d.displayName} Deviation (${d.heatNo || 'General'})`,
            findingId: d.id,
            description: `Reported value "${d.supplierRawValue}" deviates from specified requirement "${d.requirementText}". Reason: ${d.reason}`,
            actionRequired: 'Please submit corrective technical documentation or re-test justification.',
          })),
          ...gaps.map((g, i) => ({
            id: `gap-pt-${i + 1}`,
            itemNumber: deviations.length + i + 1,
            title: `Missing Evidence: ${g.displayName}`,
            findingId: g.id,
            description: `Client MDS Clause mandates "${g.displayName}", which was not identified in the submitted MTC.`,
            actionRequired: 'Please attach formal Level II supplementary test certificate.',
          })),
        ],
        closingStatement:
          'Please provide written clarification and supporting documentation within 5 working days to enable final material acceptance.',
        status: 'draft',
      };

      this.data.auditLogs.unshift({
        id: `audit-init-${Date.now()}`,
        timestamp: new Date().toISOString(),
        organizationId: apexOrgId,
        actorId: 'user-admin-system',
        actorName: 'David Chen',
        actorRole: 'ADMIN',
        action: 'SYSTEM_INITIALIZE',
        objectType: 'system',
        objectId: 'system-seed',
        objectName: 'MTC Compliance System Initialization',
        details: { version: '2.4.0', initialAnalyses: 1, initialOrg: apexOrgId },
      });
    }

    this.persistToDisk();
  }

  // =========================================================================
  // ORGANIZATIONS & TENANTS
  // =========================================================================
  public getOrganizations(): OrganizationRecord[] {
    return Object.values(this.data.organizations);
  }

  public getOrganization(id: string): OrganizationRecord | undefined {
    return this.data.organizations[id];
  }

  public createOrganization(org: OrganizationRecord): OrganizationRecord {
    this.data.organizations[org.id] = { ...org };
    this.persistToDisk();
    return org;
  }

  // =========================================================================
  // USERS
  // =========================================================================
  public getUsers(): UserRecord[] {
    return Object.values(this.data.users);
  }

  public getUsersByOrg(orgId: string): UserRecord[] {
    return Object.values(this.data.users).filter((u) => u.organization_id === orgId);
  }

  public getUserById(id: string): UserRecord | undefined {
    return this.data.users[id];
  }

  public getUserByEmail(email: string): UserRecord | undefined {
    const clean = email.trim().toLowerCase();
    return Object.values(this.data.users).find((u) => u.email.toLowerCase() === clean);
  }

  public createUser(user: UserRecord): UserRecord {
    this.data.users[user.id] = { ...user };
    this.persistToDisk();
    return user;
  }

  public updateUser(id: string, updates: Partial<UserRecord>): UserRecord | undefined {
    const user = this.data.users[id];
    if (!user) return undefined;
    const updated: UserRecord = {
      ...user,
      ...updates,
      updated_at: new Date().toISOString(),
    };
    this.data.users[id] = updated;
    this.persistToDisk();
    return updated;
  }

  public recordUserLogin(id: string): void {
    const user = this.data.users[id];
    if (user) {
      user.last_login_at = new Date().toISOString();
      user.updated_at = new Date().toISOString();
      this.scheduleSave();
    }
  }

  // =========================================================================
  // SESSIONS
  // =========================================================================
  public createSession(session: SessionRecord): SessionRecord {
    this.data.sessions[session.id] = { ...session };
    this.scheduleSave();
    return session;
  }

  public getSession(id: string): SessionRecord | undefined {
    const session = this.data.sessions[id];
    if (!session) return undefined;

    // Check expiration
    if (new Date(session.expires_at).getTime() <= Date.now()) {
      delete this.data.sessions[id];
      this.scheduleSave();
      return undefined;
    }

    return session;
  }

  public touchSession(id: string, extensionMs = 7 * 24 * 60 * 60 * 1000): void {
    const session = this.data.sessions[id];
    if (session) {
      session.last_active_at = new Date().toISOString();
      session.expires_at = new Date(Date.now() + extensionMs).toISOString();
      this.scheduleSave();
    }
  }

  public deleteSession(id: string): void {
    if (this.data.sessions[id]) {
      delete this.data.sessions[id];
      this.scheduleSave();
    }
  }

  public deleteUserSessions(userId: string): void {
    for (const [sId, session] of Object.entries(this.data.sessions)) {
      if (session.user_id === userId) {
        delete this.data.sessions[sId];
      }
    }
    this.scheduleSave();
  }

  // =========================================================================
  // INVITATIONS
  // =========================================================================
  public createInvitation(invitation: InvitationRecord): InvitationRecord {
    this.data.invitations[invitation.id] = { ...invitation };
    this.scheduleSave();
    return invitation;
  }

  public getInvitationByTokenHash(tokenHash: string): InvitationRecord | undefined {
    return Object.values(this.data.invitations).find(
      (inv) => inv.token_hash === tokenHash && !inv.is_accepted && new Date(inv.expires_at).getTime() > Date.now()
    );
  }

  public markInvitationAccepted(id: string): void {
    const inv = this.data.invitations[id];
    if (inv) {
      inv.is_accepted = true;
      inv.accepted_at = new Date().toISOString();
      this.scheduleSave();
    }
  }

  public getOrgInvitations(orgId: string): InvitationRecord[] {
    return Object.values(this.data.invitations).filter(
      (inv) => inv.organization_id === orgId && !inv.is_accepted && new Date(inv.expires_at).getTime() > Date.now()
    );
  }

  // =========================================================================
  // PASSWORD RESET TOKENS
  // =========================================================================
  public createPasswordResetToken(tokenRecord: PasswordResetTokenRecord): PasswordResetTokenRecord {
    this.data.passwordResetTokens[tokenRecord.id] = { ...tokenRecord };
    this.scheduleSave();
    return tokenRecord;
  }

  public getPasswordResetToken(tokenHash: string): PasswordResetTokenRecord | undefined {
    return Object.values(this.data.passwordResetTokens).find(
      (t) => t.token_hash === tokenHash && !t.is_used && new Date(t.expires_at).getTime() > Date.now()
    );
  }

  public markPasswordResetTokenUsed(id: string): void {
    const token = this.data.passwordResetTokens[id];
    if (token) {
      token.is_used = true;
      token.used_at = new Date().toISOString();
      this.scheduleSave();
    }
  }

  // =========================================================================
  // DOCUMENTS (STRICTLY ORG SCOPED)
  // =========================================================================
  public getDocuments(orgId: string): DocumentRecord[] {
    return Object.values(this.data.documents).filter((d) => d.organizationId === orgId);
  }

  public getDocument(orgId: string, id: string): DocumentRecord | undefined {
    const doc = this.data.documents[id];
    if (doc && doc.organizationId === orgId) return doc;
    return undefined;
  }

  public setDocument(orgId: string, id: string, doc: DocumentRecord): void {
    this.data.documents[id] = { ...doc, organizationId: orgId };
    this.scheduleSave();
  }

  // =========================================================================
  // REQUIREMENT SETS (STRICTLY ORG SCOPED)
  // =========================================================================
  public getRequirementSets(orgId: string): RequirementSet[] {
    return Object.values(this.data.requirementSets).filter((r) => r.organizationId === orgId);
  }

  public getRequirementSet(orgId: string, id: string): RequirementSet | undefined {
    const req = this.data.requirementSets[id];
    if (req && req.organizationId === orgId) return req;
    return undefined;
  }

  public setRequirementSet(orgId: string, id: string, reqSet: RequirementSet): void {
    this.data.requirementSets[id] = { ...reqSet, organizationId: orgId };
    this.scheduleSave();
  }

  public deleteRequirementSet(orgId: string, id: string): boolean {
    const req = this.data.requirementSets[id];
    if (req && req.organizationId === orgId) {
      delete this.data.requirementSets[id];
      this.scheduleSave();
      return true;
    }
    return false;
  }

  public clearAllRequirementSets(orgId: string): void {
    for (const [id, r] of Object.entries(this.data.requirementSets)) {
      if (r.organizationId === orgId) {
        delete this.data.requirementSets[id];
      }
    }
    this.scheduleSave();
  }

  // =========================================================================
  // CERTIFICATES (STRICTLY ORG SCOPED)
  // =========================================================================
  public getCertificate(id: string): CertificateRecord | undefined {
    return this.data.certificates[id];
  }

  public setCertificate(id: string, cert: CertificateRecord): void {
    this.data.certificates[id] = { ...cert };
    this.scheduleSave();
  }

  // =========================================================================
  // ANALYSES & FINDINGS (STRICTLY ORG SCOPED WITH 30-DAY RETENTION)
  // =========================================================================
  public getAnalyses(orgId: string): AnalysisRecord[] {
    this.enforce30DayRetention(orgId);
    return Object.values(this.data.analyses)
      .filter((a) => a.organizationId === orgId)
      .map((a) => {
        const createdTime = new Date(a.createdAt).getTime();
        const expiresTime = a.expiresAt ? new Date(a.expiresAt).getTime() : createdTime + (30 * 24 * 60 * 60 * 1000);
        const daysRemaining = Math.max(0, Math.ceil((expiresTime - Date.now()) / (1000 * 60 * 60 * 24)));
        return {
          ...a,
          expiresAt: a.expiresAt || new Date(expiresTime).toISOString(),
          retentionDaysRemaining: daysRemaining,
        };
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public getAnalysis(orgId: string, id: string): AnalysisRecord | undefined {
    const analysis = this.data.analyses[id];
    if (analysis && analysis.organizationId === orgId) {
      const createdTime = new Date(analysis.createdAt).getTime();
      const expiresTime = analysis.expiresAt ? new Date(analysis.expiresAt).getTime() : createdTime + (30 * 24 * 60 * 60 * 1000);
      const daysRemaining = Math.max(0, Math.ceil((expiresTime - Date.now()) / (1000 * 60 * 60 * 24)));
      return {
        ...analysis,
        expiresAt: analysis.expiresAt || new Date(expiresTime).toISOString(),
        retentionDaysRemaining: daysRemaining,
      };
    }
    return undefined;
  }

  public setAnalysis(orgId: string, id: string, analysis: AnalysisRecord): void {
    const createdTime = analysis.createdAt ? new Date(analysis.createdAt).getTime() : Date.now();
    const expiresAt = analysis.expiresAt || new Date(createdTime + (30 * 24 * 60 * 60 * 1000)).toISOString();
    const daysRemaining = Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));

    this.data.analyses[id] = {
      ...analysis,
      organizationId: orgId,
      expiresAt,
      retentionDaysRemaining: daysRemaining,
    };
    this.scheduleSave();
  }

  public deleteAnalysis(orgId: string, id: string): boolean {
    const analysis = this.data.analyses[id];
    if (analysis && analysis.organizationId === orgId) {
      delete this.data.analyses[id];
      delete this.data.findings[id];
      delete this.data.feedbackDrafts[id];
      this.scheduleSave();
      return true;
    }
    return false;
  }

  public clearAllAnalyses(orgId: string): void {
    for (const [id, a] of Object.entries(this.data.analyses)) {
      if (a.organizationId === orgId) {
        delete this.data.analyses[id];
        delete this.data.findings[id];
        delete this.data.feedbackDrafts[id];
      }
    }
    this.scheduleSave();
  }

  public enforce30DayRetention(orgId?: string): { purgedCount: number } {
    const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    let purgedCount = 0;

    for (const [id, a] of Object.entries(this.data.analyses)) {
      if (orgId && a.organizationId !== orgId) continue;
      const createdTime = new Date(a.createdAt).getTime();
      const expiresTime = a.expiresAt ? new Date(a.expiresAt).getTime() : createdTime + RETENTION_MS;

      if (now > expiresTime) {
        delete this.data.analyses[id];
        delete this.data.findings[id];
        delete this.data.feedbackDrafts[id];
        purgedCount++;
      }
    }

    if (purgedCount > 0) {
      this.scheduleSave();
    }
    return { purgedCount };
  }

  public getRetentionPolicyInfo(orgId: string): RetentionPolicyInfo {
    const org = this.getOrganization(orgId);
    const analyses = this.getAnalyses(orgId);
    return {
      policyName: '30-Day Guaranteed Cloud Retention Policy',
      retentionDays: 30,
      guaranteedUntilNotice: 'All verification records, MTC findings, audit logs, and account files are retained for 30 days from creation.',
      totalActiveRecords: analyses.length,
      storageTier: org?.tier || 'Render Cloud Free Storage (30-Day Policy)',
      lastPurgeCheckAt: new Date().toISOString(),
      disclaimer: 'In accordance with ISO 9001 quality standards and cloud hosting capacity terms, verify and export your final compliance reports (PDF & Excel) within 30 days of generation.',
    };
  }

  public getFindings(orgId: string, analysisId: string): ComplianceFinding[] | undefined {
    const analysis = this.getAnalysis(orgId, analysisId);
    if (!analysis) return undefined;
    return this.data.findings[analysisId] || [];
  }

  public setFindings(orgId: string, analysisId: string, findings: ComplianceFinding[]): void {
    const analysis = this.getAnalysis(orgId, analysisId);
    if (analysis) {
      this.data.findings[analysisId] = findings;
      this.scheduleSave();
    }
  }

  public getFeedbackDraft(orgId: string, analysisId: string): ExternalFeedbackDraft | undefined {
    const analysis = this.getAnalysis(orgId, analysisId);
    if (!analysis) return undefined;
    return this.data.feedbackDrafts[analysisId];
  }

  public setFeedbackDraft(orgId: string, analysisId: string, feedback: ExternalFeedbackDraft): void {
    const analysis = this.getAnalysis(orgId, analysisId);
    if (analysis) {
      this.data.feedbackDrafts[analysisId] = feedback;
      this.scheduleSave();
    }
  }

  // =========================================================================
  // AUDIT LOGS (STRICTLY ORG SCOPED)
  // =========================================================================
  public getAuditLogs(orgId: string): AuditEvent[] {
    return this.data.auditLogs
      .filter((a) => a.organizationId === orgId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  public addAuditEvent(
    orgId: string,
    event: Omit<AuditEvent, 'id' | 'timestamp' | 'organizationId'> & { timestamp?: string; id?: string; organizationId?: string }
  ): AuditEvent {
    const auditRecord: AuditEvent = {
      id: event.id || `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: event.timestamp || new Date().toISOString(),
      organizationId: orgId,
      actorId: event.actorId,
      actorName: event.actorName,
      actorRole: event.actorRole,
      action: event.action,
      objectType: event.objectType,
      objectId: event.objectId,
      objectName: event.objectName,
      details: event.details || {},
    };

    this.data.auditLogs.unshift(auditRecord);
    // Keep max 5000 audit records to avoid unbounded growth
    if (this.data.auditLogs.length > 5000) {
      this.data.auditLogs = this.data.auditLogs.slice(0, 5000);
    }
    this.scheduleSave();
    return auditRecord;
  }

  // =========================================================================
  // TEMPLATES & PILOT HELPERS
  // =========================================================================
  public loadStandardTemplatesForOrg(orgId: string, actor: UserRecord): RequirementSet[] {
    const templates = [
      {
        id: `reqset-shell-${Date.now()}`,
        clientName: 'Shell Global Solutions',
        materialGrade: 'ASTM A105N',
        mdsNumber: 'MESC SPE 77/302',
        revision: 'Rev 2024.1',
        title: 'Shell MESC SPE 77/302 - Carbon Steel Valves & Forgings',
        effectiveDate: new Date().toISOString().split('T')[0],
        status: 'approved' as const,
        approvedBy: actor.id,
        approvedAt: new Date().toISOString(),
        organizationId: orgId,
        requirements: PILOT_MDS_REQUIREMENT_SET.requirements,
      },
      {
        id: `reqset-aramco-${Date.now()}`,
        clientName: 'Saudi Aramco',
        materialGrade: 'ASTM A105N',
        mdsNumber: '04-SAMSS-048',
        revision: 'Rev 4',
        title: 'Saudi Aramco 04-SAMSS-048 - Valve Body & Trim Metallurgy',
        effectiveDate: new Date().toISOString().split('T')[0],
        status: 'approved' as const,
        approvedBy: actor.id,
        approvedAt: new Date().toISOString(),
        organizationId: orgId,
        requirements: PILOT_MDS_REQUIREMENT_SET.requirements,
      },
    ];

    for (const t of templates) {
      this.data.requirementSets[t.id] = t;
    }

    this.addAuditEvent(orgId, {
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      action: 'LOAD_TEMPLATES',
      objectType: 'requirement_set',
      objectId: 'standard-templates',
      objectName: 'Standard Client MDS Templates Loaded',
      details: { count: templates.length },
    });

    this.scheduleSave();
    return this.getRequirementSets(orgId);
  }
}

export const db = new DatabaseStore();
export default db;
