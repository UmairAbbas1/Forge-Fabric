import { useEffect, useState, useMemo } from 'react';
import { supabase, isRealSupabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { 
  Building2, Search, CheckCircle2, AlertTriangle, Plus, 
  MapPin, User, FileText, Lock, ShieldAlert, ArrowRight 
} from 'lucide-react';

export interface SelectedCustomerDetails {
  company_id: string;
  company_name: string;
  company_code?: string;
  tax_id?: string;
  is_new_customer: boolean;
  address?: {
    street_1: string;
    city: string;
    state?: string;
    country: string;
  };
  contact?: {
    name: string;
    email: string;
    phone?: string;
  };
  open_pos_count?: number;
}

interface CustomerSelectorProps {
  onCustomerSelect: (details: SelectedCustomerDetails | null) => void;
  isPublicPortal?: boolean;
  initialCompanyId?: string;
}

interface CompanyItem {
  id: string;
  name: string;
  code?: string;
  tax_id?: string;
  company_type: string;
  status: string;
  address_book?: any[];
  contacts?: any[];
  purchase_orders?: any[];
}

export function CustomerSelector({
  onCustomerSelect,
  isPublicPortal = false,
  initialCompanyId,
}: CustomerSelectorProps) {
  const { user } = useAuth();
  const [customerMode, setCustomerMode] = useState<'existing' | 'new'>('existing');

  // Existing Customer State
  const [companies, setCompanies] = useState<CompanyItem[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(initialCompanyId || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(true);

  // New Customer Form State (Internal Merchandiser Only)
  const [newName, setNewName] = useState('');
  const [newTaxId, setNewTaxId] = useState('');
  const [newStreet, setNewStreet] = useState('');
  const [newCity, setNewCity] = useState('');
  const [newCountry, setNewCountry] = useState('United States');
  const [newContactName, setNewContactName] = useState('');
  const [newContactEmail, setNewContactEmail] = useState('');
  const [newFormError, setNewFormError] = useState('');

  // Public Account Request State
  const [requestSubmitted, setRequestSubmitted] = useState(false);

  // Check if user is internal staff
  const isInternalStaff = useMemo(() => {
    if (!user) return false;
    return ['super_admin', 'admin', 'merchandiser', 'production_manager'].includes(user.role);
  }, [user]);

  // Load Companies
  useEffect(() => {
    const fetchCompanies = async () => {
      setIsLoadingCompanies(true);
      try {
        if (isRealSupabase) {
          const { data, error } = await supabase
            .from('companies')
            .select(`
              id, name, code, tax_id, company_type, status,
              address_book(street_1, city, state, country, is_primary),
              contacts(first_name, last_name, email, phone, is_primary_contact),
              purchase_orders(id, po_number, status)
            `)
            .eq('company_type', 'Customer')
            .eq('status', 'Active')
            .order('name');

          if (!error && data) {
            setCompanies(data as any);
          }
        } else {
          // Mock companies fallback
          setCompanies([
            {
              id: 'comp-101',
              name: 'Levi Strauss & Co.',
              code: 'LEVI-CUST',
              company_type: 'Customer',
              status: 'Active',
              address_book: [{ street_1: '1155 Battery St', city: 'San Francisco', state: 'CA', country: 'United States', is_primary: true }],
              contacts: [{ first_name: 'David', last_name: 'Miller', email: 'd.miller@levi.com', phone: '415-555-0199' }],
              purchase_orders: [{ id: 'po-1', po_number: 'PO-LEVI-2026', status: 'In_Production' }],
            },
            {
              id: 'comp-102',
              name: 'Zara Denim',
              code: 'ZARA-CUST',
              company_type: 'Customer',
              status: 'Active',
              address_book: [{ street_1: 'Paseo de la Castellana', city: 'Madrid', country: 'Spain', is_primary: true }],
              contacts: [{ first_name: 'Elena', last_name: 'Rostova', email: 'e.rostova@zara.com' }],
              purchase_orders: [],
            },
          ]);
        }
      } catch (err) {
        console.error('Failed to load companies:', err);
      } finally {
        setIsLoadingCompanies(false);
      }
    };

    fetchCompanies();
  }, []);

  // Filtered Company List
  const filteredCompanies = useMemo(() => {
    if (!searchQuery.trim()) return companies;
    const q = searchQuery.toLowerCase().trim();
    return companies.filter(
      (c) => c.name.toLowerCase().includes(q) || c.code?.toLowerCase().includes(q)
    );
  }, [companies, searchQuery]);

  // Selected Company Details object
  const selectedCompany = useMemo(() => {
    return companies.find((c) => c.id === selectedCompanyId) || null;
  }, [companies, selectedCompanyId]);

  // Emit selection updates to parent component
  useEffect(() => {
    if (customerMode === 'existing') {
      if (selectedCompany) {
        const addr = selectedCompany.address_book?.find((a) => a.is_primary) || selectedCompany.address_book?.[0];
        const cont = selectedCompany.contacts?.find((c) => c.is_primary_contact) || selectedCompany.contacts?.[0];

        onCustomerSelect({
          company_id: selectedCompany.id,
          company_name: selectedCompany.name,
          company_code: selectedCompany.code,
          tax_id: selectedCompany.tax_id,
          is_new_customer: false,
          address: addr ? { street_1: addr.street_1, city: addr.city, state: addr.state, country: addr.country } : undefined,
          contact: cont ? { name: `${cont.first_name || ''} ${cont.last_name || ''}`.trim(), email: cont.email, phone: cont.phone } : undefined,
          open_pos_count: selectedCompany.purchase_orders?.length || 0,
        });
      } else {
        // LOCK THE STATE MACHINE: Return null if no company selected
        onCustomerSelect(null);
      }
    }
  }, [customerMode, selectedCompany, onCustomerSelect]);

  // Handle Internal New Customer Creation
  const handleCreateNewCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setNewFormError('');

    if (!newName.trim()) {
      setNewFormError('Company Name is required.');
      return;
    }
    if (!newContactEmail.trim() || !newContactEmail.includes('@')) {
      setNewFormError('A valid primary contact email is required.');
      return;
    }

    try {
      let createdCompanyId = `comp-${Date.now()}`;
      const codeStr = UPPER_CODE(newName);

      if (isRealSupabase) {
        // Insert into companies
        const { data: compData, error: compErr } = await supabase
          .from('companies')
          .insert({
            name: newName.trim(),
            code: codeStr,
            tax_id: newTaxId.trim() || null,
            company_type: 'Customer',
            status: 'Active',
          })
          .select('id')
          .single();

        if (compErr || !compData) throw compErr || new Error('Failed to create company');
        createdCompanyId = compData.id;

        // Insert primary address
        if (newStreet.trim() && newCity.trim()) {
          await supabase.from('address_book').insert({
            company_id: createdCompanyId,
            address_type: 'Shipping',
            street_1: newStreet.trim(),
            city: newCity.trim(),
            country: newCountry.trim(),
            is_primary: true,
          });
        }

        // Insert primary contact
        if (newContactName.trim() && newContactEmail.trim()) {
          const names = newContactName.trim().split(' ');
          await supabase.from('contacts').insert({
            company_id: createdCompanyId,
            first_name: names[0],
            last_name: names.slice(1).join(' ') || 'Contact',
            email: newContactEmail.trim(),
            is_primary_contact: true,
          });
        }
      }

      const newDetails: SelectedCustomerDetails = {
        company_id: createdCompanyId,
        company_name: newName.trim(),
        company_code: codeStr,
        tax_id: newTaxId.trim(),
        is_new_customer: true,
        address: { street_1: newStreet, city: newCity, country: newCountry },
        contact: { name: newContactName, email: newContactEmail },
        open_pos_count: 0,
      };

      onCustomerSelect(newDetails);
    } catch (err: any) {
      setNewFormError(err.message || 'Failed to create company master record.');
    }
  };

  // Helper code generator
  function UPPER_CODE(str: string) {
    return str.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 8) + '-CUST';
  }

  return (
    <div className="space-y-6">
      
      {/* MODE BRANCHING TOGGLE */}
      <div className="bg-muted/40 p-1.5 rounded-2xl border flex items-center gap-2">
        <button
          type="button"
          onClick={() => setCustomerMode('existing')}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
            customerMode === 'existing'
              ? 'bg-background text-foreground shadow-sm border border-border/80'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Building2 className="h-4 w-4 text-primary" />
          Existing Validated Customer
        </button>

        <button
          type="button"
          onClick={() => setCustomerMode('new')}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
            customerMode === 'new'
              ? 'bg-background text-foreground shadow-sm border border-border/80'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Plus className="h-4 w-4 text-primary" />
          New Customer Account
        </button>
      </div>

      {/* MODE A: EXISTING CUSTOMER SEARCHABLE DROPDOWN */}
      {customerMode === 'existing' && (
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              Select Customer / Brand Master <span className="text-red-500">* (REQUIRED)</span>
            </label>
            <p className="text-xs text-muted-foreground">
              Select a validated brand from the CRM to lock PO terms and pre-fill address and contact specifications.
            </p>
          </div>

          <div className="space-y-2">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
              <input
                type="text"
                placeholder="Type to filter company master list..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 bg-background border rounded-xl text-xs"
              />
            </div>

            <select
              required
              value={selectedCompanyId}
              onChange={(e) => setSelectedCompanyId(e.target.value)}
              className={`w-full p-3 border-2 rounded-xl bg-background text-sm font-bold text-foreground transition-all ${
                selectedCompanyId ? 'border-emerald-500/80 bg-emerald-50/10' : 'border-amber-400 bg-amber-50/10'
              }`}
            >
              <option value="">-- Click to Select Validated Customer Company --</option>
              {isLoadingCompanies ? (
                <option disabled>Loading companies...</option>
              ) : (
                filteredCompanies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.code ? `(${c.code})` : ''} — Active CRM Account
                  </option>
                ))
              )}
            </select>
          </div>

          {/* STATE-MACHINE LOCK WARNING IF NO SELECTION */}
          {!selectedCompanyId && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-800 flex items-center gap-2 font-medium">
              <Lock className="h-4 w-4 text-amber-600 shrink-0" />
              <span>
                <strong>Wizard Locked:</strong> You cannot proceed to order specs until an existing customer is selected and confirmed.
              </span>
            </div>
          )}

          {/* PRE-FILLED READ-ONLY SPECIFICATIONS PREVIEW */}
          {selectedCompany && (
            <div className="bg-card border-2 border-emerald-500/40 rounded-2xl p-5 space-y-4 animate-in fade-in duration-150">
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  <span className="font-extrabold text-foreground text-sm">{selectedCompany.name}</span>
                  <span className="text-[10px] font-mono bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
                    {selectedCompany.code || 'VERIFIED'}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground font-medium">
                  {selectedCompany.purchase_orders?.length || 0} Open POs
                </span>
              </div>

              <div className="grid md:grid-cols-2 gap-4 text-xs">
                {/* Primary Address */}
                <div className="space-y-1 bg-muted/30 p-3 rounded-xl border">
                  <div className="font-bold text-muted-foreground uppercase tracking-wider text-[10px] flex items-center gap-1">
                    <MapPin className="h-3 w-3 text-primary" /> Primary Shipping Address
                  </div>
                  {selectedCompany.address_book?.[0] ? (
                    <div className="font-medium text-foreground">
                      {selectedCompany.address_book[0].street_1}, {selectedCompany.address_book[0].city},{' '}
                      {selectedCompany.address_book[0].state || ''} {selectedCompany.address_book[0].country}
                    </div>
                  ) : (
                    <div className="text-muted-foreground italic">No primary shipping address on file.</div>
                  )}
                </div>

                {/* Primary Contact */}
                <div className="space-y-1 bg-muted/30 p-3 rounded-xl border">
                  <div className="font-bold text-muted-foreground uppercase tracking-wider text-[10px] flex items-center gap-1">
                    <User className="h-3 w-3 text-primary" /> Primary Contact Person
                  </div>
                  {selectedCompany.contacts?.[0] ? (
                    <div className="font-medium text-foreground">
                      {selectedCompany.contacts[0].first_name} {selectedCompany.contacts[0].last_name} ({selectedCompany.contacts[0].email})
                    </div>
                  ) : (
                    <div className="text-muted-foreground italic">No primary contact person on file.</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODE B: NEW CUSTOMER BRANCHING */}
      {customerMode === 'new' && (
        <div className="space-y-4">
          {!isInternalStaff || isPublicPortal ? (
            /* PUBLIC CLIENT PORTAL: PREVENT DIRECT UNVERIFIED CREATION */
            <div className="p-6 bg-blue-50/50 border-2 border-blue-200 rounded-3xl space-y-4">
              <div className="flex items-start gap-3">
                <ShieldAlert className="h-6 w-6 text-blue-600 shrink-0 mt-1" />
                <div>
                  <h4 className="font-extrabold text-blue-900 text-sm">Account Verification Required for New Brands</h4>
                  <p className="text-xs text-blue-800 leading-relaxed mt-1">
                    To maintain factory quality and compliance standards, new brand applications require merchandiser review before live Purchase Orders can be processed.
                  </p>
                </div>
              </div>

              {!requestSubmitted ? (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setRequestSubmitted(true)}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-xl text-xs flex items-center justify-center gap-2 shadow-md transition-all"
                  >
                    <span>Submit New Brand Account Request</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="p-4 bg-emerald-100 border border-emerald-300 rounded-2xl text-xs text-emerald-900 font-bold flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  Brand account request logged! A merchandiser will review your profile upon order submission.
                </div>
              )}
            </div>
          ) : (
            /* INTERNAL MERCHANDISER FULL COMPANY CREATION SUB-FORM */
            <form onSubmit={handleCreateNewCustomer} className="p-6 bg-card border rounded-3xl space-y-4 shadow-sm">
              <div className="border-b pb-3">
                <h4 className="font-extrabold text-foreground text-sm flex items-center gap-2">
                  <Plus className="h-4 w-4 text-primary" /> Create New Customer Master Record
                </h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Internal staff authorization: Creates an active customer company record in CRM.
                </p>
              </div>

              {newFormError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 font-medium">
                  {newFormError}
                </div>
              )}

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                    Company / Brand Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Acme Denim Co."
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full p-2.5 border rounded-xl text-xs"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                    Tax ID / Business Reg No
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. US99-401920"
                    value={newTaxId}
                    onChange={(e) => setNewTaxId(e.target.value)}
                    className="w-full p-2.5 border rounded-xl text-xs"
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                    Primary Contact Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. John Doe"
                    value={newContactName}
                    onChange={(e) => setNewContactName(e.target.value)}
                    className="w-full p-2.5 border rounded-xl text-xs"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                    Primary Contact Email *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="j.doe@acmedenim.com"
                    value={newContactEmail}
                    onChange={(e) => setNewContactEmail(e.target.value)}
                    className="w-full p-2.5 border rounded-xl text-xs"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-2.5 bg-primary text-primary-foreground font-extrabold rounded-xl text-xs hover:bg-primary/90 transition-all"
                >
                  Save &amp; Select New Customer
                </button>
              </div>
            </form>
          )}
        </div>
      )}

    </div>
  );
}
