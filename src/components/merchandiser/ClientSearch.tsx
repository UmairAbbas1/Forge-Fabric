import { useState, useMemo } from "react";
import { Search, UserPlus, Building, Mail, Phone, Check, Link as LinkIcon, Sparkles } from "lucide-react";
import { useAppData } from "../../hooks/useAppData";
import { supabase, isRealSupabase } from "../../lib/supabase";

export interface SelectedClientInfo {
  id?: string;
  isNew: boolean;
  companyName: string;
  contactName: string;
  contactEmail: string;
  contactPhone?: string;
  tempPassword?: string;
  magicLink?: string;
}

interface ClientSearchProps {
  selectedClient: SelectedClientInfo | null;
  onSelectClient: (client: SelectedClientInfo) => void;
}

export function ClientSearch({ selectedClient, onSelectClient }: ClientSearchProps) {
  const { customers } = useAppData();
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  // New Client Form Fields
  const [newCompany, setNewCompany] = useState("");
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [isSubmittingNew, setIsSubmittingNew] = useState(false);
  const [createMsg, setCreateMsg] = useState<string | null>(null);

  // Fuzzy match existing clients (Warning #11)
  const matchingCustomers = useMemo(() => {
    if (!searchTerm.trim()) return customers.slice(0, 6);
    const q = searchTerm.toLowerCase();
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.contact && c.contact.toLowerCase().includes(q))
    );
  }, [customers, searchTerm]);

  const handleSelectExisting = (c: { id: string; name: string; contact: string }) => {
    onSelectClient({
      id: c.id,
      isNew: false,
      companyName: c.name,
      contactName: c.name,
      contactEmail: c.contact.includes("@") ? c.contact : `${c.name.toLowerCase().replace(/\s+/g, "")}@example.com`,
    });
    setIsCreatingNew(false);
  };

  const handleCreateNewClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompany.trim() || !newEmail.trim()) return;

    setIsSubmittingNew(true);
    setCreateMsg(null);

    try {
      if (isRealSupabase) {
        const res = await supabase.functions.invoke("create-client-account", {
          body: {
            company_name: newCompany.trim(),
            contact_name: newName.trim() || newCompany.trim(),
            contact_email: newEmail.trim(),
            contact_phone: newPhone.trim() || undefined,
          },
        });

        if (res.error) throw new Error(res.error.message);

        const data = res.data;
        onSelectClient({
          id: data.user_id,
          isNew: true,
          companyName: newCompany.trim(),
          contactName: newName.trim() || newCompany.trim(),
          contactEmail: newEmail.trim(),
          contactPhone: newPhone.trim(),
          tempPassword: data.temp_password,
          magicLink: data.magic_link,
        });
      } else {
        // Offline Mock Client Creation
        const mockUserId = `cust-new-${Date.now().toString().slice(-4)}`;
        const mockMagicLink = `https://forgefabric.com/login?token=mock_${Date.now()}`;
        onSelectClient({
          id: mockUserId,
          isNew: true,
          companyName: newCompany.trim(),
          contactName: newName.trim() || newCompany.trim(),
          contactEmail: newEmail.trim(),
          contactPhone: newPhone.trim(),
          tempPassword: "TempPassword123!",
          magicLink: mockMagicLink,
        });
      }
      setCreateMsg("Client account successfully created and magic onboarding link generated!");
    } catch (err: any) {
      setCreateMsg(`Error: ${err.message}`);
    } finally {
      setIsSubmittingNew(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-neutral-200 p-5 space-y-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
            <Building className="w-4 h-4 text-amber-600" />
            Client & Brand Account Lookup
          </h3>
          <p className="text-xs text-neutral-500 mt-0.5">
            Search existing registered brands or create a new client account with automated onboarding credentials.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setIsCreatingNew(!isCreatingNew);
            setCreateMsg(null);
          }}
          className="px-3 py-1.5 text-xs font-medium bg-sky-50 text-sky-800 border border-sky-200 rounded-lg hover:bg-sky-100 transition-colors flex items-center gap-1.5"
        >
          <UserPlus className="w-3.5 h-3.5" />
          {isCreatingNew ? "Search Existing" : "Create New Client"}
        </button>
      </div>

      {/* Selected Client Badge */}
      {selectedClient && (
        <div className="p-3.5 bg-amber-50/60 border border-amber-200/80 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-600 text-white flex items-center justify-center font-bold text-xs shadow-sm">
              {selectedClient.companyName.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-neutral-900">{selectedClient.companyName}</span>
                {selectedClient.isNew ? (
                  <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-emerald-100 text-emerald-800 rounded">
                    New Account Created
                  </span>
                ) : (
                  <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-neutral-100 text-neutral-700 rounded">
                    Linked Existing
                  </span>
                )}
              </div>
              <div className="text-[11px] text-neutral-600 flex items-center gap-3 mt-0.5">
                <span>{selectedClient.contactEmail}</span>
                {selectedClient.contactPhone && <span>{selectedClient.contactPhone}</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600" />
            <button
              type="button"
              onClick={() => onSelectClient(null as any)}
              className="text-xs text-neutral-400 hover:text-neutral-600 hover:underline"
            >
              Change
            </button>
          </div>
        </div>
      )}

      {/* Client Search View */}
      {!isCreatingNew && !selectedClient && (
        <div className="space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search company name, email, or contact..."
              className="w-full pl-9 pr-4 py-2 text-xs rounded-lg border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-52 overflow-y-auto pt-1">
            {matchingCustomers.map((cust) => (
              <button
                key={cust.id}
                type="button"
                onClick={() => handleSelectExisting(cust)}
                className="p-2.5 text-left border border-neutral-100 rounded-lg hover:border-sky-300 hover:bg-sky-50/30 transition-all flex items-center justify-between group"
              >
                <div>
                  <div className="text-xs font-semibold text-neutral-900 group-hover:text-sky-800">
                    {cust.name}
                  </div>
                  <div className="text-[11px] text-neutral-500 truncate max-w-[180px]">
                    {cust.contact}
                  </div>
                </div>
                <LinkIcon className="w-3.5 h-3.5 text-neutral-300 group-hover:text-sky-600" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Create New Client Form */}
      {isCreatingNew && !selectedClient && (
        <form onSubmit={handleCreateNewClient} className="space-y-3 border-t border-neutral-100 pt-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">Company / Brand Name *</label>
              <input
                type="text"
                required
                value={newCompany}
                onChange={(e) => setNewCompany(e.target.value)}
                placeholder="e.g. Iron Heart Denim"
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-neutral-200 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">Contact Person Name</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Haruki Sato"
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-neutral-200 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">Contact Email *</label>
              <input
                type="email"
                required
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="e.g. contact@ironheart.jp"
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-neutral-200 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">Phone Number</label>
              <input
                type="tel"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder="+81 3-1234-5678"
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-neutral-200 focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-1.5 text-[11px] text-neutral-600 bg-neutral-100 px-2.5 py-1 rounded-md">
              Will send magic link onboarding email with 7-day token
            </div>
            <button
              type="submit"
              disabled={isSubmittingNew}
              className="px-4 py-2 text-xs font-semibold bg-sky-500 text-white rounded-lg hover:bg-sky-600 transition-colors shadow-sm disabled:opacity-50"
            >
              {isSubmittingNew ? "Creating Account..." : "Create & Link Account"}
            </button>
          </div>

          {createMsg && (
            <p className={`text-xs ${createMsg.startsWith("Error") ? "text-rose-600" : "text-emerald-700 font-medium"}`}>
              {createMsg}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
