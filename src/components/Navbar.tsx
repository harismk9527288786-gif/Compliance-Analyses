import React, { useState, useRef, useEffect } from 'react';
import {
  FileCheck2,
  Layers,
  History,
  BookOpen,
  ShieldCheck,
  PlayCircle,
  LogOut,
  ChevronDown,
  Plus,
  Wrench,
  Building2,
} from 'lucide-react';
import { User, Organization } from '../types';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  currentUser: User;
  onUserChange?: (user: User) => void;
  allUsers?: User[];
  currentOrg: Organization;
  onOpenNewComparison: () => void;
  onOpenTestSuite: () => void;
  onLogout?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  currentUser,
  currentOrg,
  onOpenNewComparison,
  onOpenTestSuite,
  onLogout,
}) => {
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showToolsMenu, setShowToolsMenu] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const toolsMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
      if (toolsMenuRef.current && !toolsMenuRef.current.contains(event.target as Node)) {
        setShowToolsMenu(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowProfileMenu(false);
        setShowToolsMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-slate-100 sticky top-0 z-40 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo & Org Identifier */}
          <div className="flex items-center space-x-6 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('dashboard')}
              className="flex items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 rounded-lg group cursor-pointer"
            >
              <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold shadow-xs border border-emerald-400/50">
                <FileCheck2 className="w-5 h-5 stroke-[2.5]" aria-hidden="true" />
              </div>
              <div className="flex flex-col justify-center">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm tracking-tight text-white">
                    MTC Compliance Checker
                  </span>
                  <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-slate-800 text-emerald-400 border border-slate-700">
                    EN 10204 3.1
                  </span>
                </div>
                <div className="hidden sm:flex items-center gap-1 text-[11px] text-slate-400 font-mono leading-none mt-0.5">
                  <Building2 className="w-3 h-3 text-slate-500 shrink-0" aria-hidden="true" />
                  <span className="truncate max-w-[200px]">{currentOrg.name}</span>
                </div>
              </div>
            </button>

            {/* Core Navigation (Crisp engineering tabs) */}
            <nav aria-label="Main Navigation" className="flex items-center space-x-1 pl-3 border-l border-slate-800">
              <button
                type="button"
                onClick={() => setActiveTab('dashboard')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                  activeTab === 'dashboard'
                    ? 'bg-slate-800 text-white border border-slate-700'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Layers className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Dashboard</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('history')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                  activeTab === 'history'
                    ? 'bg-slate-800 text-white border border-slate-700'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <History className="w-3.5 h-3.5" aria-hidden="true" />
                <span>History</span>
              </button>

              {/* Tools Dropdown */}
              <div className="relative" ref={toolsMenuRef}>
                <button
                  type="button"
                  aria-haspopup="true"
                  aria-expanded={showToolsMenu}
                  onClick={() => setShowToolsMenu(!showToolsMenu)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                    activeTab === 'library' || activeTab === 'audit' || showToolsMenu
                      ? 'bg-slate-800 text-white border-slate-700'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/60 border-transparent'
                  }`}
                >
                  <Wrench className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                  <span>Tools</span>
                  <ChevronDown className="w-3 h-3 text-slate-400 ml-0.5" aria-hidden="true" />
                </button>

                {showToolsMenu && (
                  <div
                    role="menu"
                    className="absolute left-0 mt-2 w-64 bg-slate-900 rounded-lg shadow-xl border border-slate-800 py-1.5 z-50 text-slate-200"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setActiveTab('library');
                        setShowToolsMenu(false);
                      }}
                      className="w-full text-left px-3.5 py-2 flex items-center gap-3 text-xs text-slate-200 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
                    >
                      <BookOpen className="w-4 h-4 text-blue-400" aria-hidden="true" />
                      <div>
                        <div className="font-bold">MDS Requirement Library</div>
                        <div className="text-[10px] text-slate-400">Client material standard specs</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setActiveTab('audit');
                        setShowToolsMenu(false);
                      }}
                      className="w-full text-left px-3.5 py-2 flex items-center gap-3 text-xs text-slate-200 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
                    >
                      <ShieldCheck className="w-4 h-4 text-emerald-400" aria-hidden="true" />
                      <div>
                        <div className="font-bold">Immutable Audit Trail</div>
                        <div className="text-[10px] text-slate-400">Quality sign-off & override logs</div>
                      </div>
                    </button>

                    <div className="my-1 border-t border-slate-800 mx-2" />

                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        onOpenTestSuite();
                        setShowToolsMenu(false);
                      }}
                      className="w-full text-left px-3.5 py-2 flex items-center gap-3 text-xs text-amber-300 hover:bg-slate-800 hover:text-amber-200 transition-colors cursor-pointer"
                    >
                      <PlayCircle className="w-4 h-4 text-amber-400" aria-hidden="true" />
                      <div>
                        <div className="font-bold">Automated Test Suite</div>
                        <div className="text-[10px] text-slate-400">Deterministic test cases runner</div>
                      </div>
                    </button>
                  </div>
                )}
              </div>
            </nav>
          </div>

          {/* Right Action: Verify Button & Profile */}
          <div className="flex items-center space-x-3 shrink-0">
            <button
              type="button"
              onClick={onOpenNewComparison}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition-colors cursor-pointer border border-emerald-400/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" aria-hidden="true" />
              <span>Verify MTC</span>
            </button>

            {/* Profile Dropdown */}
            <div className="relative" ref={profileMenuRef}>
              <button
                type="button"
                aria-haspopup="true"
                aria-expanded={showProfileMenu}
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="flex items-center space-x-2 p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                title="Account Settings"
              >
                <img
                  src={currentUser.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                  alt={currentUser.name}
                  className="w-6 h-6 rounded-full object-cover border border-slate-600"
                />
                <ChevronDown className="w-3 h-3 text-slate-400 mr-0.5" aria-hidden="true" />
              </button>

              {showProfileMenu && (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-64 bg-slate-900 rounded-lg shadow-2xl border border-slate-800 py-2 z-50 text-slate-200"
                >
                  <div className="px-4 py-2.5 border-b border-slate-800">
                    <p className="text-xs font-bold text-white truncate">{currentUser.name}</p>
                    <p className="text-[11px] text-slate-400 font-mono truncate">{currentUser.email}</p>
                    <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-emerald-400 border border-slate-700">
                      <ShieldCheck className="w-3 h-3" aria-hidden="true" />
                      <span>Role: {currentUser.role}</span>
                    </div>
                  </div>

                  <div className="p-1">
                    {onLogout && (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setShowProfileMenu(false);
                          onLogout();
                        }}
                        className="w-full text-left px-3 py-2 flex items-center gap-2.5 text-xs text-rose-400 hover:bg-rose-950/40 rounded-md transition-colors font-medium cursor-pointer"
                      >
                        <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Sign Out</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
