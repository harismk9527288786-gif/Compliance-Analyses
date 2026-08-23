/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { Dashboard } from './components/Dashboard';
import { AnalysisView } from './components/AnalysisView';
import { NewComparison } from './components/NewComparison';
import { FindingDetailDrawer } from './components/FindingDetailDrawer';
import { ReportModal } from './components/ReportModal';
import { RequirementLibrary } from './components/RequirementLibrary';
import { AuditLogView } from './components/AuditLogView';
import { HistoryView } from './components/HistoryView';
import { TestSuiteModal } from './components/TestSuiteModal';
import { AdminUsersModal } from './components/AdminUsersModal';
import { DataRetentionModal } from './components/DataRetentionModal';
import { LoginPage } from './components/LoginPage';
import { FramerToast, ToastMessage } from './components/framer/FramerToast';
import {
  User,
  Organization,
  AnalysisRecord,
  ComplianceFinding,
  RequirementSet,
  ExternalFeedbackDraft,
  AuditEvent,
  FindingStatus,
} from './types';
import { apiFetch } from './utils/api';
import { DottedGlowBackground } from './components/DottedGlowBackground';
import { FileCheck2, RefreshCw } from 'lucide-react';

export default function App() {
  const [isAuthChecking, setIsAuthChecking] = useState<boolean>(true);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [users, setUsers] = useState<User[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (toast: ToastMessage) => {
    setToasts((prev) => [...prev, toast]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== toast.id));
    }, 4500);
  };

  const handleDismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const [currentUser, setCurrentUser] = useState<User>({
    id: 'user-lead-qc',
    name: 'Sarah Jenkins',
    email: 'qc.lead@apexvalves.com',
    role: 'REVIEWER',
    organizationId: 'org-apex-01',
    organizationName: 'Apex Valve & Flow Engineering Ltd.',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
  });

  const [currentOrg, setCurrentOrg] = useState<Organization>({
    id: 'org-apex-01',
    name: 'Apex Valve & Flow Engineering Ltd.',
    code: 'APEX-VALVES',
    tier: 'Enterprise Quality Suite',
    requireMfa: true,
    allowExternalAi: true,
    retentionMonths: 24,
  });

  const [analyses, setAnalyses] = useState<AnalysisRecord[]>([]);
  const [requirementSets, setRequirementSets] = useState<RequirementSet[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditEvent[]>([]);

  // Selected state for active analysis & modals
  const [selectedAnalysisId, setSelectedAnalysisId] = useState<string | null>(null);
  const [selectedAnalysis, setSelectedAnalysis] = useState<AnalysisRecord | null>(null);
  const [activeFindings, setActiveFindings] = useState<ComplianceFinding[]>([]);
  const [activeFeedbackDraft, setActiveFeedbackDraft] = useState<ExternalFeedbackDraft | undefined>(undefined);

  const [inspectingFinding, setInspectingFinding] = useState<ComplianceFinding | null>(null);
  const [showNewComparison, setShowNewComparison] = useState(false);
  const [preselectedReqSetId, setPreselectedReqSetId] = useState<string | undefined>(undefined);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showTestSuiteModal, setShowTestSuiteModal] = useState(false);
  const [showAdminUsersModal, setShowAdminUsersModal] = useState(false);
  const [showRetentionModal, setShowRetentionModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Check authenticated server session on initial mount
  const checkAuthStatus = async () => {
    try {
      setIsAuthChecking(true);
      const res = await apiFetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          setCurrentUser({
            id: data.user.id,
            name: data.user.name,
            email: data.user.email,
            role: data.user.role,
            organizationId: data.user.organization_id,
            organizationName: data.user.organizationName,
            avatar: data.user.avatar,
            lastLoginAt: data.user.last_login_at,
            permissions: data.permissions,
          });
        }
        if (data.organization) {
          setCurrentOrg(data.organization);
        }
        setIsAuthenticated(true);
        fetchInitialData();
      } else {
        setIsAuthenticated(false);
      }
    } catch (e) {
      console.error('Session check failed:', e);
      setIsAuthenticated(false);
    } finally {
      setIsAuthChecking(false);
    }
  };

  // Fetch initial data from backend API for authenticated tenant
  const fetchInitialData = async () => {
    try {
      setIsLoading(true);
      // Fetch users
      const usersRes = await apiFetch('/api/users');
      if (usersRes.ok) {
        const data = await usersRes.json();
        setUsers(data.users || []);
        if (data.organizations && data.organizations[0]) {
          setCurrentOrg(data.organizations[0]);
        }
      }

      // Fetch analyses
      const analysesRes = await apiFetch('/api/analyses');
      if (analysesRes.ok) {
        const data = await analysesRes.json();
        setAnalyses(data.analyses || []);
      }

      // Fetch requirement sets
      const reqRes = await apiFetch('/api/requirements');
      if (reqRes.ok) {
        const data = await reqRes.json();
        setRequirementSets(data.requirementSets || []);
      }

      // Fetch audit logs
      const auditRes = await apiFetch('/api/audit');
      if (auditRes.ok) {
        const data = await auditRes.json();
        setAuditLogs(data.auditLogs || []);
      }
    } catch (e) {
      console.error('Failed to load initial data:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkAuthStatus();
  }, []);

  // Fetch analysis details when selectedAnalysisId changes
  useEffect(() => {
    if (!selectedAnalysisId) {
      setSelectedAnalysis(null);
      setActiveFindings([]);
      setActiveFeedbackDraft(undefined);
      return;
    }

    const loadAnalysis = async () => {
      try {
        const res = await apiFetch(`/api/analyses/${selectedAnalysisId}`);
        if (res.ok) {
          const data = await res.json();
          setSelectedAnalysis(data.analysis);
          setActiveFindings(data.findings || []);
          setActiveFeedbackDraft(data.feedback);
        } else if (res.status === 401) {
          setIsAuthenticated(false);
        }
      } catch (e) {
        console.error('Failed to load analysis:', e);
      }
    };

    loadAnalysis();
  }, [selectedAnalysisId]);

  const [findingStatusTab, setFindingStatusTab] = useState<'all' | 'issues' | 'pass'>('all');

  // Handler to select and view an analysis
  const handleSelectAnalysis = (id: string, initialTab: 'all' | 'issues' | 'pass' = 'all') => {
    setSelectedAnalysisId(id);
    setFindingStatusTab(initialTab);
    setActiveTab('analysis_detail');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 1-Click Launch Benchmark Pilot Case
  const handleLoadPilotCase = async () => {
    try {
      const pilot = analyses.find((a) => a.id.includes('pilot') || a.mtcNumber === 'WW2606229-3');
      if (pilot) {
        handleSelectAnalysis(pilot.id);
      } else {
        const res = await apiFetch('/api/pilot-case', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        if (res.ok) {
          const data = await res.json();
          setAnalyses((prev) => [data.analysis, ...prev]);
          const reqRes = await apiFetch('/api/requirements');
          if (reqRes.ok) {
            const reqData = await reqRes.json();
            setRequirementSets(reqData.requirementSets || []);
          }
          handleSelectAnalysis(data.analysis.id);
        }
      }
    } catch (e) {
      console.error('Failed to load pilot test case:', e);
    }
  };

  // Load Standard Spec Templates into Library
  const handleLoadStandardTemplates = async () => {
    try {
      const res = await apiFetch('/api/requirements/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        setRequirementSets(data.requirementSets || []);
        const auditRes = await apiFetch('/api/audit');
        if (auditRes.ok) {
          const auditData = await auditRes.json();
          setAuditLogs(auditData.auditLogs || []);
        }
      }
    } catch (e) {
      console.error('Failed to load standard templates:', e);
    }
  };

  // Reviewer Finding Update (Status Override / Justification)
  const handleUpdateFinding = async (
    findingId: string,
    updates: {
      status?: FindingStatus;
      reviewerDecision?: string;
      overrideReason?: string;
      reviewerComment?: string;
    }
  ) => {
    if (!selectedAnalysisId) return;

    try {
      const res = await apiFetch(`/api/findings/${findingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysisId: selectedAnalysisId,
          ...updates,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setActiveFindings((prev) =>
          prev.map((f) => (f.id === findingId ? data.finding : f))
        );
        if (inspectingFinding && inspectingFinding.id === findingId) {
          setInspectingFinding(data.finding);
        }
        if (data.analysis) {
          setSelectedAnalysis(data.analysis);
          setAnalyses((prev) =>
            prev.map((a) => (a.id === data.analysis.id ? data.analysis : a))
          );
        }
        const auditRes = await apiFetch('/api/audit');
        if (auditRes.ok) {
          const auditData = await auditRes.json();
          setAuditLogs(auditData.auditLogs || []);
        }
      }
    } catch (e) {
      console.error('Failed to update finding:', e);
    }
  };

  // Approve Analysis Gate
  const handleApproveAnalysis = async (analysisId: string, notes: string) => {
    try {
      const res = await apiFetch(`/api/analyses/${analysisId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approvalNotes: notes,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedAnalysis(data.analysis);
        setAnalyses((prev) =>
          prev.map((a) => (a.id === analysisId ? data.analysis : a))
        );
        const auditRes = await apiFetch('/api/audit');
        if (auditRes.ok) {
          const auditData = await auditRes.json();
          setAuditLogs(auditData.auditLogs || []);
        }
      }
    } catch (e) {
      console.error('Failed to approve analysis:', e);
    }
  };

  // Reject Analysis Gate
  const handleRejectAnalysis = async (analysisId: string, reason: string) => {
    try {
      const res = await apiFetch(`/api/analyses/${analysisId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedAnalysis(data.analysis);
        setAnalyses((prev) =>
          prev.map((a) => (a.id === analysisId ? data.analysis : a))
        );
        const auditRes = await apiFetch('/api/audit');
        if (auditRes.ok) {
          const auditData = await auditRes.json();
          setAuditLogs(auditData.auditLogs || []);
        }
      }
    } catch (e) {
      console.error('Failed to reject analysis:', e);
    }
  };

  // Delete single analysis
  const handleDeleteAnalysis = async (id: string) => {
    try {
      const res = await apiFetch(`/api/analyses/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setAnalyses((prev) => prev.filter((a) => a.id !== id));
        if (selectedAnalysisId === id) {
          setSelectedAnalysisId(null);
          setSelectedAnalysis(null);
          setActiveFindings([]);
          setActiveFeedbackDraft(undefined);
          setActiveTab('dashboard');
        }
        addToast({
          id: `toast-${Date.now()}`,
          type: 'success',
          title: 'Verification Record Deleted',
          description: 'The MTC analysis record was permanently removed.',
        });
        const auditRes = await apiFetch('/api/audit');
        if (auditRes.ok) {
          const auditData = await auditRes.json();
          setAuditLogs(auditData.auditLogs || []);
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        addToast({
          id: `toast-${Date.now()}`,
          type: 'error',
          title: 'Failed to Delete Record',
          description: errData.error || 'Server rejected the deletion request.',
        });
      }
    } catch (e) {
      console.error('Failed to delete analysis:', e);
      addToast({
        id: `toast-${Date.now()}`,
        type: 'error',
        title: 'Connection Error',
        description: 'Failed to communicate with the server.',
      });
    }
  };

  // Clear all analyses
  const handleClearAllAnalyses = async () => {
    try {
      const res = await apiFetch('/api/analyses/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        setAnalyses([]);
        setSelectedAnalysisId(null);
        setSelectedAnalysis(null);
        setActiveFindings([]);
        setActiveFeedbackDraft(undefined);
        if (activeTab === 'analysis_detail') {
          setActiveTab('dashboard');
        }
        addToast({
          id: `toast-${Date.now()}`,
          type: 'success',
          title: 'All Analyses Cleared',
          description: 'All compliance records have been cleared from this organization.',
        });
        const auditRes = await apiFetch('/api/audit');
        if (auditRes.ok) {
          const auditData = await auditRes.json();
          setAuditLogs(auditData.auditLogs || []);
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        addToast({
          id: `toast-${Date.now()}`,
          type: 'error',
          title: 'Failed to Clear Analyses',
          description: errData.error || 'Server rejected the clear request.',
        });
      }
    } catch (e) {
      console.error('Failed to clear analyses:', e);
      addToast({
        id: `toast-${Date.now()}`,
        type: 'error',
        title: 'Connection Error',
        description: 'Failed to communicate with the server.',
      });
    }
  };

  // Save Feedback Draft
  const handleSaveFeedbackDraft = async (draft: ExternalFeedbackDraft) => {
    if (!selectedAnalysisId) return;
    try {
      const res = await apiFetch(`/api/feedback/${selectedAnalysisId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feedback: draft,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setActiveFeedbackDraft(data.feedback);
        addToast({
          id: `toast-${Date.now()}`,
          type: 'success',
          title: 'Feedback Draft Saved',
          description: 'Supplier clarification points updated successfully.',
        });
      } else {
        const errData = await res.json().catch(() => ({}));
        addToast({
          id: `toast-${Date.now()}`,
          type: 'error',
          title: 'Failed to Save Draft',
          description: errData.error || 'Permission error saving feedback draft.',
        });
      }
    } catch (e) {
      console.error('Failed to save feedback draft:', e);
    }
  };

  // Create Requirement Set
  const handleCreateRequirementSet = async (newSetData: Partial<RequirementSet>) => {
    try {
      const res = await apiFetch('/api/requirements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSetData),
      });
      if (res.ok) {
        const data = await res.json();
        setRequirementSets((prev) => [data.requirementSet, ...prev]);
        addToast({
          id: `toast-${Date.now()}`,
          type: 'success',
          title: 'Specification Created',
          description: `Specification ${data.requirementSet.title} added to library.`,
        });
      }
    } catch (e) {
      console.error('Failed to create requirement set:', e);
    }
  };

  // Delete single requirement set
  const handleDeleteRequirementSet = async (id: string) => {
    try {
      const res = await apiFetch(`/api/requirements/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setRequirementSets((prev) => prev.filter((r) => r.id !== id));
        addToast({
          id: `toast-${Date.now()}`,
          type: 'success',
          title: 'Specification Deleted',
          description: 'The requirement specification was removed from library.',
        });
        const auditRes = await apiFetch('/api/audit');
        if (auditRes.ok) {
          const auditData = await auditRes.json();
          setAuditLogs(auditData.auditLogs || []);
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        addToast({
          id: `toast-${Date.now()}`,
          type: 'error',
          title: 'Failed to Delete Specification',
          description: errData.error || 'Server rejected the deletion request.',
        });
      }
    } catch (e) {
      console.error('Failed to delete requirement set:', e);
    }
  };

  // Clear all requirement sets
  const handleClearAllRequirementSets = async () => {
    try {
      const res = await apiFetch('/api/requirements/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        setRequirementSets([]);
        addToast({
          id: `toast-${Date.now()}`,
          type: 'success',
          title: 'Library Cleared',
          description: 'All requirement specifications have been cleared.',
        });
        const auditRes = await apiFetch('/api/audit');
        if (auditRes.ok) {
          const auditData = await auditRes.json();
          setAuditLogs(auditData.auditLogs || []);
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        addToast({
          id: `toast-${Date.now()}`,
          type: 'error',
          title: 'Failed to Clear Library',
          description: errData.error || 'Server rejected the clear request.',
        });
      }
    } catch (e) {
      console.error('Failed to clear requirement sets:', e);
    }
  };

  // Real Server Logout
  const handleLogout = async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {}
    setIsAuthenticated(false);
    setSelectedAnalysisId(null);
    setSelectedAnalysis(null);
    setActiveFindings([]);
    setActiveFeedbackDraft(undefined);
  };

  // Initial Auth Loading Screen
  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-100 space-y-3 antialiased">
        <div className="w-12 h-12 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-lg border border-emerald-400/40 animate-pulse">
          <FileCheck2 className="w-7 h-7 stroke-[2.5]" />
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
          <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
          <span>Authenticating workstation session...</span>
        </div>
      </div>
    );
  }

  // Render Login Page when unauthenticated
  if (!isAuthenticated) {
    return (
      <LoginPage
        defaultEmail=""
        onLoginSuccess={(user, org) => {
          setCurrentUser(user);
          if (org) setCurrentOrg(org);
          setIsAuthenticated(true);
          fetchInitialData();
        }}
      />
    );
  }

  return (
    <DottedGlowBackground className="min-h-screen text-slate-900 font-sans flex flex-col antialiased">
      {/* Top Application Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab);
          if (tab === 'dashboard') setSelectedAnalysisId(null);
        }}
        currentUser={currentUser}
        currentOrg={currentOrg}
        onOpenNewComparison={() => {
          setPreselectedReqSetId(undefined);
          setShowNewComparison(true);
        }}
        onOpenTestSuite={() => setShowTestSuiteModal(true)}
        onOpenAdminUsers={() => setShowAdminUsersModal(true)}
        onOpenRetentionPolicy={() => setShowRetentionModal(true)}
        onLogout={handleLogout}
      />

      {/* Main Page Container */}
      <main className="flex-1 max-w-7xl w-full max-w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 min-w-0 overflow-x-hidden">
        {showNewComparison ? (
          <NewComparison
            requirementSets={requirementSets}
            currentUser={currentUser}
            initialRequirementSetId={preselectedReqSetId}
            onAnalysisCreated={(newId) => {
              setShowNewComparison(false);
              setPreselectedReqSetId(undefined);
              fetchInitialData();
              handleSelectAnalysis(newId);
            }}
            onCancel={() => {
              setShowNewComparison(false);
              setPreselectedReqSetId(undefined);
            }}
          />
        ) : activeTab === 'analysis_detail' && selectedAnalysis ? (
          <AnalysisView
            analysis={selectedAnalysis}
            findings={activeFindings}
            feedbackDraft={activeFeedbackDraft}
            currentUser={currentUser}
            initialStatusTab={findingStatusTab}
            onBack={() => {
              setSelectedAnalysisId(null);
              setActiveTab('dashboard');
            }}
            onSelectFinding={setInspectingFinding}
            onOpenReportModal={() => setShowReportModal(true)}
            onApproveAnalysis={handleApproveAnalysis}
            onRejectAnalysis={handleRejectAnalysis}
            onDeleteAnalysis={handleDeleteAnalysis}
          />
        ) : activeTab === 'library' ? (
          <RequirementLibrary
            requirementSets={requirementSets}
            currentUser={currentUser}
            onSelectSetForComparison={(setId) => {
              setPreselectedReqSetId(setId);
              setShowNewComparison(true);
            }}
            onCreateRequirementSet={handleCreateRequirementSet}
            onDeleteRequirementSet={handleDeleteRequirementSet}
            onClearAllRequirementSets={handleClearAllRequirementSets}
            onLoadStandardTemplates={handleLoadStandardTemplates}
          />
        ) : activeTab === 'audit' ? (
          <AuditLogView auditLogs={auditLogs} />
        ) : activeTab === 'history' ? (
          <HistoryView
            analyses={analyses}
            requirementSets={requirementSets}
            currentUser={currentUser}
            onSelectAnalysis={handleSelectAnalysis}
            onOpenNewComparison={() => {
              setPreselectedReqSetId(undefined);
              setShowNewComparison(true);
            }}
            onClearAllAnalyses={handleClearAllAnalyses}
            onDeleteAnalysis={handleDeleteAnalysis}
          />
        ) : (
          /* Default Dashboard View */
          <Dashboard
            analyses={analyses}
            requirementSets={requirementSets}
            currentUser={currentUser}
            onSelectAnalysis={handleSelectAnalysis}
            onOpenNewComparison={() => {
              setPreselectedReqSetId(undefined);
              setShowNewComparison(true);
            }}
            onLoadPilotCase={handleLoadPilotCase}
            onOpenTestSuite={() => setShowTestSuiteModal(true)}
            onOpenLibrary={() => setActiveTab('library')}
            onOpenRetentionPolicy={() => setShowRetentionModal(true)}
            onClearAllAnalyses={handleClearAllAnalyses}
            onDeleteAnalysis={handleDeleteAnalysis}
          />
        )}
      </main>

      {/* Slide-over Finding Detail Drawer */}
      {inspectingFinding && (
        <FindingDetailDrawer
          finding={inspectingFinding}
          currentUser={currentUser}
          onClose={() => setInspectingFinding(null)}
          onUpdateFinding={handleUpdateFinding}
        />
      )}

      {/* Internal Technical Report & External Feedback Modal */}
      {showReportModal && selectedAnalysis && (
        <ReportModal
          analysis={selectedAnalysis}
          findings={activeFindings}
          feedbackDraft={activeFeedbackDraft}
          currentUser={currentUser}
          onClose={() => setShowReportModal(false)}
          onSaveFeedbackDraft={handleSaveFeedbackDraft}
        />
      )}

      {/* Automated Verification Suite Modal */}
      {showTestSuiteModal && (
        <TestSuiteModal onClose={() => setShowTestSuiteModal(false)} />
      )}

      {/* Admin User Management & Invitations Modal */}
      {showAdminUsersModal && (
        <AdminUsersModal
          currentUser={currentUser}
          onClose={() => setShowAdminUsersModal(false)}
        />
      )}

      {/* 30-Day Data Retention Policy Modal */}
      {showRetentionModal && (
        <DataRetentionModal
          currentOrg={currentOrg}
          totalAnalysesCount={analyses.length}
          onClose={() => setShowRetentionModal(false)}
        />
      )}

      {/* Toast Notifications */}
      <FramerToast toasts={toasts} onDismiss={handleDismissToast} />
    </DottedGlowBackground>
  );
}
