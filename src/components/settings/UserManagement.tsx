import { useEffect, useState, useMemo, useRef } from 'react';
import { supabase, isRealSupabase, getMockProfiles, saveMockProfiles, type Profile } from '../../lib/supabase';
import {
  UserPlus, Mail, Shield, Building2, AlertTriangle,
  CheckCircle2, Clock, UserX, UserCheck, RefreshCw, X, Search, Lock,
  Copy, Check, Send, Key, Pencil, MapPin
} from 'lucide-react';

const FACILITY_OPTIONS = [
  'All',
  'San Leandro Cutting & Sewing',
  'Petaluma Distribution & Laundry',
  'Sewing Facility',
  'Laundry Facility',
];

const ROLE_OPTIONS = [
  'merchandiser', 'production_manager', 'cutting_supervisor', 'sewing_supervisor',
  'qc_inspector', 'warehouse', 'finance', 'customer', 'admin', 'super_admin',
];
import { 
  sendAccountInviteEmail, 
  generateTemporaryPassword, 
  type EmailDispatchResult 
} from '../../lib/emailService';

interface Company {
  id: string;
  name: string;
  code?: string;
  company_type: string;
  status: string;
}

export function UserManagement() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Invite Modal State
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteFullName, setInviteFullName] = useState('');
  const [inviteRole, setInviteRole] = useState<string>('merchandiser');
  const [inviteFacility, setInviteFacility] = useState<string>('All');
  const [inviteCompanyId, setInviteCompanyId] = useState<string>('');
  const [companySearch, setCompanySearch] = useState('');
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);
  const [inviteFormError, setInviteFormError] = useState('');
  const [isSubmittingInvite, setIsSubmittingInvite] = useState(false);
  const comboboxRef = useRef<HTMLDivElement>(null);

  // Invite Success / Credentials Modal
  const [inviteResult, setInviteResult] = useState<EmailDispatchResult | null>(null);
  const [hasCopiedText, setHasCopiedText] = useState(false);

  // REQ-01: Dynamic Role & Facility Reassignment Modal — lets Admin change an
  // existing user's role/facility in-place without deleting/recreating the account.
  const [reassignTarget, setReassignTarget] = useState<Profile | null>(null);
  const [reassignRole, setReassignRole] = useState('merchandiser');
  const [reassignFacility, setReassignFacility] = useState('All');
  const [isReassigning, setIsReassigning] = useState(false);

  const openReassignModal = (profile: Profile) => {
    setReassignTarget(profile);
    setReassignRole(profile.role);
    setReassignFacility(profile.facility_scope || 'All');
  };

  const handleReassignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reassignTarget) return;
    setIsReassigning(true);
    setStatusMsg(null);

    try {
      const updates: Partial<Profile> = { role: reassignRole as Profile['role'], facility_scope: reassignFacility };

      if (isRealSupabase) {
        const { error } = await supabase.from('profiles').update(updates).eq('id', reassignTarget.id);
        if (error) throw error;
      } else {
        const updated = profiles.map(p => p.id === reassignTarget.id ? { ...p, ...updates } : p);
        setProfiles(updated);
        saveMockProfiles(updated);
      }

      setProfiles(prev => prev.map(p => p.id === reassignTarget.id ? { ...p, ...updates } : p));
      setStatusMsg({
        type: 'success',
        text: `${reassignTarget.email} reassigned to ${reassignRole.replace('_', ' ')} (${reassignFacility}) — no account recreation needed.`,
      });
      setReassignTarget(null);
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to reassign role & facility.' });
    } finally {
      setIsReassigning(false);
    }
  };

  // Brand Inquiries State
  const [inquiries, setInquiries] = useState<any[]>([]);

  // Fetch profiles, companies & brand inquiries
  const loadData = async () => {
    setIsLoading(true);
    try {
      if (isRealSupabase) {
        // Fetch profiles with joined companies
        const { data: profData } = await supabase
          .from('profiles')
          .select('*, companies(id, name, code)')
          .order('created_at', { ascending: false });

        if (profData) {
          const mapped = profData.map((p: any) => ({
            ...p,
            customer_name: p.companies?.name || p.customer_name,
            company_id: p.company_id || p.companies?.id,
            status: p.status || (p.deactivated ? 'suspended' : 'active'),
          }));
          setProfiles(mapped);
        }

        // Fetch active customer companies for dropdown
        const { data: compData } = await supabase
          .from('companies')
          .select('id, name, code, company_type, status')
          .eq('company_type', 'Customer')
          .eq('status', 'Active')
          .order('name');

        if (compData) {
          setCompanies(compData);
        }

        // Fetch pending brand inquiries submitted via /contact
        const { data: inqData } = await supabase
          .from('apply_submissions')
          .select('*')
          .eq('submission_type', 'brand_inquiry')
          .order('created_at', { ascending: false });

        if (inqData) {
          setInquiries(inqData);
        }
      } else {
        // Mock fallback
        setProfiles(getMockProfiles().map(p => ({ ...p, status: p.status || 'active' })));
        setCompanies([
          { id: 'comp-1', name: 'Levi Strauss & Co.', company_type: 'Customer', status: 'Active' },
          { id: 'comp-2', name: 'Zara Denim', company_type: 'Customer', status: 'Active' },
          { id: 'comp-3', name: 'Patagonia Apparel', company_type: 'Customer', status: 'Active' },
        ]);
        setInquiries([
          {
            id: 'inq-101',
            company_name: 'Apex Denim Co.',
            contact_name: 'Sarah Connor',
            contact_email: 'sarah@apexdenim.com',
            contact_phone: '+1 555-0192',
            client_notes: 'Looking for 500 pcs custom selvedge denim run.',
            status: 'pending_review',
            created_at: new Date().toISOString(),
          }
        ]);
      }
    } catch (e: any) {
      console.error('Error loading profiles or companies:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Close combobox dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (comboboxRef.current && !comboboxRef.current.contains(e.target as Node)) {
        setShowCompanyDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filtered Profiles
  const filteredProfiles = useMemo(() => {
    return profiles.filter((p) => {
      // Exclude purged/deactivated dummy test accounts
      if (p.deactivated || p.customer_name === 'DEACTIVATED_TEST_ACCOUNT' || p.full_name === 'DEACTIVATED') {
        return false;
      }

      const q = searchQuery.toLowerCase().trim();
      const matchSearch = !q || 
        p.email?.toLowerCase().includes(q) || 
        p.full_name?.toLowerCase().includes(q) ||
        p.customer_name?.toLowerCase().includes(q) ||
        p.role?.toLowerCase().includes(q);

      const matchRole = roleFilter === 'all' || p.role === roleFilter;
      const matchStatus = statusFilter === 'all' || p.status === statusFilter;

      return matchSearch && matchRole && matchStatus;
    });
  }, [profiles, searchQuery, roleFilter, statusFilter]);

  // Searchable companies list for combobox
  const filteredCompanies = useMemo(() => {
    if (!companySearch.trim()) return companies;
    const q = companySearch.toLowerCase().trim();
    return companies.filter(c => c.name.toLowerCase().includes(q) || c.code?.toLowerCase().includes(q));
  }, [companies, companySearch]);

  // Whether the current combobox input matches any existing company
  const isNewBrand = companySearch.trim().length > 0 && filteredCompanies.length === 0;
  // The company is resolved (either existing id selected, or new brand name typed)
  const companyResolved = !!inviteCompanyId || (isNewBrand && companySearch.trim().length > 0);

  // Handle Invite Form Submission
  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteFormError('');

    if (!inviteEmail.trim() || !inviteEmail.includes('@')) {
      setInviteFormError('Please enter a valid email address.');
      return;
    }
    if (!inviteFullName.trim()) {
      setInviteFormError('Please enter the user\'s full name.');
      return;
    }

    // HARD CLIENT-SIDE VALIDATION: Customer role MUST have a company selected or new brand typed
    if (inviteRole === 'customer' && !inviteCompanyId && !companySearch.trim()) {
      setInviteFormError('CRITICAL: A company selection or new brand name is strictly required for Customer role invites.');
      return;
    }

    setIsSubmittingInvite(true);

    try {
      const selectedComp = companies.find(c => c.id === inviteCompanyId);
      const resolvedName = selectedComp?.name || (companySearch.trim() ? companySearch.trim() : undefined);
      const tempPass = generateTemporaryPassword();

      // Dispatch via production email service (Resend / Supabase Auth / Secure Link)
      const result = await sendAccountInviteEmail({
        recipientEmail: inviteEmail.trim(),
        recipientName: inviteFullName.trim(),
        role: inviteRole,
        companyName: resolvedName,
        companyId: inviteRole === 'customer' ? inviteCompanyId || undefined : undefined,
        facilityScope: inviteRole === 'customer' ? undefined : inviteFacility,
        temporaryPassword: tempPass,
      });

      setInviteResult(result);
      setStatusMsg({ type: 'success', text: `Account for ${inviteEmail.trim()} created & credentials generated!` });

      setShowInviteModal(false);
      // Reset form
      setInviteEmail('');
      setInviteFullName('');
      setInviteRole('merchandiser');
      setInviteFacility('All');
      setInviteCompanyId('');
      setCompanySearch('');
      setShowCompanyDropdown(false);
      loadData();
    } catch (err: any) {
      console.error("Invite dispatch error:", err);
      setStatusMsg({ type: 'error', text: `Failed to create invite: ${err.message}` });
    } finally {
      setIsSubmittingInvite(false);
    }
  };

  // Toggle Suspend / Reactivate User
  const handleToggleStatus = async (profile: Profile) => {
    const newStatus = profile.status === 'suspended' ? 'active' : 'suspended';
    const actionLabel = newStatus === 'suspended' ? 'suspend' : 'reactivate';

    if (!window.confirm(`Are you sure you want to ${actionLabel} ${profile.email}?`)) return;

    setUpdatingId(profile.id);
    setStatusMsg(null);

    try {
      if (isRealSupabase) {
        const { error } = await supabase
          .from('profiles')
          .update({ status: newStatus, deactivated: newStatus === 'suspended' })
          .eq('id', profile.id);

        if (error) throw error;
      } else {
        const updated = profiles.map(p => p.id === profile.id ? { ...p, status: newStatus as any } : p);
        setProfiles(updated);
        saveMockProfiles(updated);
      }

      setProfiles(prev => prev.map(p => p.id === profile.id ? { ...p, status: newStatus as any } : p));
      setStatusMsg({ type: 'success', text: `User ${profile.email} has been ${newStatus}.` });
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || `Failed to ${actionLabel} user.` });
    } finally {
      setUpdatingId(null);
    }
  };

  // Resend Invite Action / Regenerate Credentials
  const handleResendInvite = async (profile: Profile) => {
    setUpdatingId(profile.id);
    setStatusMsg(null);
    try {
      const tempPass = generateTemporaryPassword();
      const result = await sendAccountInviteEmail({
        recipientEmail: profile.email,
        recipientName: profile.full_name || profile.email.split('@')[0],
        role: profile.role,
        companyName: profile.customer_name,
        temporaryPassword: tempPass,
      });

      setInviteResult(result);
      setStatusMsg({ type: 'success', text: `Invitation credentials regenerated for ${profile.email}!` });
      loadData();
    } catch (err: any) {
      console.error(err);
      setStatusMsg({ type: 'error', text: `Failed to resend invite: ${err.message}` });
    } finally {
      setUpdatingId(null);
    }
  };

  // Role Badges Styling
  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'super_admin':
      case 'admin':
        return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'merchandiser':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'production_manager':
      case 'production':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'cutting_supervisor':
      case 'sewing_supervisor':
        return 'bg-indigo-100 text-indigo-800 border-indigo-300';
      case 'qc_inspector':
      case 'qc':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'warehouse':
        return 'bg-cyan-100 text-cyan-800 border-cyan-300';
      case 'finance':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'customer':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      default:
        return 'bg-neutral-100 text-neutral-800 border-neutral-300';
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner Message */}
      {statusMsg && (
        <div className={`p-4 rounded-xl text-sm flex items-center justify-between border ${
          statusMsg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-800 border-red-200'
        }`}>
          <div className="flex items-center gap-2">
            {statusMsg.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
            <span>{statusMsg.text}</span>
          </div>
          <button onClick={() => setStatusMsg(null)} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            User Management &amp; Role-Based Provisioning
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Admin-only invite system. Public self-registration is disabled per ERP security policy.
          </p>
        </div>

        <button
          onClick={() => setShowInviteModal(true)}
          className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-4 py-2 rounded-xl text-sm flex items-center gap-2 shadow-sm transition-all"
        >
          <UserPlus className="h-4 w-4" /> Invite New User
        </button>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3 bg-muted/30 p-3 rounded-2xl border">
        <div className="relative flex-1 w-full">
          <Search className="h-4 w-4 absolute left-3 top-2.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search users by name, email, brand, or role..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-background border rounded-lg text-sm"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="bg-background border rounded-lg px-3 py-1.5 text-xs font-semibold text-foreground"
          >
            <option value="all">All Roles</option>
            <option value="super_admin">Super Admin</option>
            <option value="admin">Admin</option>
            <option value="merchandiser">Merchandiser</option>
            <option value="production_manager">Production Manager</option>
            <option value="cutting_supervisor">Cutting Supervisor</option>
            <option value="sewing_supervisor">Sewing Supervisor</option>
            <option value="qc_inspector">QC Inspector</option>
            <option value="warehouse">Warehouse</option>
            <option value="finance">Finance</option>
            <option value="customer">Customer</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-background border rounded-lg px-3 py-1.5 text-xs font-semibold text-foreground"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="invited">Invited</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>
      </div>

      {/* Brand Access Inquiries Section */}
      {inquiries.length > 0 && (
        <div className="bg-amber-50/60 border border-amber-200 rounded-2xl p-5 space-y-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-xs uppercase tracking-wider text-amber-900 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-amber-700" />
              Incoming Brand Access Inquiries ({inquiries.length})
            </h3>
            <span className="text-[11px] text-amber-800 font-semibold bg-amber-100 px-2 py-0.5 rounded-full">
              Submitted via /contact page
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {inquiries.map((inq) => (
              <div key={inq.id} className="p-4 bg-white rounded-xl border border-amber-200 shadow-2xs space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-sm text-neutral-900">{inq.company_name || 'Brand Inquiry'}</h4>
                    <p className="text-xs text-neutral-600 font-medium">{inq.contact_name} ({inq.contact_email})</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setInviteFullName(inq.contact_name || '');
                      setInviteEmail(inq.contact_email || '');
                      setInviteRole('customer');
                      setShowInviteModal(true);
                    }}
                    className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-1 transition-all cursor-pointer"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    <span>Provision Invite</span>
                  </button>
                </div>

                {inq.client_notes && (
                  <p className="text-[11px] text-neutral-500 line-clamp-2 bg-neutral-50 p-2 rounded-lg italic">
                    "{inq.client_notes}"
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-card border rounded-2xl overflow-hidden shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/40 border-b">
            <tr>
              <th className="px-5 py-3 font-bold text-muted-foreground uppercase text-xs">User / Email</th>
              <th className="px-5 py-3 font-bold text-muted-foreground uppercase text-xs">System Role</th>
              <th className="px-5 py-3 font-bold text-muted-foreground uppercase text-xs">Company / Brand</th>
              <th className="px-5 py-3 font-bold text-muted-foreground uppercase text-xs">Status</th>
              <th className="px-5 py-3 font-bold text-muted-foreground uppercase text-xs text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-muted-foreground">
                  <div className="h-5 w-5 border-2 border-primary border-t-transparent animate-spin rounded-full mx-auto mb-2" />
                  Loading provisioned users...
                </td>
              </tr>
            ) : filteredProfiles.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-muted-foreground">
                  No users match the active filter criteria.
                </td>
              </tr>
            ) : (
              filteredProfiles.map((p) => (
                <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-5 py-4">
                    <div className="font-bold text-foreground">{p.full_name || p.email.split('@')[0]}</div>
                    <div className="text-xs text-muted-foreground font-mono flex items-center gap-1">
                      <Mail className="h-3 w-3" /> {p.email}
                    </div>
                  </td>

                  <td className="px-5 py-4">
                    <span className={`px-2.5 py-1 rounded-full border text-[11px] font-bold uppercase tracking-wider ${getRoleBadge(p.role)}`}>
                      {p.role.replace('_', ' ')}
                    </span>
                  </td>

                  <td className="px-5 py-4">
                    {p.role === 'customer' ? (
                      <span className="font-bold text-primary flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5" />
                        {p.customer_name || 'Unassigned'}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <MapPin className="h-3 w-3" /> {p.facility_scope || 'All'}
                      </span>
                    )}
                  </td>

                  <td className="px-5 py-4">
                    {p.status === 'invited' ? (
                      <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 w-max">
                        <Clock className="h-3 w-3 animate-pulse" /> Invited
                      </span>
                    ) : p.status === 'suspended' ? (
                      <span className="px-2.5 py-1 rounded-full bg-red-50 text-red-800 border border-red-200 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 w-max">
                        <UserX className="h-3 w-3" /> Suspended
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 w-max">
                        <CheckCircle2 className="h-3 w-3" /> Active
                      </span>
                    )}
                  </td>

                  <td className="px-5 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {p.status === 'invited' && (
                        <button
                          onClick={() => handleResendInvite(p)}
                          disabled={updatingId === p.id}
                          className="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 text-xs font-bold rounded-lg transition-all flex items-center gap-1"
                          title="Resend invitation email"
                        >
                          <RefreshCw className={`h-3.5 w-3.5 ${updatingId === p.id ? 'animate-spin' : ''}`} /> Resend
                        </button>
                      )}

                      <button
                        onClick={() => openReassignModal(p)}
                        disabled={updatingId === p.id}
                        className="px-2.5 py-1 bg-sky-500/10 hover:bg-sky-500/20 text-sky-700 text-xs font-bold rounded-lg transition-all flex items-center gap-1"
                        title="Change role & facility without recreating the account"
                      >
                        <Pencil className="h-3.5 w-3.5" /> Reassign
                      </button>

                      <button
                        onClick={() => handleToggleStatus(p)}
                        disabled={updatingId === p.id}
                        className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-all flex items-center gap-1 ${
                          p.status === 'suspended'
                            ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-300'
                            : 'bg-red-50 hover:bg-red-100 text-red-700 border-red-300'
                        }`}
                      >
                        {p.status === 'suspended' ? (
                          <>
                            <UserCheck className="h-3.5 w-3.5" /> Reactivate
                          </>
                        ) : (
                          <>
                            <UserX className="h-3.5 w-3.5" /> Suspend
                          </>
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* INVITE USER MODAL */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl space-y-6 animate-in fade-in zoom-in duration-150">
            
            <div className="flex items-center justify-between border-b pb-4">
              <div>
                <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
                  <UserPlus className="h-5 w-5 text-primary" /> Invite New User
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Sends an invitation email and provisions a role-scoped account.
                </p>
              </div>
              <button
                onClick={() => setShowInviteModal(false)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {inviteFormError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 font-medium flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{inviteFormError}</span>
              </div>
            )}

            <form onSubmit={handleInviteSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sarah Jenkins"
                  value={inviteFullName}
                  onChange={(e) => setInviteFullName(e.target.value)}
                  className="w-full p-2.5 border rounded-xl bg-background text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. s.jenkins@brand.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full p-2.5 border rounded-xl bg-background text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                  System Role <span className="text-red-500">*</span>
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => {
                    setInviteRole(e.target.value);
                    if (e.target.value !== 'customer') setInviteCompanyId('');
                  }}
                  className="w-full p-2.5 border rounded-xl bg-background text-sm font-semibold"
                >
                  <option value="merchandiser">Merchandiser</option>
                  <option value="production_manager">Production Manager</option>
                  <option value="cutting_supervisor">Cutting Supervisor</option>
                  <option value="sewing_supervisor">Sewing Supervisor</option>
                  <option value="qc_inspector">QC Inspector</option>
                  <option value="warehouse">Warehouse / Dispatch</option>
                  <option value="finance">Finance</option>
                  <option value="customer">Customer (Brand Portal)</option>
                  <option value="admin">Admin</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </div>

              {/* FACILITY SCOPE — internal staff only (customer roles are scoped by company, not facility) */}
              {inviteRole !== 'customer' && (
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1 flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" /> Facility Scope
                  </label>
                  <select
                    value={inviteFacility}
                    onChange={(e) => setInviteFacility(e.target.value)}
                    className="w-full p-2.5 border rounded-xl bg-background text-sm font-semibold"
                  >
                    {FACILITY_OPTIONS.map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* CONDITIONAL COMPANY COMBOBOX FOR CUSTOMER ROLE */}
              {inviteRole === 'customer' && (
                <div className="p-4 bg-orange-50/50 border border-orange-200 rounded-2xl space-y-2 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black uppercase tracking-wider text-orange-900 flex items-center gap-1.5">
                      <Building2 className="h-4 w-4 text-orange-600" />
                      Assigned Brand / Company <span className="text-red-500">* (REQUIRED)</span>
                    </label>
                    <span className="text-[10px] text-orange-700 font-semibold bg-orange-100 px-2 py-0.5 rounded-full">
                      Customer Scope
                    </span>
                  </div>

                  <p className="text-xs text-orange-800">
                    {isNewBrand
                      ? 'No matching company found — this brand name will be saved as entered.'
                      : 'Type to search existing companies, or enter a new brand name.'}
                  </p>

                  {/* Custom combobox */}
                  <div ref={comboboxRef} className="relative">
                    <div className={`flex items-center gap-2 p-2.5 border-2 rounded-xl bg-background transition-colors ${
                      inviteCompanyId
                        ? 'border-emerald-400'
                        : isNewBrand
                        ? 'border-blue-400'
                        : 'border-orange-400'
                    }`}>
                      <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                      <input
                        type="text"
                        placeholder="Type to search or add brand..."
                        value={companySearch}
                        onChange={(e) => {
                          setCompanySearch(e.target.value);
                          setInviteCompanyId(''); // clear selected id when typing
                          setShowCompanyDropdown(true);
                        }}
                        onFocus={() => setShowCompanyDropdown(true)}
                        className="flex-1 bg-transparent text-sm outline-none font-semibold text-foreground placeholder:font-normal placeholder:text-muted-foreground"
                      />
                      {(inviteCompanyId || companySearch) && (
                        <button
                          type="button"
                          onClick={() => {
                            setInviteCompanyId('');
                            setCompanySearch('');
                            setShowCompanyDropdown(false);
                          }}
                          className="text-muted-foreground hover:text-foreground p-0.5 rounded"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Dropdown suggestions */}
                    {showCompanyDropdown && companySearch.trim() && (
                      <div className="absolute z-50 w-full mt-1 bg-background border border-border rounded-xl shadow-lg overflow-hidden">
                        {filteredCompanies.length > 0 ? (
                          <ul className="max-h-48 overflow-y-auto py-1">
                            {filteredCompanies.map((c) => (
                              <li
                                key={c.id}
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  setInviteCompanyId(c.id);
                                  setCompanySearch(c.name);
                                  setShowCompanyDropdown(false);
                                }}
                                className="px-3 py-2 text-sm cursor-pointer hover:bg-muted flex items-center justify-between group"
                              >
                                <span className="font-semibold text-foreground">{c.name}</span>
                                {c.code && (
                                  <span className="text-[10px] text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">
                                    {c.code}
                                  </span>
                                )}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <div className="px-3 py-3 text-xs">
                            <div className="flex items-center gap-2 text-blue-700 font-semibold">
                              <Building2 className="h-4 w-4" />
                              New brand: &ldquo;{companySearch.trim()}&rdquo;
                            </div>
                            <p className="text-muted-foreground mt-0.5">This name will be saved directly.</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Status hint */}
                  {inviteCompanyId ? (
                    <p className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Existing company selected.
                    </p>
                  ) : isNewBrand ? (
                    <p className="text-[11px] text-blue-700 font-semibold flex items-center gap-1">
                      <Building2 className="h-3 w-3" /> New brand &ldquo;{companySearch.trim()}&rdquo; will be created.
                    </p>
                  ) : (
                    <p className="text-[11px] text-red-600 font-semibold flex items-center gap-1">
                      <Lock className="h-3 w-3" /> Type a brand name or select an existing company to continue.
                    </p>
                  )}
                </div>
              )}

              <div className="pt-4 flex items-center justify-end gap-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-4 py-2.5 border bg-background rounded-xl text-sm font-bold hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingInvite || (inviteRole === 'customer' && !companyResolved)}
                  className="px-5 py-2.5 bg-primary text-primary-foreground font-bold rounded-xl text-sm hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
                >
                  {isSubmittingInvite && <div className="h-4 w-4 border-2 border-primary-foreground border-t-transparent animate-spin rounded-full" />}
                  Send Invitation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REQ-01: DYNAMIC ROLE & FACILITY REASSIGNMENT MODAL */}
      {reassignTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl space-y-6 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b pb-4">
              <div>
                <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <Pencil className="h-5 w-5 text-primary" /> Reassign Role &amp; Facility
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {reassignTarget.full_name || reassignTarget.email} — instant reassignment, no account recreation.
                </p>
              </div>
              <button
                onClick={() => setReassignTarget(null)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleReassignSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                  System Role
                </label>
                <select
                  value={reassignRole}
                  onChange={(e) => setReassignRole(e.target.value)}
                  className="w-full p-2.5 border rounded-xl bg-background text-sm font-semibold"
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>

              {reassignRole !== 'customer' && (
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1 flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" /> Facility Scope
                  </label>
                  <select
                    value={reassignFacility}
                    onChange={(e) => setReassignFacility(e.target.value)}
                    className="w-full p-2.5 border rounded-xl bg-background text-sm font-semibold"
                  >
                    {FACILITY_OPTIONS.map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="pt-4 flex items-center justify-end gap-3 border-t">
                <button
                  type="button"
                  onClick={() => setReassignTarget(null)}
                  className="px-4 py-2.5 border bg-background rounded-xl text-sm font-bold hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isReassigning}
                  className="px-5 py-2.5 bg-primary text-primary-foreground font-bold rounded-xl text-sm hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
                >
                  {isReassigning && <div className="h-4 w-4 border-2 border-primary-foreground border-t-transparent animate-spin rounded-full" />}
                  Save Reassignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* INVITATION DISPATCH CONFIRMATION MODAL */}
      {inviteResult && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border-2 border-primary/40 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between border-b pb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-600">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-display font-black text-lg text-foreground">
                    Account Created &amp; Invite Ready
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Authorized login credentials generated for Forge &amp; Fabric Industries, Inc.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setInviteResult(null)}
                className="text-muted-foreground hover:text-foreground p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-muted/40 rounded-2xl border space-y-3 font-mono text-xs">
                <div className="flex justify-between items-center py-1 border-b border-border/50">
                  <span className="text-muted-foreground font-sans font-medium">User / Recipient:</span>
                  <span className="font-bold text-foreground font-mono">{inviteResult.formattedMessage.match(/• Email:\s*([^\s\n]+)/)?.[1] || 'New Account'}</span>
                </div>
                {inviteResult.temporaryPassword && (
                  <div className="flex justify-between items-center py-1 border-b border-border/50">
                    <span className="text-muted-foreground font-sans font-medium">Temporary Password:</span>
                    <span className="font-bold text-primary font-mono text-sm bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
                      {inviteResult.temporaryPassword}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center py-1">
                  <span className="text-muted-foreground font-sans font-medium">Login Portal URL:</span>
                  <span className="text-foreground truncate max-w-[220px] font-mono">{inviteResult.loginUrl}</span>
                </div>
              </div>

              <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-900 flex items-start gap-2.5">
                <Mail className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  <strong>Delivery Status:</strong> {inviteResult.deliveryMethod === 'resend_api' ? 'Delivered via Resend Email API' : 'Account is active in Supabase. You can also copy the invitation message below to send directly via Email, Slack, or WhatsApp.'}
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(inviteResult.formattedMessage);
                    setHasCopiedText(true);
                    setTimeout(() => setHasCopiedText(false), 2500);
                  }}
                  className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border transition-all ${
                    hasCopiedText 
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-md' 
                      : 'bg-muted hover:bg-muted/80 text-foreground border-border'
                  }`}
                >
                  {hasCopiedText ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {hasCopiedText ? 'Invitation Copied!' : 'Copy Full Invite Text'}
                </button>

                <button
                  type="button"
                  onClick={() => setInviteResult(null)}
                  className="py-3 px-6 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl text-xs shadow-sm transition-all"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
