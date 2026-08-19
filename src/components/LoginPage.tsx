import React, { useState } from 'react';
import {
  FileCheck2,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  User,
  Sparkles,
  Award,
  HelpCircle,
  BrainCircuit,
  Check,
  RotateCcw,
  Zap,
} from 'lucide-react';
import { User as UserType } from '../types';

interface LoginPageProps {
  onLoginSuccess: (user: UserType) => void;
  defaultEmail?: string;
}

interface Question {
  id: number;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

const KNOWLEDGE_QUESTIONS: Question[] = [
  {
    id: 1,
    question: 'What does "MTC" stand for in metallurgy and quality assurance?',
    options: [
      'Material Test Certificate',
      'Manufacturing Tolerance Check',
      'Maximum Temperature Calculation',
    ],
    correctIndex: 0,
    explanation: 'MTC stands for Material Test Certificate (Inspection Certificate).',
  },
  {
    id: 2,
    question: 'Which standard defines Type 3.1 & Type 3.2 metallic inspection documents?',
    options: ['ISO 14001', 'EN 10204', 'ASTM E8'],
    correctIndex: 1,
    explanation: 'EN 10204 is the international standard for types of inspection documents for metallic products.',
  },
  {
    id: 3,
    question: 'What is Carbon Equivalent (CE) primarily used to evaluate in carbon steel?',
    options: [
      'Weldability & cold cracking risk',
      'Paint adhesion & color grade',
      'Electrical conductivity',
    ],
    correctIndex: 0,
    explanation: 'Carbon Equivalent calculates hardenability to prevent hydrogen-induced cold cracking during welding.',
  },
];

export const LoginPage: React.FC<LoginPageProps> = ({
  onLoginSuccess,
  defaultEmail = 'user@mtc-compliance.local',
}) => {
  const [userName, setUserName] = useState('Quality Engineer');
  const [userRole, setUserRole] = useState<'qc_reviewer' | 'engineer' | 'auditor'>('qc_reviewer');
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [isEntering, setIsEntering] = useState(false);

  const answeredCount = Object.keys(answers).length;
  const correctCount = KNOWLEDGE_QUESTIONS.filter(
    (q) => answers[q.id] === q.correctIndex
  ).length;

  const handleSelectAnswer = (questionId: number, optionIndex: number) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: optionIndex,
    }));
  };

  const handleEnterApp = (skipQuiz: boolean = false) => {
    setIsEntering(true);
    const finalName = userName.trim() || 'Quality Specialist';
    const finalUser: UserType = {
      id: `personal-user-${Date.now()}`,
      name: finalName,
      email: defaultEmail,
      role: userRole,
      organizationId: 'org-apex-01',
      organizationName: 'Apex Valve & Flow Engineering Ltd.',
      avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(finalName)}&backgroundColor=059669,0284c7`,
    };

    localStorage.setItem('mtc_auth_user', JSON.stringify(finalUser));
    localStorage.removeItem('mtc_auth_logged_out');

    setTimeout(() => {
      onLoginSuccess(finalUser);
      setIsEntering(false);
    }, 400);
  };

  const isAllAnswered = answeredCount === KNOWLEDGE_QUESTIONS.length;
  const isPerfectScore = correctCount === KNOWLEDGE_QUESTIONS.length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between antialiased selection:bg-emerald-500 selection:text-white">
      {/* Top Header */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-lg shadow-emerald-900/40">
              <FileCheck2 className="w-6 h-6" />
            </div>
            <div>
              <div className="font-bold text-base tracking-tight text-white flex items-center gap-2">
                MTC Compliance Checker
                <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Personal Edition
                </span>
              </div>
              <div className="text-xs text-slate-400">
                EN 10204 3.1 & MDS Deterministic Metallurgical Verification
              </div>
            </div>
          </div>

          <button
            onClick={() => handleEnterApp(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-emerald-400 bg-slate-900/80 hover:bg-slate-800 border border-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>Direct Access</span>
          </button>
        </div>
      </header>

      {/* Main Knowledge Gate Container */}
      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-8 flex flex-col justify-center">
        <div className="bg-slate-900/90 rounded-2xl border border-slate-800 shadow-2xl p-6 sm:p-8 space-y-6 backdrop-blur-xl relative overflow-hidden">
          {/* Subtle Glows */}
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Heading */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-slate-800 border border-slate-700/80 text-emerald-400 mb-1 shadow-inner">
              <BrainCircuit className="w-6 h-6" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              Quality Engineer Entry Gate
            </h1>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Personal workstation access. Verify 3 quick quality assurance basics to enter, or jump straight in.
            </p>
          </div>

          {/* Personal Profile Configuration */}
          <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700/60 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
              <User className="w-4 h-4 text-emerald-400" />
              <span>Personal Profile</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Your Name:</label>
                <input
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="e.g. Zarique Shaikh"
                  className="w-full px-3 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Role / Specialization:</label>
                <select
                  value={userRole}
                  onChange={(e) => setUserRole(e.target.value as any)}
                  className="w-full px-3 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="qc_reviewer">Lead QC Inspector</option>
                  <option value="engineer">Materials Engineer (PE)</option>
                  <option value="auditor">Quality Auditor</option>
                </select>
              </div>
            </div>
          </div>

          {/* Knowledge Questions */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <HelpCircle className="w-4 h-4 text-blue-400" />
                <span>Knowledge Check</span>
              </span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300">
                {answeredCount}/{KNOWLEDGE_QUESTIONS.length} Answered
                {isAllAnswered && isPerfectScore && ' • 3/3 Correct! 🎉'}
              </span>
            </div>

            <div className="space-y-3">
              {KNOWLEDGE_QUESTIONS.map((q, qIndex) => {
                const selected = answers[q.id];
                const isAnswered = selected !== undefined;
                const isCorrect = isAnswered && selected === q.correctIndex;

                return (
                  <div
                    key={q.id}
                    className={`p-4 rounded-xl border transition-all ${
                      isAnswered
                        ? isCorrect
                          ? 'bg-emerald-950/20 border-emerald-500/40'
                          : 'bg-rose-950/20 border-rose-500/40'
                        : 'bg-slate-800/40 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <p className="text-xs font-semibold text-slate-200 mb-2.5">
                      <span className="text-emerald-400 font-mono mr-1.5">{qIndex + 1}.</span>
                      {q.question}
                    </p>

                    <div className="space-y-1.5">
                      {q.options.map((opt, optIndex) => {
                        const isOptionSelected = selected === optIndex;
                        const isOptionCorrect = optIndex === q.correctIndex;

                        return (
                          <button
                            key={optIndex}
                            type="button"
                            onClick={() => handleSelectAnswer(q.id, optIndex)}
                            className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-all flex items-center justify-between cursor-pointer ${
                              isOptionSelected
                                ? isOptionCorrect
                                  ? 'bg-emerald-600 text-white font-semibold shadow-xs'
                                  : 'bg-rose-600 text-white font-semibold shadow-xs'
                                : 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-700/60'
                            }`}
                          >
                            <span>{opt}</span>
                            {isOptionSelected && (
                              <span className="shrink-0 ml-2">
                                {isOptionCorrect ? (
                                  <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                                ) : (
                                  <span className="text-[10px] bg-rose-700 px-1.5 py-0.5 rounded">Try again</span>
                                )}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {isAnswered && (
                      <p
                        className={`text-[11px] mt-2 font-mono flex items-center gap-1 ${
                          isCorrect ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {isCorrect ? '✓ ' : 'ℹ '}
                        {q.explanation}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
            <button
              type="button"
              disabled={isEntering}
              onClick={() => handleEnterApp(false)}
              className={`w-full sm:flex-1 py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer ${
                isAllAnswered
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/30'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
              }`}
            >
              <span>
                {isEntering
                  ? 'Loading Workspace...'
                  : isAllAnswered
                  ? 'Enter Workspace (Verified)'
                  : 'Enter Workspace'}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              disabled={isEntering}
              onClick={() => handleEnterApp(true)}
              className="w-full sm:w-auto py-3 px-4 text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 rounded-xl transition-colors cursor-pointer"
            >
              Skip Check & Enter
            </button>
          </div>

          {/* Footer note */}
          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-center gap-2 text-[11px] text-slate-400 font-mono">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Single-User Local Session • No Password Required</span>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/60 bg-slate-900/40 py-4 px-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>&copy; 2026 MTC Compliance Checker &bull; Personal Engineering Workstation</span>
          <span className="flex items-center gap-2 font-mono text-[11px]">
            <span>Deterministic QC Engine</span>
            <span>&bull;</span>
            <span>Zero Remote Storage</span>
          </span>
        </div>
      </footer>
    </div>
  );
};
