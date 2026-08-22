import React, { useState } from 'react';
import {
  FileCheck2,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  User,
  HelpCircle,
  Cpu,
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
    }, 300);
  };

  const isAllAnswered = answeredCount === KNOWLEDGE_QUESTIONS.length;
  const isPerfectScore = correctCount === KNOWLEDGE_QUESTIONS.length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between antialiased">
      {/* Top Header */}
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-600 flex items-center justify-center text-white shadow-xs border border-emerald-400/50">
              <FileCheck2 className="w-5 h-5 stroke-[2.5]" aria-hidden="true" />
            </div>
            <div>
              <div className="font-bold text-sm tracking-tight text-white flex items-center gap-2">
                <span>MTC Compliance Checker</span>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-slate-800 text-emerald-400 border border-slate-700">
                  Engineering Workstation
                </span>
              </div>
              <div className="text-xs text-slate-400 font-mono">
                EN 10204 3.1 &amp; MDS Deterministic Metallurgical Verification
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleEnterApp(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer border border-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            <Zap className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
            <span>Direct Access</span>
          </button>
        </div>
      </header>

      {/* Main Knowledge Gate Container */}
      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-8 flex flex-col justify-center">
        <div className="bg-slate-900 rounded-xl shadow-2xl border border-slate-800 p-6 sm:p-8 space-y-6">
          {/* Heading */}
          <div className="text-center space-y-1.5">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-slate-800 text-emerald-400 mb-1 border border-slate-700">
              <Cpu className="w-5 h-5" aria-hidden="true" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white">
              Quality Engineer Workstation Gate
            </h1>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Configure inspector credentials and verify metallurgy quality check fundamentals.
            </p>
          </div>

          {/* Personal Profile Configuration */}
          <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-300 font-mono uppercase tracking-wider">
              <User className="w-4 h-4 text-emerald-400" aria-hidden="true" />
              <span>Inspector Profile Configuration</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">Inspector Name:</label>
                <input
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="e.g. Quality Engineer"
                  className="w-full px-3 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">QC Role:</label>
                <select
                  value={userRole}
                  onChange={(e) => setUserRole(e.target.value as any)}
                  className="w-full px-3 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="qc_reviewer">Lead QC Inspector</option>
                  <option value="engineer">Materials Engineer (PE)</option>
                  <option value="auditor">Quality Auditor</option>
                </select>
              </div>
            </div>
          </div>

          {/* Knowledge Questions */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 font-mono uppercase tracking-wider flex items-center gap-1.5">
                <HelpCircle className="w-4 h-4 text-blue-400" aria-hidden="true" />
                <span>Verification Knowledge Check</span>
              </span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                {answeredCount}/{KNOWLEDGE_QUESTIONS.length} Answered
                {isAllAnswered && isPerfectScore && ' • 3/3 Correct'}
              </span>
            </div>

            <div className="space-y-2.5">
              {KNOWLEDGE_QUESTIONS.map((q, qIndex) => {
                const selected = answers[q.id];
                const isAnswered = selected !== undefined;
                const isCorrect = isAnswered && selected === q.correctIndex;

                return (
                  <div
                    key={q.id}
                    className={`p-3.5 rounded-lg border transition-all ${
                      isAnswered
                        ? isCorrect
                          ? 'bg-emerald-950/40 border-emerald-800'
                          : 'bg-rose-950/40 border-rose-800'
                        : 'bg-slate-950/70 border-slate-800'
                    }`}
                  >
                    <p className="text-xs font-semibold text-slate-200 mb-2">
                      <span className="text-emerald-400 font-mono mr-1.5">{qIndex + 1}.</span>
                      {q.question}
                    </p>

                    <div className="space-y-1">
                      {q.options.map((opt, optIndex) => {
                        const isOptionSelected = selected === optIndex;
                        const isOptionCorrect = optIndex === q.correctIndex;

                        return (
                          <button
                            key={optIndex}
                            type="button"
                            onClick={() => handleSelectAnswer(q.id, optIndex)}
                            className={`w-full text-left px-3 py-1.5 rounded-md text-xs transition-colors flex items-center justify-between cursor-pointer border ${
                              isOptionSelected
                                ? isOptionCorrect
                                  ? 'bg-emerald-700 text-white font-bold border-emerald-600 shadow-xs'
                                  : 'bg-rose-700 text-white font-bold border-rose-600 shadow-xs'
                                : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800'
                            }`}
                          >
                            <span>{opt}</span>
                            {isOptionSelected && (
                              <span className="shrink-0 ml-2">
                                {isOptionCorrect ? (
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-200" aria-hidden="true" />
                                ) : (
                                  <span className="text-[10px] bg-rose-900 px-1.5 py-0.5 rounded">Retry</span>
                                )}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {isAnswered && (
                      <p
                        className={`text-[11px] mt-2 font-mono ${
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
              className={`w-full sm:flex-1 py-2.5 px-4 rounded-lg font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer border ${
                isAllAnswered
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400/50'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
              }`}
            >
              <span>
                {isEntering
                  ? 'Initializing Workspace...'
                  : isAllAnswered
                  ? 'Enter Workspace (Verified)'
                  : 'Enter Workspace'}
              </span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </button>

            <button
              type="button"
              disabled={isEntering}
              onClick={() => handleEnterApp(true)}
              className="w-full sm:w-auto py-2.5 px-4 text-xs font-semibold text-slate-400 hover:text-slate-200 rounded-lg border border-transparent hover:border-slate-700 transition-colors cursor-pointer"
            >
              Skip Check &amp; Enter
            </button>
          </div>

          {/* Footer note */}
          <div className="pt-2 flex items-center justify-center gap-2 text-[11px] text-slate-500 font-mono">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" aria-hidden="true" />
            <span>Single-User Local Session &bull; ISO 9001 Grounded</span>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 border-t border-slate-800 py-3 px-6 text-center text-xs text-slate-500 font-mono">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>&copy; 2026 MTC Compliance Checker &bull; Deterministic Metallurgical Verification Suite</span>
          <span className="text-slate-400">
            EN 10204 3.1 &bull; ISO 15156 / NACE MR0175
          </span>
        </div>
      </footer>
    </div>
  );
};
