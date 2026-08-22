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
import { LoginPage } from './components/LoginPage';
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
import { PILOT_MDS_REQUIREMENT_SET } from './engine/pilotData';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('mtc_auth_logged_out') !== 'true';
  });
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User>(() => {
    const saved = localStorage.getItem('mtc_auth_user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return {
      id: 'user-zarique-shaikh',
      name: 'Zarique Shaikh',
      email: 'zariquekhan@gmail.com',
      role: 'qc_reviewer',
      organizationId: 'org-apex-01',
      organizationName: 'Apex Valve & Flow Engineering Ltd.',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    };
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
  const [requirementSets, setRequirementSets] = useState<RequirementSet[]>([PILOT_MDS_REQUIREMENT_SET]);
  const [auditLogs, setAuditLogs] = useState<AuditEvent[]>([]);

  // Selected state for active analysis & modals
  const [selectedAnalysisId, setSelectedAnalysisId] = useState<string | null>(null);
  const [selectedAnalysis, setSelectedAnalysis] = useState<AnalysisRecord | null>(null);
  const [activeFindings, setActiveFindings] = useState<ComplianceFinding[]>([]);
  const [activeFeedbackDraft, setActiveFeedbackDraft] = useState<ExternalFeedbackDraft | undefined>(undefined);

  const [inspectingFinding, setInspectingFinding] = useState<ComplianceFinding | null>(null);
  const [showNewComparison, setShowNewComparison] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showTestSuiteModal, setShowTestSuiteModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch initial data from backend API
  const fetchInitialData = async () => {
    try {
      setIsLoading(true);
      // Fetch users
      const usersRes = await fetch('/api/users');
      if (usersRes.ok) {
        const data = await usersRes.json();
        setUsers(data.users || []);
        if (data.organizations && data.organizations[0]) {
          setCurrentOrg(data.organizations[0]);
        }
      }

      // Fetch analyses
      const analysesRes = await fetch('/api/analyses');
      if (analysesRes.ok) {
        const data = await analysesRes.json();
        setAnalyses(data.analyses || []);
      }

      // Fetch requirement sets
      const reqRes = await fetch('/api/requirements');
      if (reqRes.ok) {
        const data = await reqRes.json();
        if (data.requirementSets && data.requirementSets.length > 0) {
          setRequirementSets(data.requirementSets);
        }
      }

      // Fetch audit logs
      const auditRes = await fetch('/api/audit');
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
    fetchInitialData();
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
        const res = await fetch(`/api/analyses/${selectedAnalysisId}`);
        if (res.ok) {
          const data = await res.json();
          setSelectedAnalysis(data.analysis);
          setActiveFindings(data.findings || []);
          setActiveFeedbackDraft(data.feedback);
        }
      } catch (e) {
        console.error('Failed to load analysis:', e);
      }
    };

    loadAnalysis();
  }, [selectedAnalysisId]);

  // Handler to select and view an analysis
  const handleSelectAnalysis = (id: string) => {
    setSelectedAnalysisId(id);
    setActiveTab('analysis_detail');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 1-Click Launch Pilot A105N Case
  const handleLoadPilotCase = async () => {
    try {
      const pilot = analyses.find((a) => a.id.includes('pilot') || a.mtcNumber === 'WW2606229-3');
      if (pilot) {
        handleSelectAnalysis(pilot.id);
      } else {
        // Create new pilot analysis
        const res = await fetch('/api/analyses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requirementSetId: PILOT_MDS_REQUIREMENT_SET.id,
            userId: currentUser.id,
            title: 'Pilot Verification: Western Forge MTC WW2606229-3 vs Hawa Valves MDS Rev A',
          }),
        });
        if (res.ok) {
          const data = await res.json();
          setAnalyses((prev) => [data.analysis, ...prev]);
          handleSelectAnalysis(data.analysis.id);
        }
      }
    } catch (e) {
      console.error('Failed to load pilot test case:', e);
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
      const res = await fetch(`/api/findings/${findingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysisId: selectedAnalysisId,
          userId: currentUser.id,
          ...updates,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        // Update local findings state
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
        // Refresh audit logs
        const auditRes = await fetch('/api/audit');
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
      const res = await fetch(`/api/analyses/${analysisId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          approvalNotes: notes,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedAnalysis(data.analysis);
        setAnalyses((prev) =>
          prev.map((a) => (a.id === analysisId ? data.analysis : a))
        );
        // Refresh audit logs
        const auditRes = await fetch('/api/audit');
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
      const res = await fetch(`/api/analyses/${analysisId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          reason,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedAnalysis(data.analysis);
        setAnalyses((prev) =>
          prev.map((a) => (a.id === analysisId ? data.analysis : a))
        );
        // Refresh audit logs
        const auditRes = await fetch('/api/audit');
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
      const res = await fetch(`/api/analyses/${id}?userId=${currentUser.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setAnalyses((prev) => prev.filter((a) => a.id !== id));
        if (selectedAnalysisId === id) {
          setSelectedAnalysisId(null);
          setSelectedAnalysis(null);
          setActiveTab('dashboard');
        }
        // Refresh audit logs
        const auditRes = await fetch('/api/audit');
        if (auditRes.ok) {
          const auditData = await auditRes.json();
          setAuditLogs(auditData.auditLogs || []);
        }
      }
    } catch (e) {
      console.error('Failed to delete analysis:', e);
    }
  };

  // Clear all analyses
  const handleClearAllAnalyses = async () => {
    try {
      const res = await fetch('/api/analyses/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          orgId: currentOrg.id,
        }),
      });
      if (res.ok) {
        setAnalyses([]);
        setSelectedAnalysisId(null);
        setSelectedAnalysis(null);
        setActiveFindings([]);
        setActiveFeedbackDraft(undefined);
        // Refresh audit logs
        const auditRes = await fetch('/api/audit');
        if (auditRes.ok) {
          const auditData = await auditRes.json();
          setAuditLogs(auditData.auditLogs || []);
        }
      }
    } catch (e) {
      console.error('Failed to clear analyses:', e);
    }
  };

  // Save Feedback Draft
  const handleSaveFeedbackDraft = async (draft: ExternalFeedbackDraft) => {
    if (!selectedAnalysisId) return;
    try {
      const res = await fetch(`/api/feedback/${selectedAnalysisId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feedback: draft,
          userId: currentUser.id,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setActiveFeedbackDraft(data.feedback);
      }
    } catch (e) {
      console.error('Failed to save feedback draft:', e);
    }
  };

  // Create Requirement Set
  const handleCreateRequirementSet = async (newSetData: Partial<RequirementSet>) => {
    try {
      const res = await fetch('/api/requirements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newSetData,
          userId: currentUser.id,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setRequirementSets((prev) => [data.requirementSet, ...prev]);
      }
    } catch (e) {
      console.error('Failed to create requirement set:', e);
    }
  };

  // Delete single requirement set
  const handleDeleteRequirementSet = async (id: string) => {
    try {
      const res = await fetch(`/api/requirements/${id}?userId=${currentUser.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setRequirementSets((prev) => prev.filter((r) => r.id !== id));
        // Refresh audit logs
        const auditRes = await fetch('/api/audit');
        if (auditRes.ok) {
          const auditData = await auditRes.json();
          setAuditLogs(auditData.auditLogs || []);
        }
      }
    } catch (e) {
      console.error('Failed to delete requirement set:', e);
    }
  };

  // Clear all requirement sets
  const handleClearAllRequirementSets = async () => {
    try {
      const res = await fetch('/api/requirements/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          orgId: currentOrg.id,
        }),
      });
      if (res.ok) {
        setRequirementSets([]);
        // Refresh audit logs
        const auditRes = await fetch('/api/audit');
        if (auditRes.ok) {
          const auditData = await auditRes.json();
          setAuditLogs(auditData.auditLogs || []);
        }
      }
    } catch (e) {
      console.error('Failed to clear requirement sets:', e);
    }
  };

  if (!isAuthenticated) {
    return (
      <LoginPage
        defaultEmail={currentUser.email || 'User7817@gmail.com'}
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          setIsAuthenticated(true);
          localStorage.removeItem('mtc_auth_logged_out');
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans flex flex-col antialiased">
      {/* Top Application Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab);
          if (tab === 'dashboard') setSelectedAnalysisId(null);
        }}
        currentUser={currentUser}
        currentOrg={currentOrg}
        onOpenNewComparison={() => setShowNewComparison(true)}
        onOpenTestSuite={() => setShowTestSuiteModal(true)}
        onLogout={() => {
          localStorage.setItem('mtc_auth_logged_out', 'true');
          setIsAuthenticated(false);
        }}
      />

      {/* Main Page Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {showNewComparison ? (
          <NewComparison
            requirementSets={requirementSets}
            currentUser={currentUser}
            onAnalysisCreated={(newId) => {
              setShowNewComparison(false);
              fetchInitialData();
              handleSelectAnalysis(newId);
            }}
            onCancel={() => setShowNewComparison(false)}
          />
        ) : activeTab === 'analysis_detail' && selectedAnalysis ? (
          <AnalysisView
            analysis={selectedAnalysis}
            findings={activeFindings}
            feedbackDraft={activeFeedbackDraft}
            currentUser={currentUser}
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
              setShowNewComparison(true);
            }}
            onCreateRequirementSet={handleCreateRequirementSet}
            onDeleteRequirementSet={handleDeleteRequirementSet}
            onClearAllRequirementSets={handleClearAllRequirementSets}
          />
        ) : activeTab === 'audit' ? (
          <AuditLogView auditLogs={auditLogs} />
        ) : activeTab === 'history' ? (
          <HistoryView
            analyses={analyses}
            requirementSets={requirementSets}
            currentUser={currentUser}
            onSelectAnalysis={handleSelectAnalysis}
            onOpenNewComparison={() => setShowNewComparison(true)}
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
            onOpenNewComparison={() => setShowNewComparison(true)}
            onLoadPilotCase={handleLoadPilotCase}
            onOpenTestSuite={() => setShowTestSuiteModal(true)}
            onOpenLibrary={() => setActiveTab('library')}
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
    </div>
  );
}
