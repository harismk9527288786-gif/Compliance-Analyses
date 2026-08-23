import React, { useState, useEffect } from 'react';
import {
  FileCheck2,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  User as UserIcon,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Building2,
  KeyRound,
  Zap,
  Sparkles,
  LogIn,
  UserPlus,
  AlertCircle,
  Briefcase,
  Shield,
  Fingerprint,
  RefreshCw,
  BookOpen,
  X,
  Check,
} from 'lucide-react';
import { User as UserType, Organization } from '../types';
import { DottedGlowBackground } from './DottedGlowBackground';
import { apiFetch } from '../utils/api';

interface LoginPageProps {
  onLoginSuccess: (user: UserType, organization?: Organization) => void;
  defaultEmail?: string;
}

// Pre-configured Verified Personas for 1-Click Access and Testing
const DEMO_PERSONAS = [
  {
    id: 'user-lead-qc',
    name: 'Sarah Jenkins',
    email: 'qc.lead@apexvalves.com',
    role: 'REVIEWER',
    roleTitle: 'Lead QC Inspector',
    description: 'Full inspection authority, discrepancy overrides, and final release sign-off.',
    orgName: 'Apex Valve & Flow Engineering Ltd.',
    badgeColor: 'bg-emerald-950 text-emerald-300 border-emerald-700/60',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    password: 'password123',
  },
  {
    id: 'user-materials-engineer',
    name: 'Dr. Marcus Vance (PE)',
    email: 'materials.engineer@apexvalves.com',
    role: 'QUALITY_ENGINEER',
    roleTitle: 'Materials Engineer (PE)',
    description: 'Author client MDS specs, tune chemical & mechanical tolerances, and review test results.',
    orgName: 'Apex Valve & Flow Engineering Ltd.',
    badgeColor: 'bg-sky-950 text-sky-300 border-sky-700/60',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    password: 'password123',
  },
  {
    id: 'user-quality-auditor',
    name: 'Elena Rostova',
    email: 'auditor@apexvalves.com',
    role: 'REVIEWER',
    roleTitle: 'Quality Auditor',
    description: 'Review immutable audit trails, ISO 9001 compliance logs, and export sign-off reports.',
    orgName: 'Apex Valve & Flow Engineering Ltd.',
    badgeColor: 'bg-purple-950 text-purple-300 border-purple-700/60',
    avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
    password: 'password123',
  },
  {
    id: 'user-admin-system',
    name: 'David Chen',
    email: 'admin@apexvalves.com',
    role: 'ADMIN',
    roleTitle: 'System Administrator',
    description: 'Manage organization settings, security policies, and team member invitations.',
    orgName: 'Apex Valve & Flow Engineering Ltd.',
    badgeColor: 'bg-amber-950 text-amber-300 border-amber-700/60',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    password: 'password123',
  },
  {
    id: 'user-viewer-guest',
    name: 'Robert Miller',
    email: 'observer@clientaudit.com',
    role: 'VIEWER',
    roleTitle: 'Client QA Observer (Org B)',
    description: 'Isolated Organization B viewer. Cannot access Org A data (multi-tenant test).',
    orgName: 'Global Metallurgy & Inspection Corp',
    badgeColor: 'bg-slate-800 text-slate-300 border-slate-700',
    avatar: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=150&auto=format&fit=crop&q=80',
    password: 'password123',
  },
];

