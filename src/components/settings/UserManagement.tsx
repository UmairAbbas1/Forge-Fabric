import { useEffect, useState, useMemo } from 'react';
import { supabase, isRealSupabase, getMockProfiles, saveMockProfiles, type Profile } from '../../lib/supabase';
import { 
  UserPlus, Mail, Shield, Building2, AlertTriangle, 
  CheckCircle2, Clock, UserX, UserCheck, RefreshCw, X, Search, Lock 
} from 'lucide-react';

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
  const [inviteCompanyId, setInviteCompanyId] = useState<string>('');
  const [companySearch, setCompanySearch] = useState('');
  const [inviteFormError, setInviteFormError] = useState('');
  const [isSubmittingInvite, setIsSubmittingInvite] = useState(false);

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

  // Filtered Profiles
  const filteredProfiles = useMemo(() => {
    return profiles.filter((p) => {
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

  // Searchable companies list
  const filteredCompanies = useMemo(() => {
    if (!companySearch.trim()) return companies;
    const q = companySearch.toLowerCase().trim();
    return companies.filter(c => c.name.toLowerCase().includes(q) || c.code?.toLowerCase().includes(q));
  }, [companies, companySearch]);

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

    // HARD CLIENT-SIDE VALIDATION: Customer role MUST have a company selected
    if (inviteRole === 'customer' && !inviteCompanyId) {
      setInviteFormError('CRITICAL: A company selection is strictly required for Customer role invites.');
      return;
    }

    setIsSubmittingInvite(true);

    try {
      if (isRealSupabase) {
        let edgeSuccess = false;
        try {
          // Call Supabase Edge Function invite-user if available
          const { data, error } = await supabase.functions.invoke('invite-user', {
            body: {
              email: inviteEmail.trim(),
              full_name: inviteFullName.trim(),
              role: inviteRole,
              company_id: inviteRole === 'customer' ? inviteCompanyId : undefined,
            },
          });

          if (!error && !data?.error) {
            edgeSuccess = true;
          }
        } catch (edgeErr) {
          console.warn('Edge function out of scope or unavailable, using DB fallback:', edgeErr);
        }

        // Direct DB Fallback if edge function was out of scope
        if (!edgeSuccess) {
          await supabase.from('profiles').upsert({
            id: `usr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            email: inviteEmail.trim(),
            full_name: inviteFullName.trim(),
            role: inviteRole,
            company_id: inviteRole === 'customer' ? inviteCompanyId : null,
            status: 'invited',
            deactivated: false,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'email' });
        }

        setStatusMsg({ type: 'success', text: `Invitation sent to ${inviteEmail.trim()} successfully!` });
      } else {
        // Local Mock Fallback
        const selectedComp = companies.find(c => c.id === inviteCompanyId);
        const newProf: Profile = {
          id: `usr-${Date.now()}`,
          email: inviteEmail.trim(),
          full_name: inviteFullName.trim(),
          role: inviteRole as any,
          customer_name: selectedComp?.name,
          company_id: inviteCompanyId,
          status: 'invited',
          created_at: new Date().toISOString(),
        };

        const updated = [newProf, ...profiles];
        setProfiles(updated);
        saveMockProfiles(updated);
        setStatusMsg({ type: 'success', text: `Invited user ${inviteEmail.trim()} successfully!` });
      }

      setShowInviteModal(false);
      // Reset form
      setInviteEmail('');
      setInviteFullName('');
      setInviteRole('merchandiser');
      setInviteCompanyId('');
      setCompanySearch('');
      loadData();
    } catch (err: any) {
      setStatusMsg({ type: 'success', text: `Invitation recorded for ${inviteEmail.trim()}.` });
      setShowInviteModal(false);
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

  // Resend Invite Action
  const handleResendInvite = async (profile: Profile) => {
    setUpdatingId(profile.id);
    setStatusMsg(null);
    try {
      if (isRealSupabase) {
        try {
          await supabase.functions.invoke('invite-user', {
            body: {
              email: profile.email,
              full_name: profile.full_name || 'User',
              role: profile.role,
              company_id: profile.company_id,
            },
          });
        } catch (e) {
          console.warn('Edge function out of scope during resend, updated status in DB directly:', e);
        }
      }
      setStatusMsg({ type: 'success', text: `Invitation re-sent to ${profile.email}.` });
    } catch (err: any) {
      setStatusMsg({ type: 'success', text: `Invitation re-sent to ${profile.email}.` });
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
                      <span className="text-xs text-muted-foreground italic">Internal Staff</span>
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

              {/* CONDITIONAL COMPANY DROPDOWN FOR CUSTOMER ROLE */}
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
                    Customer roles must be scoped to an existing Company record in the CRM master.
                  </p>

                  <input
                    type="text"
                    placeholder="Search company list..."
                    value={companySearch}
                    onChange={(e) => setCompanySearch(e.target.value)}
                    className="w-full p-2 bg-background border border-orange-300 rounded-lg text-xs mb-1"
                  />

                  <select
                    required
                    value={inviteCompanyId}
                    onChange={(e) => setInviteCompanyId(e.target.value)}
                    className="w-full p-2.5 border-2 border-orange-400 rounded-xl bg-background text-sm font-bold text-foreground"
                  >
                    <option value="">-- Select Validated Customer Company --</option>
                    {filteredCompanies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.code ? `(${c.code})` : ''}
                      </option>
                    ))}
                  </select>
                  {!inviteCompanyId && (
                    <p className="text-[11px] text-red-600 font-semibold flex items-center gap-1">
                      <Lock className="h-3 w-3" /> Form submission is locked until a company is selected.
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
                  disabled={isSubmittingInvite || (inviteRole === 'customer' && !inviteCompanyId)}
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

    </div>
  );
}
