import React, { useState } from 'react';
import {
  FileCheck2,
  Layers,
  BookOpen,
  History,
  ShieldCheck,
  PlayCircle,
  Building2,
  LogOut,
  ChevronDown,
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
  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-40 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Org */}
          <div className="flex items-center space-x-6">
            <button
              onClick={() => setActiveTab('dashboard')}
              className="flex items-center gap-3 text-left focus:outline-none group cursor-pointer"
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-md group-hover:bg-emerald-500 transition-colors shrink-0">
                <FileCheck2 className="w-5.5 h-5.5" />
              </div>
              <div className="flex flex-col justify-center">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-base tracking-tight text-slate-100 leading-snug">
                    MTC Compliance Checker
                  </span>
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold font-mono bg-slate-800 text-emerald-400 border border-slate-700 leading-none">
                    v2.4
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-400 leading-none mt-1">
                  <Building2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span className="truncate max-w-[240px]">{currentOrg.name}</span>
                </div>
              </div>
            </button>

            {/* Navigation Tabs */}
            <nav className="hidden md:flex items-center space-x-1.5 pl-6 border-l border-slate-800">
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`px-3.5 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${
                  activeTab === 'dashboard'
                    ? 'bg-slate-800 text-emerald-400 font-semibold'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Layers className="w-4.5 h-4.5" />
                <span>Dashboard</span>
              </button>
              <button
                onClick={() => setActiveTab('library')}
                className={`px-3.5 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${
                  activeTab === 'library'
                    ? 'bg-slate-800 text-emerald-400 font-semibold'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <BookOpen className="w-4.5 h-4.5" />
                <span>Requirement Library</span>
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`px-3.5 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${
                  activeTab === 'history'
                    ? 'bg-slate-800 text-emerald-400 font-semibold'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <History className="w-4.5 h-4.5" />
                <span>Analysis History</span>
              </button>
              <button
                onClick={() => setActiveTab('audit')}
                className={`px-3.5 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${
                  activeTab === 'audit'
                    ? 'bg-slate-800 text-emerald-400 font-semibold'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <ShieldCheck className="w-4.5 h-4.5" />
                <span>Audit Trail</span>
              </button>
            </nav>
          </div>

          {/* Action CTAs & RBAC Profile Switcher */}
          <div className="flex items-center space-x-3">
            <button
              onClick={onOpenTestSuite}
              className="hidden lg:flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 transition-colors shadow-sm cursor-pointer"
              title="Run 15-point compliance test suite"
            >
              <PlayCircle className="w-3.5 h-3.5" />
              <span>Test Suite (16 Specs)</span>
            </button>

            <button
              onClick={onOpenNewComparison}
              className="flex items-center space-x-2 px-3.5 py-2 rounded-md text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow transition-colors cursor-pointer"
            >
              <Layers className="w-4 h-4" />
              <span>New Comparison</span>
            </button>

            {/* User Profile with Sign Out option */}
            <div className="relative">
              <button
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="flex items-center space-x-2.5 px-2.5 py-1.5 rounded-lg border border-slate-800 bg-slate-800/60 hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <img
                  src={currentUser.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                  alt={currentUser.name}
                  className="w-7 h-7 rounded-full object-cover border border-slate-700"
                />
                <div className="hidden sm:block text-left text-xs">
                  <div className="font-semibold text-slate-200 whitespace-nowrap">{currentUser.name}</div>
                </div>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {/* Profile Dropdown */}
              {showProfileMenu && (
                <div className="absolute right-0 mt-2 w-64 bg-slate-900 rounded-xl shadow-2xl border border-slate-800 py-2 z-50 text-slate-200 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="px-3.5 py-2.5 border-b border-slate-800">
                    <p className="text-xs font-bold text-white truncate">{currentUser.name}</p>
                    <p className="text-[11px] text-slate-400 font-mono truncate">{currentUser.email}</p>
                    <div className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800/60">
                      <ShieldCheck className="w-3 h-3" />
                      Lead Reviewer
                    </div>
                  </div>

                  <div className="p-1">
                    {onLogout && (
                      <button
                        onClick={() => {
                          setShowProfileMenu(false);
                          onLogout();
                        }}
                        className="w-full text-left px-3 py-2 flex items-center gap-2.5 text-xs text-rose-400 hover:bg-rose-950/40 rounded-lg transition-colors font-medium cursor-pointer"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Sign Out / Switch Account</span>
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
