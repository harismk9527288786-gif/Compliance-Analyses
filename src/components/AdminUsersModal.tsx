import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  X,
  Mail,
  Copy,
  Check,
  AlertCircle,
  RefreshCw,
  Clock,
  UserCheck,
  UserX,
} from 'lucide-react';
import { User, UserRole } from '../types';
import { apiFetch } from '../utils/api';

interface AdminUsersModalProps {
  currentUser: User;
  onClose: () => void;
}

interface OrgUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  is_active?: boolean;
  last_login_at: string | null;
}

interface OrgInvitation {
  id: string;
  email: string;
  role: UserRole;
  created_at: string;
  expires_at: string;
}

export const AdminUsersModal: React.FC<AdminUsersModalProps> = ({ currentUser, onClose }) => {
  const [users, setUsers] = useState<OrgUser[]>([]);
  const [invitations, setInvitations] = useState<OrgInvitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>('QUALITY_ENGINEER');
  const [isInviting, setIsInviting] = useState(false);
  const [generatedInviteLink, setGeneratedInviteLink] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchUsersAndInvites = async () => {
    try {
      setIsLoading(true);
      const res = await apiFetch('/api/auth/users');
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
        setInvitations(data.invitations || []);
      }
    } catch (e) {
      console.error('Failed to fetch org users:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsersAndInvites();
  }, []);

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setGeneratedInviteLink(null);

    if (!inviteEmail.trim() || !inviteEmail.includes('@')) {
      setErrorMessage('Please enter a valid work email address.');
      return;
    }

    setIsInviting(true);

    try {
      const res = await apiFetch('/api/auth/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });

      const data = await res.json();
      setIsInviting(false);

      if (!res.ok) {
        setErrorMessage(data.error || 'Failed to send invitation.');
        return;
      }

      const fullLink = `${window.location.origin}${data.invitation.inviteLink}`;
      setGeneratedInviteLink(fullLink);
      setSuccessMessage(`Invitation created for ${inviteEmail}.`);
      setInviteEmail('');
      fetchUsersAndInvites();
    } catch (e: any) {
      setIsInviting(false);
      setErrorMessage('Network error while creating invitation.');
    }
  };

  const handleToggleUserStatus = async (userId: string, currentStatus: boolean) => {
    try {
      const res = await apiFetch(`/api/auth/users/${userId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentStatus }),
      });

      if (res.ok) {
        fetchUsersAndInvites();
      }
    } catch (e) {
      console.error('Failed to toggle user status:', e);
    }
  };

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    try {
      const res = await apiFetch(`/api/auth/users/${userId}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });

      if (res.ok) {
        fetchUsersAndInvites();
      }
    } catch (e) {
      console.error('Failed to change user role:', e);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-3xl w-full p-6 space-y-5 text-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5 text-white font-bold text-base">
            <div className="p-1.5 rounded-lg bg-slate-800 text-emerald-400 border border-slate-700">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold leading-tight">Organization Team &amp; User Governance</h3>
              <p className="text-[11px] text-slate-400 font-normal">
                {currentUser.organizationName} &bull; RBAC Management
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Invite Form */}
        <div className="p-4 bg-slate-950/70 rounded-xl border border-slate-800 space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
            <UserPlus className="w-4 h-4 text-sky-400" />
            <span>Invite New Member to Organization</span>
          </div>

          <form onSubmit={handleSendInvite} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
            <div className="sm:col-span-6 space-y-1">
              <label className="block text-[11px] font-semibold text-slate-400">Work Email Address</label>
              <div className="relative">
                <Mail className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="inspector@company.com"
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="sm:col-span-4 space-y-1">
              <label className="block text-[11px] font-semibold text-slate-400">Assigned Role</label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as UserRole)}
                className="w-full px-3 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="QUALITY_ENGINEER">Quality Engineer (Upload &amp; Analyze)</option>
                <option value="REVIEWER">Reviewer (Review &amp; Sign-off)</option>
                <option value="ADMIN">Administrator (Full Access)</option>
                <option value="VIEWER">Viewer (Read-Only)</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={isInviting}
                className="w-full py-1.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-60"
              >
                {isInviting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
                <span>Invite</span>
              </button>
            </div>
          </form>

          {/* Error / Success Notifications */}
          {errorMessage && (
            <div className="p-2.5 rounded-lg bg-rose-950/70 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-2.5 rounded-lg bg-emerald-950/70 border border-emerald-800 text-emerald-300 text-xs flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {generatedInviteLink && (
            <div className="p-3 bg-slate-900 rounded-lg border border-slate-700 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-slate-300 font-semibold">
                <span>Direct Invitation Link (7-Day Expiration):</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(generatedInviteLink)}
                  className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 font-bold cursor-pointer"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedLink ? 'Copied!' : 'Copy Link'}</span>
                </button>
              </div>
              <div className="p-2 bg-slate-950 rounded font-mono text-[11px] text-emerald-400 break-all select-all">
                {generatedInviteLink}
              </div>
            </div>
          )}
        </div>

        {/* Active Members Table */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-300">
            <span>Active Team Members ({users.length})</span>
            <button
              type="button"
              onClick={fetchUsersAndInvites}
              className="text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>

          <div className="border border-slate-800 rounded-xl overflow-hidden max-h-[260px] overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 font-mono text-[11px] uppercase border-b border-slate-800 sticky top-0">
                <tr>
                  <th className="px-3.5 py-2.5">User</th>
                  <th className="px-3.5 py-2.5">Email</th>
                  <th className="px-3.5 py-2.5">Role</th>
                  <th className="px-3.5 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 bg-slate-900/60">
                {users.map((u) => {
                  const isSelf = u.id === currentUser.id;
                  const isActive = u.is_active !== false;

                  return (
                    <tr key={u.id} className="hover:bg-slate-800/50 transition-colors">
                      <td className="px-3.5 py-2.5 font-medium text-white flex items-center gap-2">
                        <span>{u.name}</span>
                        {isSelf && (
                          <span className="text-[10px] bg-slate-800 text-slate-400 border border-slate-700 px-1.5 py-0.2 rounded font-mono">
                            You
                          </span>
                        )}
                      </td>
                      <td className="px-3.5 py-2.5 font-mono text-slate-300 text-[11px]">{u.email}</td>
                      <td className="px-3.5 py-2.5">
                        {isSelf ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-emerald-400 border border-slate-700">
                            {u.role}
                          </span>
                        ) : (
                          <select
                            value={u.role}
                            onChange={(e) => handleRoleChange(u.id, e.target.value as UserRole)}
                            className="bg-slate-950 border border-slate-700 rounded px-2 py-0.5 text-[11px] text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          >
                            <option value="QUALITY_ENGINEER">QUALITY_ENGINEER</option>
                            <option value="REVIEWER">REVIEWER</option>
                            <option value="ADMIN">ADMIN</option>
                            <option value="VIEWER">VIEWER</option>
                          </select>
                        )}
                      </td>
                      <td className="px-3.5 py-2.5 text-right">
                        {!isSelf && (
                          <button
                            type="button"
                            onClick={() => handleToggleUserStatus(u.id, isActive)}
                            className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                              isActive
                                ? 'text-rose-400 hover:bg-rose-950/40 border border-rose-900/50'
                                : 'text-emerald-400 hover:bg-emerald-950/40 border border-emerald-900/50'
                            }`}
                          >
                            {isActive ? 'Deactivate' : 'Activate'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pending Invitations */}
        {invitations.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>Pending Invitations ({invitations.length})</span>
            </div>
            <div className="border border-slate-800 rounded-lg overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 font-mono text-[11px] uppercase border-b border-slate-800">
                  <tr>
                    <th className="px-3 py-2">Invited Email</th>
                    <th className="px-3 py-2">Role</th>
                    <th className="px-3 py-2">Expires</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 bg-slate-900/40">
                  {invitations.map((inv) => (
                    <tr key={inv.id}>
                      <td className="px-3 py-2 font-mono text-slate-300">{inv.email}</td>
                      <td className="px-3 py-2 font-bold text-amber-400 text-[11px]">{inv.role}</td>
                      <td className="px-3 py-2 text-slate-400 text-[11px] font-mono">
                        {new Date(inv.expires_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="pt-2 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