export const LoginPage: React.FC<LoginPageProps> = ({
  onLoginSuccess,
  defaultEmail = 'qc.lead@apexvalves.com',
}) => {
  const [activeTab, setActiveTab] = useState<'signin' | 'register' | 'quick_roles' | 'accept_invite'>('signin');

  // Sign-in Form State
  const [email, setEmail] = useState(() => {
    return localStorage.getItem('mtc_remembered_email') || defaultEmail;
  });
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Direct Registration Form State
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regRole, setRegRole] = useState<'QUALITY_ENGINEER' | 'REVIEWER' | 'ADMIN' | 'VIEWER'>('QUALITY_ENGINEER');
  const [regOrgName, setRegOrgName] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);

  // Accept Invite Form State
  const [inviteToken, setInviteToken] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [invitePassword, setInvitePassword] = useState('');
  const [inviteConfirmPassword, setInviteConfirmPassword] = useState('');
  const [showInvitePassword, setShowInvitePassword] = useState(false);

  // Forgot Password / Reset Password Modal State
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [resetStep, setResetStep] = useState<'request' | 'reset'>('request');
  const [modalMessage, setModalMessage] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showStandardsModal, setShowStandardsModal] = useState(false);

  // Check URL parameters for invitation tokens (e.g. ?invitation=xxx)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenParam = params.get('invitation') || params.get('token');
    if (tokenParam) {
      setInviteToken(tokenParam);
      setActiveTab('accept_invite');
    }
  }, []);

  // Handle Real Backend Sign In (POST /api/auth/login)
  const handleSignIn = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password;

    if (!cleanEmail) {
      setErrorMessage('Please enter your work email address.');
      return;
    }
    if (!cleanPassword) {
      setErrorMessage('Please enter your account password.');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, password: cleanPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        setIsSubmitting(false);
        setErrorMessage(data.error || 'Invalid email or password.');
        return;
      }

      if (rememberMe) {
        localStorage.setItem('mtc_remembered_email', cleanEmail);
      } else {
        localStorage.removeItem('mtc_remembered_email');
      }

      // Successful server authentication: HttpOnly cookie set by server
      onLoginSuccess(data.user, data.organization);
    } catch (err: any) {
      setIsSubmitting(false);
      setErrorMessage('Unable to connect to the authentication server. Please check your network connection.');
    }
  };

  // Handle 1-Click Demo Persona Sign-In via Real Backend API
  const handleSelectPersona = async (persona: typeof DEMO_PERSONAS[0]) => {
    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: persona.email, password: persona.password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setIsSubmitting(false);
        setErrorMessage(data.error || 'Failed to authenticate demo profile.');
        return;
      }

      localStorage.setItem('mtc_remembered_email', persona.email);
      onLoginSuccess(data.user, data.organization);
    } catch (err: any) {
      setIsSubmitting(false);
      setErrorMessage('Failed to connect to authentication server.');
    }
  };

  // Handle Real Backend Registration (POST /api/auth/register)
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanName = regName.trim();
    const cleanEmail = regEmail.trim().toLowerCase();

    if (!cleanName) {
      setErrorMessage('Please enter your full name.');
      return;
    }
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMessage('Please enter a valid work email address.');
      return;
    }
    if (!regPassword || regPassword.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setErrorMessage('Passwords do not match. Please verify.');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await apiFetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: cleanName,
          email: cleanEmail,
          password: regPassword,
          role: regRole,
          organizationName: regOrgName.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setIsSubmitting(false);
        setErrorMessage(data.error || 'Failed to create account.');
        return;
      }

      setSuccessMessage('Account created successfully! Launching your workstation...');
      setTimeout(() => {
        onLoginSuccess(data.user, data.organization);
      }, 400);
    } catch (err: any) {
      setIsSubmitting(false);
      setErrorMessage('Unable to connect to authentication server. Please check your connection.');
    }
  };

  // Handle Accept Invitation & Account Creation (POST /api/auth/accept-invite)
  const handleAcceptInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!inviteToken.trim()) {
      setErrorMessage('Invitation token is required.');
      return;
    }
    if (!inviteName.trim()) {
      setErrorMessage('Please enter your full name.');
      return;
    }
    if (!invitePassword || invitePassword.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }
    if (invitePassword !== inviteConfirmPassword) {
      setErrorMessage('Passwords do not match. Please verify.');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await apiFetch('/api/auth/accept-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: inviteToken.trim(),
          name: inviteName.trim(),
          password: invitePassword,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setIsSubmitting(false);
        setErrorMessage(data.error || 'Invalid or expired invitation token.');
        return;
      }

      setSuccessMessage('Account activated successfully! Launching your workspace...');
      setTimeout(() => {
        onLoginSuccess(data.user, data.organization);
      }, 350);
    } catch (err: any) {
      setIsSubmitting(false);
      setErrorMessage('Failed to activate invitation. Please try again.');
    }
  };

  // Handle Forgot Password Request (POST /api/auth/forgot-password)
  const handleRequestPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    setModalMessage(null);

    if (!forgotEmail.trim() || !forgotEmail.includes('@')) {
      setModalError('Please enter a valid work email address.');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await apiFetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail.trim().toLowerCase() }),
      });

      const data = await res.json();
      setIsSubmitting(false);

      if (data.resetToken) {
        // In local/development mode, auto-fill token for seamless testing
        setResetToken(data.resetToken);
        setResetStep('reset');
        setModalMessage('Password reset token generated. Set your new password below:');
      } else {
        setModalMessage(data.message || 'If an account exists, reset instructions have been generated.');
      }
    } catch (err) {
      setIsSubmitting(false);
      setModalError('Failed to process password reset request.');
    }
  };

  // Handle Password Reset Submission (POST /api/auth/reset-password)
  const handleCompletePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    setModalMessage(null);

    if (!resetToken.trim()) {
      setModalError('Password reset token is required.');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setModalError('Password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setModalError('Passwords do not match. Please verify.');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await apiFetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: resetToken.trim(), newPassword }),
      });

      const data = await res.json();
      setIsSubmitting(false);

      if (!res.ok) {
        setModalError(data.error || 'Failed to reset password.');
        return;
      }

      setModalMessage('Password updated successfully! You can now sign in.');
      setTimeout(() => {
        setShowForgotModal(false);
        setPassword('');
        setSuccessMessage('Password reset successfully. Please sign in with your new password.');
      }, 1200);
    } catch (err) {
      setIsSubmitting(false);
      setModalError('Failed to reset password. Please try again.');
    }
  };

  return (
    <DottedGlowBackground
      variant="dark"
      className="min-h-screen text-slate-100 flex flex-col justify-between antialiased selection:bg-emerald-500 selection:text-white"
    >
      {/* Top Header */}
      <header className="bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 sm:px-6 py-3.5 w-full sticky top-0 z-30">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          {/* Logo & Workstation Branding */}
          <div className="flex items-center space-x-2.5 sm:space-x-3 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-emerald-600 flex items-center justify-center text-white shadow-xs border border-emerald-400/50 shrink-0">
              <FileCheck2 className="w-5 h-5 stroke-[2.5]" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="font-bold text-xs sm:text-sm tracking-tight text-white flex items-center gap-2">
                <span className="truncate">MTC Compliance Checker</span>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 text-emerald-400 border border-slate-700 shrink-0">
                  EN 10204 3.1 &bull; MDS
                </span>
              </div>
              <div className="hidden sm:block text-[11px] text-slate-400 font-mono">
                Deterministic Metallurgical Quality Assurance Platform
              </div>
            </div>
          </div>

          {/* Header Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setShowStandardsModal(true)}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700/80 rounded-lg transition-colors cursor-pointer border border-slate-700"
            >
              <BookOpen className="w-3.5 h-3.5 text-blue-400" aria-hidden="true" />
              <span>Standards Spec</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('quick_roles')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-300 hover:text-white bg-emerald-950/70 hover:bg-emerald-900 rounded-lg transition-colors cursor-pointer border border-emerald-700/60 shadow-xs"
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
              <span>1-Click Demo Profiles</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Authentication Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8 sm:py-12 flex flex-col justify-center">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Platform Overview */}
          <div className="lg:col-span-5 space-y-6 pt-2">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-slate-800/90 text-emerald-400 border border-slate-700">
                <ShieldCheck className="w-4 h-4 text-emerald-400" aria-hidden="true" />
                <span>Enterprise Multi-Tenant Security</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-tight">
                Automated Metallurgical Compliance for Critical Engineering
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                Deterministic verification of Mill Test Certificates (EN 10204 3.1 &amp; 3.2) against client Material Data Sheets (MDS), ASME Section II, ASTM specifications, and ISO 15156 / NACE MR0175 sour service standards.
              </p>
            </div>

            {/* Feature Badges */}
            <div className="space-y-3 pt-2">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-900/80 border border-slate-800">
                <div className="w-7 h-7 rounded bg-emerald-950 border border-emerald-800 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
                  <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-200">Strict Tenant &amp; Role Isolation</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Server-enforced tenant boundaries prevent cross-organization data access with granular RBAC permissions.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-900/80 border border-slate-800">
                <div className="w-7 h-7 rounded bg-sky-950 border border-sky-800 flex items-center justify-center text-sky-400 shrink-0 mt-0.5">
                  <Shield className="w-4 h-4" aria-hidden="true" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-200">Immutable Audit Trail &amp; Sign-off</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Cryptographic SHA-256 document hashing with granular reviewer justification tracking and ISO 9001 gates.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-900/80 border border-slate-800">
                <div className="w-7 h-7 rounded bg-amber-950 border border-amber-800 flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
                  <Fingerprint className="w-4 h-4" aria-hidden="true" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-200">HttpOnly Server Session Security</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Cryptographic scrypt password hashing, sliding session expiration, and zero client-side credential exposure.
                  </p>
                </div>
              </div>
            </div>

            {/* Quick stats */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 text-center">
                <div className="text-base font-extrabold text-emerald-400 font-mono">100%</div>
                <div className="text-[10px] text-slate-400 font-medium">Deterministic</div>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 text-center">
                <div className="text-base font-extrabold text-sky-400 font-mono">EN 10204</div>
                <div className="text-[10px] text-slate-400 font-medium">3.1 &amp; 3.2 Standard</div>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 text-center">
                <div className="text-base font-extrabold text-amber-400 font-mono">ISO 9001</div>
                <div className="text-[10px] text-slate-400 font-medium">Audit Ready</div>
              </div>
            </div>
          </div>

          {/* Right Column: Authentication Card */}
          <div className="lg:col-span-7">
            <div className="bg-slate-900/95 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-800 overflow-hidden">
              {/* Tabs Bar */}
              <div className="flex items-center border-b border-slate-800 bg-slate-950/60 p-1.5 gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('signin');
                    setErrorMessage(null);
                    setSuccessMessage(null);
                  }}
                  className={`flex-1 py-2 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    activeTab === 'signin'
                      ? 'bg-slate-800 text-white shadow-xs border border-slate-700'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  <LogIn className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
                  <span className="truncate">Sign In</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('register');
                    setErrorMessage(null);
                    setSuccessMessage(null);
                  }}
                  className={`flex-1 py-2 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    activeTab === 'register'
                      ? 'bg-slate-800 text-white shadow-xs border border-slate-700'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  <UserPlus className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
                  <span className="truncate">Create Account</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('quick_roles');
                    setErrorMessage(null);
                    setSuccessMessage(null);
                  }}
                  className={`flex-1 py-2 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    activeTab === 'quick_roles'
                      ? 'bg-slate-800 text-white shadow-xs border border-slate-700'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  <Zap className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
                  <span className="truncate">Demo Roles</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('accept_invite');
                    setErrorMessage(null);
                    setSuccessMessage(null);
                  }}
                  className={`flex-1 py-2 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    activeTab === 'accept_invite'
                      ? 'bg-slate-800 text-white shadow-xs border border-slate-700'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  <KeyRound className="w-3.5 h-3.5 text-sky-400" aria-hidden="true" />
                  <span className="truncate">Token Invite</span>
                </button>
              </div>

              {/* Error Banner */}
              {errorMessage && (
                <div className="mx-6 mt-6 p-3.5 rounded-lg bg-rose-950/70 border border-rose-800 text-rose-200 text-xs flex items-center gap-2.5 shadow-sm">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" aria-hidden="true" />
                  <span className="font-medium">{errorMessage}</span>
                </div>
              )}

              {/* Success Banner */}
              {successMessage && (
                <div className="mx-6 mt-6 p-3.5 rounded-lg bg-emerald-950/70 border border-emerald-800 text-emerald-200 text-xs flex items-center gap-2.5 shadow-sm">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden="true" />
                  <span className="font-medium">{successMessage}</span>
                </div>
              )}

              {/* TAB 1: REAL BACKEND SIGN IN */}
              {activeTab === 'signin' && (
                <div className="p-6 sm:p-8 space-y-6">
                  <div className="space-y-1">
                    <h2 className="text-lg font-bold text-white tracking-tight">
                      Workstation Sign In
                    </h2>
                    <p className="text-xs text-slate-400">
                      Enter your corporate email and password to start an authenticated session.
                    </p>
                  </div>

                  <form onSubmit={handleSignIn} className="space-y-4">
                    {/* Work Email Field */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-slate-300">
                        Corporate Email <span className="text-emerald-400">*</span>
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                          <Mail className="w-4 h-4" aria-hidden="true" />
                        </div>
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={(e) => {
                            setEmail(e.target.value);
                            setErrorMessage(null);
                          }}
                          placeholder="e.g. qc.lead@apexvalves.com"
                          className="w-full pl-9 pr-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                        />
                      </div>
                    </div>

                    {/* Password Field */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-semibold text-slate-300">
                          Password <span className="text-emerald-400">*</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setForgotEmail(email);
                            setShowForgotModal(true);
                            setResetStep('request');
                            setModalError(null);
                            setModalMessage(null);
                          }}
                          className="text-[11px] text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer"
                        >
                          Forgot password?
                        </button>
                      </div>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                          <Lock className="w-4 h-4" aria-hidden="true" />
                        </div>
                        <input
                          type={showPassword ? 'text' : 'password'}
                          required
                          value={password}
                          onChange={(e) => {
                            setPassword(e.target.value);
                            setErrorMessage(null);
                          }}
                          placeholder="Enter your account password"
                          className="w-full pl-9 pr-10 py-2 text-xs bg-slate-950 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200 cursor-pointer"
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                        >
                          {showPassword ? (
                            <EyeOff className="w-4 h-4" aria-hidden="true" />
                          ) : (
                            <Eye className="w-4 h-4" aria-hidden="true" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Remember Me */}
                    <div className="flex items-center justify-between text-xs pt-1">
                      <label className="flex items-center gap-2 text-slate-300 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={rememberMe}
                          onChange={(e) => setRememberMe(e.target.checked)}
                          className="rounded bg-slate-950 border-slate-700 text-emerald-600 focus:ring-emerald-500 focus:ring-offset-slate-900"
                        />
                        <span>Remember email on this device</span>
                      </label>
                      <span className="text-[11px] text-slate-400 font-mono">
                        Secured with HttpOnly Cookie
                      </span>
                    </div>

                    {/* Submit Button */}
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-xs rounded-lg transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer border border-emerald-400/50 disabled:opacity-60"
                    >
                      {isSubmitting ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin text-white" aria-hidden="true" />
                          <span>Verifying Credentials &amp; Signing In...</span>
                        </>
                      ) : (
                        <>
                          <span>Sign In to Workstation</span>
                          <ArrowRight className="w-4 h-4 stroke-[2.5]" aria-hidden="true" />
                        </>
                      )}
                    </button>
                  </form>

                  {/* Direct Registration & 1-Click Demo Profiles Banner */}
                  <div className="space-y-2.5">
                    <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2.5 text-slate-300">
                        <UserPlus className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden="true" />
                        <span>Don't have an account or invitation token?</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('register');
                          setErrorMessage(null);
                        }}
                        className="text-emerald-400 hover:text-emerald-300 font-bold underline cursor-pointer text-xs shrink-0"
                      >
                        Create Account &rarr;
                      </button>
                    </div>

                    <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2.5 text-slate-300">
                        <Sparkles className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
                        <span>Testing roles or evaluating the platform?</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('quick_roles');
                          setErrorMessage(null);
                        }}
                        className="text-amber-400 hover:text-amber-300 font-bold underline cursor-pointer text-xs shrink-0"
                      >
                        1-Click Roles &rarr;
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 1.5: DIRECT SELF-REGISTRATION / CREATE ACCOUNT */}
              {activeTab === 'register' && (
                <div className="p-6 sm:p-8 space-y-6">
                  <div className="space-y-1">
                    <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                      <UserPlus className="w-5 h-5 text-emerald-400" aria-hidden="true" />
                      <span>Create Workstation Account</span>
                    </h2>
                    <p className="text-xs text-slate-400">
                      Create your verified user profile to access deterministic MTC compliance verification without needing an invitation token.
                    </p>
                  </div>

                  <form onSubmit={handleRegister} className="space-y-4">
                    {/* Full Name & Email */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div className="space-y-1.5">
                        <label className="block text-xs font-semibold text-slate-300">
                          Full Name <span className="text-emerald-400">*</span>
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                            <UserIcon className="w-4 h-4" aria-hidden="true" />
                          </div>
                          <input
                            type="text"
                            required
                            value={regName}
                            onChange={(e) => {
                              setRegName(e.target.value);
                              setErrorMessage(null);
                            }}
                            placeholder="e.g. Alex Morgan"
                            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-xs font-semibold text-slate-300">
                          Work Email <span className="text-emerald-400">*</span>
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                            <Mail className="w-4 h-4" aria-hidden="true" />
                          </div>
                          <input
                            type="email"
                            required
                            value={regEmail}
                            onChange={(e) => {
                              setRegEmail(e.target.value);
                              setErrorMessage(null);
                            }}
                            placeholder="e.g. alex@company.com"
                            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Organization & Role */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div className="space-y-1.5">
                        <label className="block text-xs font-semibold text-slate-300">
                          Company / Organization <span className="text-slate-500">(Optional)</span>
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                            <Building2 className="w-4 h-4" aria-hidden="true" />
                          </div>
                          <input
                            type="text"
                            value={regOrgName}
                            onChange={(e) => setRegOrgName(e.target.value)}
                            placeholder="Apex Valve & Flow Engineering Ltd."
                            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-xs font-semibold text-slate-300">
                          Primary Role <span className="text-emerald-400">*</span>
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                            <Briefcase className="w-4 h-4" aria-hidden="true" />
                          </div>
                          <select
                            value={regRole}
                            onChange={(e) => setRegRole(e.target.value as any)}
                            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer transition-all appearance-none"
                          >
                            <option value="QUALITY_ENGINEER">Quality Engineer (PE) — MDS Specs & Tolerances</option>
                            <option value="REVIEWER">Lead QC Inspector / Auditor — Sign-Off & Overrides</option>
                            <option value="ADMIN">System Administrator — Full Org & Security Admin</option>
                            <option value="VIEWER">Viewer / Observer — Read-Only Quality Reports</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Password & Confirm Password */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div className="space-y-1.5">
                        <label className="block text-xs font-semibold text-slate-300">
                          Password <span className="text-emerald-400">*</span>
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                            <Lock className="w-4 h-4" aria-hidden="true" />
                          </div>
                          <input
                            type={showRegPassword ? 'text' : 'password'}
                            required
                            value={regPassword}
                            onChange={(e) => {
                              setRegPassword(e.target.value);
                              setErrorMessage(null);
                            }}
                            placeholder="Min 6 characters"
                            className="w-full pl-9 pr-10 py-2 text-xs bg-slate-950 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                          />
                          <button
                            type="button"
                            onClick={() => setShowRegPassword(!showRegPassword)}
                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200 cursor-pointer"
                            aria-label={showRegPassword ? 'Hide password' : 'Show password'}
                          >
                            {showRegPassword ? (
                              <EyeOff className="w-4 h-4" aria-hidden="true" />
                            ) : (
                              <Eye className="w-4 h-4" aria-hidden="true" />
                            )}
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-xs font-semibold text-slate-300">
                          Confirm Password <span className="text-emerald-400">*</span>
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                            <Lock className="w-4 h-4" aria-hidden="true" />
                          </div>
                          <input
                            type={showRegPassword ? 'text' : 'password'}
                            required
                            value={regConfirmPassword}
                            onChange={(e) => {
                              setRegConfirmPassword(e.target.value);
                              setErrorMessage(null);
                            }}
                            placeholder="Re-enter password"
                            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Submit Button */}
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-xs rounded-lg transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer border border-emerald-400/50 disabled:opacity-60 mt-2"
                    >
                      {isSubmitting ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin text-white" aria-hidden="true" />
                          <span>Creating Account & Initializing Workstation...</span>
                        </>
                      ) : (
                        <>
                          <UserPlus className="w-4 h-4" aria-hidden="true" />
                          <span>Create Account & Enter Workstation</span>
                        </>
                      )}
                    </button>

                    {/* Navigation helper */}
                    <div className="pt-2 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 border-t border-slate-800 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('signin');
                          setErrorMessage(null);
                        }}
                        className="text-slate-300 hover:text-white cursor-pointer transition-colors"
                      >
                        Already have an account? <span className="text-emerald-400 font-bold">Sign In</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('accept_invite');
                          setErrorMessage(null);
                        }}
                        className="text-slate-400 hover:text-sky-300 cursor-pointer transition-colors"
                      >
                        Have an invite token? <span className="text-sky-400 font-bold">Token Invite</span>
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* TAB 2: QUICK DEMO ROLES (REAL BACKEND AUTHENTICATION) */}
              {activeTab === 'quick_roles' && (
                <div className="p-6 sm:p-8 space-y-4">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                        <Zap className="w-4 h-4 text-amber-400" aria-hidden="true" />
                        <span>1-Click Authenticated Personas</span>
                      </h2>
                      <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/70 border border-emerald-800 px-2 py-0.5 rounded">
                        Real Backend Session
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">
                      Select any predefined enterprise persona to authenticate via real backend session and evaluate role-based permissions.
                    </p>
                  </div>

                  {/* Persona Cards */}
                  <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
                    {DEMO_PERSONAS.map((persona) => (
                      <div
                        key={persona.id}
                        className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 hover:border-slate-700 hover:bg-slate-900/90 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <img
                            src={persona.avatar}
                            alt={persona.name}
                            className="w-10 h-10 rounded-full object-cover border border-slate-700 shrink-0 mt-0.5"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold text-white group-hover:text-emerald-300 transition-colors">
                                {persona.name}
                              </span>
                              <span
                                className={`text-[10px] font-mono font-bold px-2 py-0.2 rounded border ${persona.badgeColor}`}
                              >
                                {persona.roleTitle}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono mt-0.5 truncate">
                              {persona.email} &bull; <span className="text-slate-400">{persona.orgName}</span>
                            </div>
                            <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                              {persona.description}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          disabled={isSubmitting}
                          onClick={() => handleSelectPersona(persona)}
                          className="shrink-0 self-end sm:self-center px-3.5 py-2 text-xs font-bold text-slate-200 bg-slate-800 hover:bg-emerald-600 hover:text-white border border-slate-700 hover:border-emerald-500 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                        >
                          <span>Sign in as {persona.roleTitle.split(' ')[0]}</span>
                          <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2 flex items-center justify-between text-xs text-slate-500 font-mono border-t border-slate-800">
                    <span>Multi-Tenant &amp; RBAC Active</span>
                    <button
                      type="button"
                      onClick={() => setActiveTab('signin')}
                      className="text-slate-400 hover:text-slate-200 cursor-pointer underline"
                    >
                      Return to password login
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 3: ACCEPT INVITATION / ONBOARDING */}
              {activeTab === 'accept_invite' && (
                <div className="p-6 sm:p-8 space-y-6">
                  <div className="space-y-1">
                    <h2 className="text-lg font-bold text-white tracking-tight">
                      Accept Administrator Invitation
                    </h2>
                    <p className="text-xs text-slate-400">
                      Company users are invited by organization administrators. Enter your invitation token and create your password below.
                    </p>
                  </div>

                  <form onSubmit={handleAcceptInvite} className="space-y-4">
                    {/* Invitation Token Field */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-slate-300">
                        Invitation Token <span className="text-emerald-400">*</span>
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                          <KeyRound className="w-4 h-4" aria-hidden="true" />
                        </div>
                        <input
                          type="text"
                          required
                          value={inviteToken}
                          onChange={(e) => setInviteToken(e.target.value)}
                          placeholder="Paste 64-character invitation token from admin"
                          className="w-full pl-9 pr-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-lg text-white font-mono placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                    </div>

                    {/* Full Name */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-slate-300">
                        Your Full Name <span className="text-emerald-400">*</span>
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                          <UserIcon className="w-4 h-4" aria-hidden="true" />
                        </div>
                        <input
                          type="text"
                          required
                          value={inviteName}
                          onChange={(e) => setInviteName(e.target.value)}
                          placeholder="e.g. Alex Morgan"
                          className="w-full pl-9 pr-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Password */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-semibold text-slate-300">
                          Create Password <span className="text-emerald-400">*</span>
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                            <Lock className="w-4 h-4" aria-hidden="true" />
                          </div>
                          <input
                            type={showInvitePassword ? 'text' : 'password'}
                            required
                            value={invitePassword}
                            onChange={(e) => setInvitePassword(e.target.value)}
                            placeholder="Min 6 characters"
                            className="w-full pl-9 pr-10 py-2 text-xs bg-slate-950 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                          <button
                            type="button"
                            onClick={() => setShowInvitePassword(!showInvitePassword)}
                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200 cursor-pointer"
                          >
                            {showInvitePassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      {/* Confirm Password */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-semibold text-slate-300">
                          Confirm Password <span className="text-emerald-400">*</span>
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                            <Lock className="w-4 h-4" aria-hidden="true" />
                          </div>
                          <input
                            type={showInvitePassword ? 'text' : 'password'}
                            required
                            value={inviteConfirmPassword}
                            onChange={(e) => setInviteConfirmPassword(e.target.value)}
                            placeholder="Repeat password"
                            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="pt-2">
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full py-2.5 px-4 bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white font-bold text-xs rounded-lg transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer border border-sky-400/50 disabled:opacity-60"
                      >
                        {isSubmitting ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin text-white" aria-hidden="true" />
                            <span>Activating Account &amp; Signing In...</span>
                          </>
                        ) : (
                          <>
                            <UserPlus className="w-4 h-4" aria-hidden="true" />
                            <span>Activate Account &amp; Enter Workstation</span>
                          </>
                        )}
                      </button>
                    </div>

                    <div className="pt-2 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 border-t border-slate-800 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('register');
                          setErrorMessage(null);
                        }}
                        className="text-slate-300 hover:text-white cursor-pointer transition-colors"
                      >
                        Don't have a token? <span className="text-emerald-400 font-bold">Create Account</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('signin');
                          setErrorMessage(null);
                        }}
                        className="text-slate-400 hover:text-white cursor-pointer transition-colors"
                      >
                        Already have credentials? <span className="text-emerald-400 font-bold">Sign In</span>
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Forgot Password / Reset Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 text-slate-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <KeyRound className="w-4 h-4 text-amber-400" aria-hidden="true" />
                <span>Password Recovery Portal</span>
              </div>
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            {modalError && (
              <div className="p-3 rounded-lg bg-rose-950/70 border border-rose-800 text-rose-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            {modalMessage && (
              <div className="p-3 rounded-lg bg-emerald-950/70 border border-emerald-800 text-emerald-200 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{modalMessage}</span>
              </div>
            )}

            {resetStep === 'request' ? (
              <form onSubmit={handleRequestPasswordReset} className="space-y-4">
                <p className="text-xs text-slate-400">
                  Enter your registered work email to receive a secure single-use password reset token.
                </p>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-300">Work Email Address</label>
                  <input
                    type="email"
                    required
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="e.g. qc.lead@apexvalves.com"
                    className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => setResetStep('reset')}
                    className="text-xs text-slate-400 hover:text-white underline cursor-pointer"
                  >
                    Already have a reset token?
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
                  >
                    {isSubmitting ? 'Generating...' : 'Request Token'}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleCompletePasswordReset} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-300">Reset Token</label>
                  <input
                    type="text"
                    required
                    value={resetToken}
                    onChange={(e) => setResetToken(e.target.value)}
                    placeholder="Enter 64-character token"
                    className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-lg text-white font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-300">New Password (min 6 characters)</label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-300">Confirm New Password</label>
                  <input
                    type="password"
                    required
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    placeholder="Repeat new password"
                    className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => setResetStep('request')}
                    className="text-xs text-slate-400 hover:text-white underline cursor-pointer"
                  >
                    &larr; Back to Email
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
                  >
                    {isSubmitting ? 'Updating...' : 'Update Password'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Standards Spec Modal */}
      {showStandardsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl max-w-2xl w-full p-6 space-y-4 text-slate-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <BookOpen className="w-4 h-4 text-blue-400" aria-hidden="true" />
                <span>Metallurgical Quality Standards Reference</span>
              </div>
              <button
                type="button"
                onClick={() => setShowStandardsModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <div className="space-y-3 text-xs leading-relaxed max-h-[60vh] overflow-y-auto pr-2">
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-1">
                <h4 className="font-bold text-emerald-400 font-mono">EN 10204 (Inspection Documents for Metallic Products)</h4>
                <p className="text-slate-300">
                  Defines Type 2.1 (Declaration of Compliance), Type 2.2 (Test Report), Type 3.1 (Inspection Certificate validated by manufacturer&apos;s authorized inspection representative), and Type 3.2 (Jointly validated by independent third-party/purchaser inspector).
                </p>
              </div>

              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-1">
                <h4 className="font-bold text-sky-400 font-mono">Carbon Equivalent (CE &amp; CE_NKK) Formulations</h4>
                <p className="text-slate-300">
                  <span className="font-mono text-slate-200">IIW formula: CE = C + Mn/6 + (Cr+Mo+V)/5 + (Ni+Cu)/15</span>. Used to evaluate weldability and mitigate hydrogen-induced cold cracking in carbon steels.
                </p>
              </div>

              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-1">
                <h4 className="font-bold text-amber-400 font-mono">ISO 15156 / NACE MR0175 (Sour Service Compliance)</h4>
                <p className="text-slate-300">
                  Mandates strict maximum hardness thresholds (e.g. &le; 22 HRC / 250 HV) for materials exposed to H2S-containing sour environments in oil and gas production to prevent sulfide stress cracking.
                </p>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowStandardsModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
              >
                Close Reference
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-slate-900/90 border-t border-slate-800 py-3.5 px-6 text-center text-xs text-slate-500 font-mono">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-500" aria-hidden="true" />
            <span>&copy; 2026 MTC Compliance Checker &bull; Deterministic Metallurgical Verification Suite</span>
          </div>
          <div className="flex items-center gap-3 text-slate-400">
            <span>EN 10204 3.1 &amp; 3.2</span>
            <span>&bull;</span>
            <span>ASTM / ASME SEC II</span>
            <span>&bull;</span>
            <span>ISO 15156 NACE</span>
          </div>
        </div>
      </footer>
    </DottedGlowBackground>
  );
};
