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
  Plus,
} from 'lucide-react';
import { User, Organization } from '../types';
import { DottedOffsetButton } from './DottedOffsetButton';

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

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Layers },
    { id: 'library', label: 'Requirement Library', icon: BookOpen },
    { id: 'history', label: 'Analysis History', icon: History },
    { id: 'audit', label: 'Audit Trail', icon: ShieldCheck },
  ];

  return (
    <header className="bg-slate-900 border-b border-slate-800/90 text-white sticky top-0 z-40 shadow-sm backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo & Organization Lockup */}
          <div className="flex items-center space-x-6 shrink-0">
            <button
              onClick={() => setActiveTab('dashboard')}
              className="flex items-center gap-3 text-left focus:outline-none group cursor-pointer"
            >
              <div className="w-9 h-9 rounded-lg bg-emerald-600 border border-emerald-500/30 flex items-center justify-center text-white shadow-xs group-hover:bg-emerald-500 transition-colors shrink-0">
                <FileCheck2 className="w-5 h-5" />
              </div>
              <div className="flex flex-col justify-center">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm tracking-tight text-slate-100 group-hover:text-white transition-colors">
                    MTC Compliance Checker
                  </span>
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-slate-800 text-emerald-400 border border-slate-700/80 leading-none">
                    v2.4
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-medium leading-none mt-0.5">
                  <Building2 className="w-3 h-3 text-slate-500 shrink-0" />
                  <span className="truncate max-w-[200px] sm:max-w-[260px]">{currentOrg.name}</span>
                </div>
              </div>
            </button>

            {/* Navigation Tabs */}
            <nav className="hidden md:flex items-center space-x-1 pl-4 border-l border-slate-800">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                      isActive
                        ? 'bg-slate-800 text-emerald-400 border border-slate-700/80 shadow-xs'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Right Action CTAs & Profile Controls */}
          <div className="flex items-center space-x-2.5 shrink-0">
            {/* Test Suite CTA */}
            <button
              onClick={onOpenTestSuite}
              className="hidden lg:flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800/90 hover:bg-slate-800 text-amber-300 border border-slate-700 hover:border-slate-600 transition-colors shadow-xs cursor-pointer"
              title="Run automated 16-point compliance test suite"
            >
              <PlayCircle className="w-3.5 h-3.5 text-amber-400" />
              <span>Test Suite (16 Specs)</span>
            </button>

            {/* Primary Action CTA with DottedOffsetButton */}
            <DottedOffsetButton
              onClick={onOpenNewComparison}
              variant="primary"
              size="sm"
              icon={<Plus className="w-4 h-4" />}
            >
              New Comparison
            </DottedOffsetButton>

            <div className="h-5 w-px bg-slate-800 hidden sm:block" />

            {/* User Profile Dropdown Trigger */}
            <div className="relative">
              <button
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="flex items-center space-x-2 px-2 py-1.5 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-800/40 hover:bg-slate-800/80 transition-colors cursor-pointer"
                title="Account Settings"
              >
                <img
                  src={currentUser.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                  alt={currentUser.name}
                  className="w-6 h-6 rounded-full object-cover border border-slate-700"
                />
                <div className="hidden sm:block text-left text-xs">
                  <div className="font-semibold text-slate-200 whitespace-nowrap leading-tight">
                    {currentUser.name}
                  </div>
                </div>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {/* Profile Dropdown Menu */}
              {showProfileMenu && (
                <div className="absolute right-0 mt-2 w-64 bg-slate-900 rounded-xl shadow-2xl border border-slate-800 py-2 z-50 text-slate-200 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="px-3.5 py-2.5 border-b border-slate-800">
                    <p className="text-xs font-bold text-white truncate">{currentUser.name}</p>
                    <p className="text-[11px] text-slate-400 font-mono truncate">{currentUser.email}</p>
                    <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800/60">
                      <ShieldCheck className="w-3 h-3 text-emerald-400" />
                      <span>Quality & Inspection Reviewer</span>
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
                        <span>Sign Out / Switch Profile</span>
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
