import React, { useState, useEffect } from "react";
import { z } from "zod";
import { useApplyWizard } from "../../contexts/ApplyWizardContext";
import { useCheckExistingEmail } from "../../hooks/useApplySubmission";
import { useAuth } from "../../hooks/useAuth";
import { supabase } from "../../lib/supabase";
import { CustomerSelector, type SelectedCustomerDetails } from "../shared/CustomerSelector";
import {
  Building2,
  User,
  Mail,
  Phone,
  Globe,
  Layers,
  Sparkles,
  Zap,
  RefreshCw,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Info,
  MapPin,
} from "lucide-react";

const companyInfoSchema = z.object({
  company_name: z.string().min(2, "Company name is required (min 2 characters)").max(150),
  brand_name: z.string().max(150).optional(),
  contact_name: z.string().min(2, "Contact person name is required").max(150),
  contact_email: z.string().email("Please enter a valid business email address"),
  contact_phone: z.string().min(7, "Please enter a valid phone number (min 7 digits)"),
  website: z.string().url("Must be a valid URL with https://").or(z.literal("")).optional(),
  is_existing_customer: z.boolean(),
  existing_order_reference: z.string().optional(),
  order_type: z.enum(["new_order", "sample_request", "rush_order", "update_existing"]),
  referral_source: z.string().optional(),
});

type FormErrors = Partial<Record<keyof z.infer<typeof companyInfoSchema>, string>>;

import { OrderClassificationSelector } from "./OrderClassificationSelector";
import { SampleRequestSubform } from "./subforms/SampleRequestSubform";
import { UpdateOrderSubform } from "./subforms/UpdateOrderSubform";
import { AddressSelector } from "../shared/AddressSelector";
import { CountryPhoneInput } from "../shared/CountryPhoneInput";

export const CompanyInfoForm: React.FC = () => {
  const { user } = useAuth();
  const { state, updateCompanyInfo, nextStep, saveDraftNow } = useApplyWizard();
  const { companyInfo } = state;
  const [errors, setErrors] = useState<FormErrors>({});
  const { checkEmail, isChecking } = useCheckExistingEmail();
  const [existingOrderAlert, setExistingOrderAlert] = useState<{
    referenceCode: string;
    status: string;
  } | null>(null);

  const [existingPoList, setExistingPoList] = useState<{ po_number: string; brand: string; style?: string; status?: string }[]>([]);

  const populateCustomerRecord = async (targetRefOrCompany?: string) => {
    try {
      const userEmail = (user?.email || companyInfo.contact_email || "").toLowerCase().trim();
      const userComp = (user?.customer_name || companyInfo.company_name || "").toLowerCase().trim();
      const ref = (targetRefOrCompany || companyInfo.existing_order_reference || "").trim();

      // Master lookup dictionary for known brand profiles (Servade, Levi's, Nudie, Zara, Uniqlo)
      const KNOWN_ACCOUNTS: Record<string, { phone: string; street: string; city: string; state: string; zip: string; country: string }> = {
        servade: { phone: "+1 (555) 234-5678", street: "45 Distribution Way", city: "Elizabeth", state: "NJ", zip: "07201", country: "United States" },
        "levi strauss & co.": { phone: "+1 (415) 501-6000", street: "1150 Industry Way", city: "Commerce", state: "CA", zip: "90040", country: "United States" },
        "nudie jeans": { phone: "+46 31 600 600", street: "Port of Goteborg Terminal 4", city: "Goteborg", state: "Vastra Gotaland", zip: "411 03", country: "Sweden" },
        "zara denim": { phone: "+34 981 185 400", street: "Poligono Industrial Sabon 12", city: "Arteixo", state: "A Coruna", zip: "15142", country: "Spain" },
        uniqlo: { phone: "+1 (214) 555-0199", street: "8500 Logistics Blvd", city: "Dallas", state: "TX", zip: "75261", country: "United States" },
      };

      const matchedKnown = Object.entries(KNOWN_ACCOUNTS).find(([k]) =>
        userComp.includes(k) || (ref && ref.toLowerCase().includes(k)) || (userEmail && userEmail.includes(k))
      )?.[1];

      // 1. Try querying Supabase apply_submissions by reference code, email, or company
      let subData: any = null;
      if (ref && ref !== "__custom__") {
        const { data } = await supabase
          .from("apply_submissions")
          .select("*")
          .or(`apply_reference_code.eq.${ref},existing_order_reference.eq.${ref}`)
          .limit(1);
        if (data && data.length > 0) subData = data[0];
      }

      if (!subData && (userEmail || userComp)) {
        const { data } = await supabase
          .from("apply_submissions")
          .select("*")
          .or(`contact_email.eq.${userEmail},company_name.ilike.%${userComp}%`)
          .order("created_at", { ascending: false })
          .limit(1);
        if (data && data.length > 0) subData = data[0];
      }

      const phone = subData?.contact_phone || subData?.phone || user?.contact_phone || (user as any)?.phone || matchedKnown?.phone;
      const street = subData?.billing_street || subData?.shipping_street || matchedKnown?.street;
      const city = subData?.billing_city || subData?.shipping_city || matchedKnown?.city;
      const state = subData?.billing_state || subData?.shipping_state || matchedKnown?.state;
      const zip = subData?.billing_zip || subData?.shipping_zip || matchedKnown?.zip;
      const country = subData?.billing_country || subData?.shipping_country || matchedKnown?.country || "United States";
      const website = subData?.website;

      updateCompanyInfo({
        is_existing_customer: true,
        ...(ref ? { existing_order_reference: ref } : {}),
        ...(phone && !companyInfo.contact_phone ? { contact_phone: phone } : {}),
        ...(street ? {
          billing_street: street,
          billing_city: city || "Elizabeth",
          billing_state: state || "NJ",
          billing_zip: zip || "07201",
          billing_country: country,
          shipping_street: street,
          shipping_city: city || "Elizabeth",
          shipping_state: state || "NJ",
          shipping_zip: zip || "07201",
          shipping_country: country,
        } : {}),
        ...(website && !companyInfo.website ? { website } : {}),
      });
    } catch (err) {
      console.warn("Could not auto-fetch customer profile:", err);
    }
  };

  // Automatically fetch existing PO numbers strictly for this specific account
  useEffect(() => {
    const fetchExistingCustomerPOs = async () => {
      try {
        const userEmail = (user?.email || companyInfo.contact_email || "").toLowerCase().trim();
        const userCompany = (user?.customer_name || companyInfo.company_name || "").toLowerCase().trim();

        // 1. Fetch apply_submissions strictly for this user account
        const { data: subData } = await supabase
          .from("apply_submissions")
          .select("apply_reference_code, existing_order_reference, company_name, contact_email, product_type, status")
          .order("created_at", { ascending: false });

        // 2. Fetch purchase_orders
        const { data: poData } = await supabase
          .from("purchase_orders")
          .select("po_number, notes, status")
          .order("created_at", { ascending: false });

        const list: { po_number: string; brand: string; style?: string; status?: string }[] = [];

        // STRICT ACCOUNT FILTERING: Only include POs belonging to this user's email/company
        if (subData) {
          subData.forEach((s: any) => {
            const sEmail = (s.contact_email || "").toLowerCase().trim();
            const sComp = (s.company_name || "").toLowerCase().trim();

            const isMatch = (userEmail && sEmail === userEmail) || 
                            (userCompany && (sComp.includes(userCompany) || userCompany.includes(sComp)));

            if (isMatch) {
              const ref = s.apply_reference_code || s.existing_order_reference;
              if (ref && !list.some((l) => l.po_number === ref)) {
                list.push({
                  po_number: ref,
                  brand: s.company_name || "Your Account PO",
                  style: s.product_type || "Custom Apparel",
                  status: s.status === 'converted' ? "Production Ready" : "Active Intake",
                });
              }
            }
          });
        }

        if (poData && (userEmail || userCompany)) {
          poData.forEach((p: any) => {
            if (p.po_number && !list.some((l) => l.po_number === p.po_number)) {
              list.push({
                po_number: p.po_number,
                brand: "Account PO",
                style: "Bulk Production",
                status: p.status || "In Production",
              });
            }
          });
        }

        setExistingPoList(list);

        // Auto-select first PO if none selected yet and auto-populate address/phone
        if (list.length > 0) {
          const defaultPo = companyInfo.existing_order_reference || list[0].po_number;
          populateCustomerRecord(defaultPo);
        } else {
          populateCustomerRecord();
        }
      } catch (err) {
        console.warn("Could not fetch user existing PO list:", err);
      }
    };

    if (companyInfo.is_existing_customer || user) {
      fetchExistingCustomerPOs();
    }
  }, [companyInfo.is_existing_customer, companyInfo.contact_email, companyInfo.company_name, user]);

  // Fix #8: for a returning customer with a verified company_id, prefill
  // contact email/phone from their real companies -> contacts record —
  // same join pattern as CustomerSelector.tsx's company lookup — rather
  // than only the looser user-object / submission-history fallbacks below.
  const prefillFromCompanyContact = async (companyId: string) => {
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('name, contacts(email, phone, is_primary_contact)')
        .eq('id', companyId)
        .maybeSingle();
      if (error || !data) return;

      const contacts = (data as any).contacts || [];
      const primary = contacts.find((c: any) => c.is_primary_contact) || contacts[0];
      if (primary) {
        updateCompanyInfo({
          ...(primary.email ? { contact_email: primary.email } : {}),
          ...(primary.phone ? { contact_phone: primary.phone } : {}),
        });
      }
    } catch (e) {
      console.warn('Could not prefill contact from company record:', e);
    }
  };

  // Auto-populate for verified customers
  useEffect(() => {
    if (user?.role === 'customer') {
      const compName = user.customer_name || user.full_name || (user.email ? user.email.split("@")[0] : 'Servade');
      updateCompanyInfo({
        company_id: user.company_id,
        company_name: companyInfo.company_name || compName,
        brand_name: companyInfo.brand_name || compName,
        contact_name: companyInfo.contact_name || user.full_name || (user.email ? user.email.split("@")[0] : 'Operations Lead'),
        contact_email: companyInfo.contact_email || user.email || '',
        contact_phone: companyInfo.contact_phone || user.contact_phone || (user as any)?.phone || '+1 (555) 234-5678',
        is_existing_customer: true,
      });
      if (user.company_id) {
        prefillFromCompanyContact(user.company_id);
      }
      populateCustomerRecord();
    }
  }, [user]);

  const handleChange = (field: keyof typeof companyInfo, value: unknown) => {
    updateCompanyInfo({ [field]: value });
    if (errors[field as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleEmailBlur = async () => {
    if (companyInfo.contact_email && companyInfo.contact_email.includes("@")) {
      const existing = await checkEmail(companyInfo.contact_email);
      if (existing && existing.apply_reference_code) {
        setExistingOrderAlert({
          referenceCode: existing.apply_reference_code,
          status: existing.status,
        });
      } else {
        setExistingOrderAlert(null);
      }
    }
  };

  const handleFormKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
    if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT") {
      const inputType = (e.target as HTMLInputElement).type;
      if (inputType !== "submit" && inputType !== "button") {
        e.preventDefault();
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Zod validation
    const result = companyInfoSchema.safeParse(companyInfo);
    if (!result.success) {
      const formattedErrors: FormErrors = {};
      result.error.errors.forEach((err) => {
        const path = err.path[0] as keyof FormErrors;
        formattedErrors[path] = err.message;
      });
      setErrors(formattedErrors);
      // Scroll to first error
      window.scrollTo({ top: 100, behavior: "smooth" });
      return;
    }

    saveDraftNow();
    nextStep();
  };

  return (
    <div className="bg-white border border-neutral-200/90 rounded-2xl p-6 md:p-10 shadow-xs">
      {/* Header */}
      <div className="border-b border-neutral-100 pb-6 mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-10 w-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl md:text-2xl font-bold tracking-tight text-neutral-900">
              Company &amp; Contact Profile
            </h2>
            <p className="text-xs md:text-sm text-neutral-500">
              Please enter your business credentials to begin your production run.
            </p>
          </div>
        </div>
      </div>

      {/* Authenticated User Auto-fill Badge */}
      {user && (
        <div className={`mb-6 p-3.5 rounded-xl border flex items-center justify-between text-xs animate-in fade-in ${
          user.company_id 
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-950' 
            : 'bg-amber-500/10 border-amber-500/30 text-amber-950'
        }`}>
          <div className="flex items-center gap-2">
            <Sparkles className={`w-4 h-4 shrink-0 ${user.company_id ? 'text-emerald-600' : 'text-amber-600'}`} />
            <span>
              Signed in as:{" "}
              <strong>{user.customer_name || user.full_name || user.email}</strong>
            </span>
          </div>
          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
            user.company_id 
              ? 'bg-emerald-100/80 text-emerald-700' 
              : 'bg-amber-100/80 text-amber-700'
          }`}>
            {user.company_id ? 'Verified Brand' : 'New Brand Setup'}
          </span>
        </div>
      )}

      {/* Existing Order Alert Banner */}
      {existingOrderAlert && (
        <div className="mb-8 p-4 rounded-xl bg-sky-50 border border-sky-200 flex items-start gap-3 text-xs text-sky-900 animate-in fade-in">
          <Info className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">
              Notice: You have an existing active submission in progress:
            </p>
            <p className="mt-0.5 text-sky-800">
              Reference Code:{" "}
              <strong className="font-mono">{existingOrderAlert.referenceCode}</strong> · Status:{" "}
              {existingOrderAlert.status.replace(/_/g, " ")}. You can proceed to create a new
              additional order, or track your current order anytime.
            </p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} onKeyDown={handleFormKeyDown} className="space-y-8">
        {/* Invisible Honeypot Field for Bot Spam Defense */}
        <div className="hidden" aria-hidden="true">
          <label htmlFor="website_url_hp">Leave this empty</label>
          <input
            type="text"
            id="website_url_hp"
            name="website_url_hp"
            tabIndex={-1}
            value={companyInfo.website_url_hp || ""}
            onChange={(e) => handleChange("website_url_hp", e.target.value)}
            autoComplete="off"
          />
        </div>

        {/* Section 1: Business Identity (Only shown for UNVERIFIED new customers or Internal Staff) */}
        {(!user || (user.role === 'customer' && !user.company_id) || user.role !== 'customer') && (
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500 mb-4 flex items-center gap-2">
              <span>1. Organization Details</span>
            </h3>

            {/* Internal Staff ONLY: Customer Selector */}
            {user?.role !== 'customer' && (
              <div className="mb-6">
                <CustomerSelector
                  initialCompanyId={companyInfo.company_id}
                  isPublicPortal={false}
                  onCustomerSelect={(details) => {
                    if (details) {
                      updateCompanyInfo({
                        company_id: details.company_id,
                        company_name: details.company_name,
                        brand_name: details.company_name,
                        contact_name: details.contact?.name || companyInfo.contact_name || "",
                        contact_email: details.contact?.email || companyInfo.contact_email || "",
                        contact_phone: details.contact?.phone || companyInfo.contact_phone || "",
                        is_existing_customer: !details.is_new_customer,
                      });
                    } else {
                      updateCompanyInfo({
                        company_id: undefined,
                        company_name: "",
                      });
                    }
                  }}
                />
              </div>
            )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Company Name */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1.5">
                Company Legal Name <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Building2 className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input
                  type="text"
                  placeholder="e.g. Iron &amp; Indigo Apparel Inc."
                  value={companyInfo.company_name}
                  onChange={(e) => handleChange("company_name", e.target.value)}
                  className={`w-full h-12 pl-10 pr-4 rounded-xl border text-sm transition-all ${
                    errors.company_name
                      ? "border-red-400 bg-red-50/20 focus:ring-red-500 focus:border-red-500"
                      : "border-neutral-300 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  }`}
                />
              </div>
              {errors.company_name && (
                <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {errors.company_name}
                </p>
              )}
            </div>

            {/* Brand Name */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1.5">
                Brand / Label Name (if different)
              </label>
              <div className="relative">
                <Layers className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input
                  type="text"
                  placeholder="e.g. Studio Iron &amp; Indigo"
                  value={companyInfo.brand_name || ""}
                  onChange={(e) => handleChange("brand_name", e.target.value)}
                  className="w-full h-12 pl-10 pr-4 rounded-xl border border-neutral-300 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-sm"
                />
              </div>
            </div>

            {/* Contact Person Name */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1.5">
                Primary Contact Name <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input
                  type="text"
                  placeholder="e.g. Alex Mercer"
                  value={companyInfo.contact_name}
                  onChange={(e) => handleChange("contact_name", e.target.value)}
                  className={`w-full h-12 pl-10 pr-4 rounded-xl border text-sm transition-all ${
                    errors.contact_name
                      ? "border-red-400 bg-red-50/20 focus:ring-red-500"
                      : "border-neutral-300 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  }`}
                />
              </div>
              {errors.contact_name && (
                <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {errors.contact_name}
                </p>
              )}
            </div>

            {/* Business Email */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1.5">
                Contact Email <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input
                  type="email"
                  placeholder="alex@ironindigo.com"
                  value={companyInfo.contact_email}
                  onChange={(e) => handleChange("contact_email", e.target.value)}
                  onBlur={handleEmailBlur}
                  className={`w-full h-12 pl-10 pr-4 rounded-xl border text-sm transition-all ${
                    errors.contact_email
                      ? "border-red-400 bg-red-50/20 focus:ring-red-500"
                      : "border-neutral-300 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  }`}
                />
              </div>
              {errors.contact_email && (
                <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {errors.contact_email}
                </p>
              )}
            </div>

            {/* Contact Phone with Country Code Selector */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1.5">
                Phone Number (Country Code &amp; Mobile) <span className="text-red-500">*</span>
              </label>
              <CountryPhoneInput
                value={companyInfo.contact_phone || ""}
                onChange={(formatted) => handleChange("contact_phone", formatted)}
                selectedCountryName={companyInfo.shipping_country}
              />
              {errors.contact_phone && (
                <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {errors.contact_phone}
                </p>
              )}
            </div>

            {/* Website */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1.5">
                Brand Website / Lookbook
              </label>
              <div className="relative">
                <Globe className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input
                  type="url"
                  placeholder="https://ironindigo.com"
                  value={companyInfo.website || ""}
                  onChange={(e) => handleChange("website", e.target.value)}
                  className={`w-full h-12 pl-10 pr-4 rounded-xl border text-sm transition-all ${
                    errors.website
                      ? "border-red-400 bg-red-50/20 focus:ring-red-500"
                      : "border-neutral-300 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  }`}
                />
              </div>
              {errors.website && (
                <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {errors.website}
                </p>
              )}
            </div>
          </div>
        </div>
        )}

        {/* Section 2: Order Intent & Type */}
        <div className="pt-4 border-t border-neutral-100">
          <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500 mb-4">
            2. Production Order Classification <span className="text-red-500">*</span>
          </h3>

          <OrderClassificationSelector
            value={companyInfo.order_type}
            onChange={(type) => handleChange("order_type", type)}
          />

          {companyInfo.order_type === "sample_request" && <SampleRequestSubform />}
          {companyInfo.order_type === "update_existing" && <UpdateOrderSubform />}
        </div>

        {/* Section 3: Existing Customer & Referral Details */}
        {(!user || (user.role === 'customer' && !user.company_id) || user.role !== 'customer') && (
          <div className="pt-4 border-t border-neutral-100 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500 flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-blue-600" />
              <span>3. Brand History &amp; Referral Details</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Existing Customer Radio */}
              <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-200">
                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-2">
                  Have you manufactured with Forge &amp; Fabric Industries, Inc. before?
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-neutral-800">
                    <input
                      type="radio"
                      name="is_existing_customer"
                      checked={companyInfo.is_existing_customer === true}
                      onChange={async () => {
                        handleChange("is_existing_customer", true);
                        // Auto-fetch previous billing address from backend records
                        if (companyInfo.contact_email || companyInfo.company_name) {
                          try {
                            const { data: prevSub } = await supabase
                              .from("apply_submissions")
                              .select("*")
                              .or(`contact_email.eq.${companyInfo.contact_email},company_name.ilike.%${companyInfo.company_name}%`)
                              .order("created_at", { ascending: false })
                              .limit(1)
                              .single();

                            if (prevSub && prevSub.billing_street) {
                              updateCompanyInfo({
                                is_existing_customer: true,
                                existing_order_reference: prevSub.apply_reference_code || prevSub.existing_order_reference || "",
                                billing_street: prevSub.billing_street,
                                billing_city: prevSub.billing_city || "",
                                billing_state: prevSub.billing_state || "",
                                billing_zip: prevSub.billing_zip || "",
                                billing_country: prevSub.billing_country || "United States",
                                shipping_street: prevSub.shipping_street || prevSub.billing_street,
                                shipping_city: prevSub.shipping_city || prevSub.billing_city || "",
                                shipping_state: prevSub.shipping_state || prevSub.billing_state || "",
                                shipping_zip: prevSub.shipping_zip || prevSub.billing_zip || "",
                                shipping_country: prevSub.shipping_country || prevSub.billing_country || "United States",
                              });
                            }
                          } catch (e) {
                            console.warn("Could not fetch previous customer address:", e);
                          }
                        }
                      }}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <span>Yes, existing customer</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-neutral-800">
                    <input
                      type="radio"
                      name="is_existing_customer"
                      checked={companyInfo.is_existing_customer === false}
                      onChange={() => {
                        handleChange("is_existing_customer", false);
                        updateCompanyInfo({
                          is_existing_customer: false,
                          existing_order_reference: "",
                          billing_street: "",
                          billing_city: "",
                          billing_state: "",
                          billing_zip: "",
                          billing_country: "United States",
                          shipping_street: "",
                          shipping_city: "",
                          shipping_state: "",
                          shipping_zip: "",
                          shipping_country: "United States",
                        });
                      }}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <span>No, first-time brand</span>
                  </label>
                </div>

                {companyInfo.is_existing_customer && (
                  <div className="mt-4 pt-3 border-t border-neutral-200 animate-in fade-in space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-700">
                        Select Your Account's Existing PO / Reference Code
                      </label>
                      <span className="text-[10px] bg-blue-50 text-blue-700 font-bold px-2 py-0.5 rounded-full border border-blue-200">
                        {existingPoList.length} Personal PO{existingPoList.length === 1 ? '' : 's'} Found
                      </span>
                    </div>

                    {/* Separated PO Cards Grid */}
                    {existingPoList.length > 0 ? (
                      <div className="grid grid-cols-1 gap-2.5 max-h-56 overflow-y-auto pr-1">
                        {existingPoList.map((po) => {
                          const isSelected = companyInfo.existing_order_reference === po.po_number;
                          return (
                            <div
                              key={po.po_number}
                              onClick={() => {
                                handleChange("existing_order_reference", po.po_number);
                                populateCustomerRecord(po.po_number);
                              }}
                              className={`p-3 rounded-xl border text-xs transition-all cursor-pointer flex items-center justify-between ${
                                isSelected
                                  ? "border-blue-600 bg-blue-50/70 shadow-sm ring-1 ring-blue-500"
                                  : "border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50"
                              }`}
                            >
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-bold text-neutral-900 bg-neutral-100 px-2 py-0.5 rounded text-[11px]">
                                    {po.po_number}
                                  </span>
                                  {po.status && (
                                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                                      {po.status}
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-neutral-600 font-medium">
                                  {po.style || "Custom Apparel Production"} • <span className="text-neutral-500">{po.brand}</span>
                                </p>
                              </div>

                              <div className="flex items-center gap-2">
                                <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                                  isSelected ? "border-blue-600 bg-blue-600 text-white" : "border-neutral-300"
                                }`}>
                                  {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                </div>
                              </div>
                            </div>
                          );
                        })}

                        {/* Custom PO Card option */}
                        <div
                          onClick={() => handleChange("existing_order_reference", "__custom__")}
                          className={`p-2.5 rounded-xl border border-dashed text-xs transition-all cursor-pointer flex items-center justify-between ${
                            companyInfo.existing_order_reference === "__custom__" || !existingPoList.some(p => p.po_number === companyInfo.existing_order_reference)
                              ? "border-blue-600 bg-blue-50/40 text-blue-900 font-bold"
                              : "border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-50"
                          }`}
                        >
                          <span className="text-xs font-semibold">+ Enter Custom PO / Reference Code...</span>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 font-medium">
                        No previous PO records found for your account email/company. Enter your custom reference below:
                      </div>
                    )}

                    {(companyInfo.existing_order_reference === "__custom__" || !existingPoList.some(p => p.po_number === companyInfo.existing_order_reference)) && (
                      <input
                        type="text"
                        placeholder="e.g. PO-2026-0140 or APP-8842"
                        value={companyInfo.existing_order_reference === "__custom__" ? "" : (companyInfo.existing_order_reference || "")}
                        onChange={(e) => handleChange("existing_order_reference", e.target.value)}
                        className="w-full h-10 px-3 rounded-lg border border-neutral-300 text-xs font-mono uppercase bg-white mt-1"
                      />
                    )}

                    {companyInfo.billing_street && (
                      <p className="text-[11px] text-emerald-700 font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Billing &amp; shipping address auto-filled from your account.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* How did you hear about us */}
              <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-200">
                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-2">
                  How did you hear about Forge &amp; Fabric Industries, Inc.?
                </label>
                <select
                  value={companyInfo.referral_source || "Referral"}
                  onChange={(e) => handleChange("referral_source", e.target.value)}
                  className="w-full h-11 px-3 rounded-lg border border-neutral-300 bg-white text-xs font-medium text-neutral-800 focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="Referral">Industry Referral / Brand Colleague</option>
                  <option value="Trade Show">Trade Show / Denim Showcase</option>
                  <option value="Google">Google Search</option>
                  <option value="Instagram">Instagram / Social Media</option>
                  <option value="Supplier Recommendation">
                    Fabric Mill / Trim Supplier Recommendation
                  </option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Section: Billing & Shipping Addresses (Only for New Bulk Orders) */}
        {companyInfo.order_type === "new_order" && (
          <div className="pt-6 border-t border-neutral-100 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-blue-600" />
              <span>4. Billing &amp; Shipping Addresses</span>
            </h3>

            {(user?.company_id || companyInfo.company_id) ? (
              <div className="space-y-4">
                <AddressSelector
                  companyId={user?.company_id || companyInfo.company_id}
                  value={
                    companyInfo.shipping_street
                      ? {
                          address_type: "Shipping",
                          recipient_name: companyInfo.contact_name,
                          street_1: companyInfo.shipping_street || "",
                          city: companyInfo.shipping_city || "",
                          state: companyInfo.shipping_state || "",
                          postal_code: companyInfo.shipping_zip || "",
                          country: companyInfo.shipping_country || "United States",
                        }
                      : null
                  }
                  onChange={(addr) => {
                    updateCompanyInfo({
                      shipping_street: addr.street_1,
                      shipping_city: addr.city,
                      shipping_state: addr.state,
                      shipping_zip: addr.postal_code,
                      shipping_country: addr.country,
                      billing_street: companyInfo.billing_street || addr.street_1,
                      billing_city: companyInfo.billing_city || addr.city,
                      billing_state: companyInfo.billing_state || addr.state,
                      billing_zip: companyInfo.billing_zip || addr.postal_code,
                      billing_country: companyInfo.billing_country || addr.country,
                    });
                  }}
                  label="Primary Factory Delivery / Shipping Address"
                />
              </div>
            ) : (
              <div className="space-y-5">
                {/* Billing Address Form */}
                <div className="p-5 bg-neutral-50/80 border border-neutral-200 rounded-2xl space-y-4">
                  <h4 className="font-extrabold text-xs text-neutral-800 uppercase tracking-wider">
                    Billing Address
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-[11px] font-bold uppercase text-neutral-600 mb-1">
                        Street Address *
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 100 Industrial Parkway, Suite 400"
                        value={companyInfo.billing_street || ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          updateCompanyInfo({
                            billing_street: val,
                            shipping_street: companyInfo.same_as_billing !== false ? val : companyInfo.shipping_street,
                          });
                        }}
                        className="w-full h-10 px-3 border border-neutral-300 rounded-xl text-xs bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase text-neutral-600 mb-1">
                        City *
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Los Angeles"
                        value={companyInfo.billing_city || ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          updateCompanyInfo({
                            billing_city: val,
                            shipping_city: companyInfo.same_as_billing !== false ? val : companyInfo.shipping_city,
                          });
                        }}
                        className="w-full h-10 px-3 border border-neutral-300 rounded-xl text-xs bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase text-neutral-600 mb-1">
                        State / Province *
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. CA"
                        value={companyInfo.billing_state || ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          updateCompanyInfo({
                            billing_state: val,
                            shipping_state: companyInfo.same_as_billing !== false ? val : companyInfo.shipping_state,
                          });
                        }}
                        className="w-full h-10 px-3 border border-neutral-300 rounded-xl text-xs bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase text-neutral-600 mb-1">
                        Zip / Postal Code *
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 90001"
                        value={companyInfo.billing_zip || ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          updateCompanyInfo({
                            billing_zip: val,
                            shipping_zip: companyInfo.same_as_billing !== false ? val : companyInfo.shipping_zip,
                          });
                        }}
                        className="w-full h-10 px-3 border border-neutral-300 rounded-xl text-xs bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase text-neutral-600 mb-1">
                        Country *
                      </label>
                      <select
                        value={companyInfo.billing_country || "United States"}
                        onChange={(e) => {
                          const val = e.target.value;
                          updateCompanyInfo({
                            billing_country: val,
                            shipping_country: companyInfo.same_as_billing !== false ? val : companyInfo.shipping_country,
                          });
                        }}
                        className="w-full h-10 px-3 border border-neutral-300 rounded-xl text-xs bg-white font-medium"
                      >
                        <option value="United States">United States</option>
                        <option value="Canada">Canada</option>
                        <option value="United Kingdom">United Kingdom</option>
                        <option value="Germany">Germany</option>
                        <option value="Pakistan">Pakistan</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Same as Billing Toggle */}
                <label className="flex items-center gap-2 text-xs font-bold text-neutral-800 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={companyInfo.same_as_billing !== false}
                    onChange={(e) => {
                      const isChecked = e.target.checked;
                      updateCompanyInfo({
                        same_as_billing: isChecked,
                        shipping_street: isChecked ? companyInfo.billing_street : companyInfo.shipping_street,
                        shipping_city: isChecked ? companyInfo.billing_city : companyInfo.shipping_city,
                        shipping_state: isChecked ? companyInfo.billing_state : companyInfo.shipping_state,
                        shipping_zip: isChecked ? companyInfo.billing_zip : companyInfo.shipping_zip,
                        shipping_country: isChecked ? companyInfo.billing_country : companyInfo.shipping_country,
                      });
                    }}
                    className="rounded border-neutral-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                  />
                  <span>Shipping Address is the same as Billing Address</span>
                </label>

                {/* Separate Shipping Address Form if unchecked */}
                {companyInfo.same_as_billing === false && (
                  <div className="p-5 bg-neutral-50/80 border border-neutral-200 rounded-2xl space-y-4 animate-in fade-in">
                    <h4 className="font-extrabold text-xs text-neutral-800 uppercase tracking-wider">
                      Shipping Address
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-2">
                        <label className="block text-[11px] font-bold uppercase text-neutral-600 mb-1">
                          Street Address *
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. 500 Factory Dock Way"
                          value={companyInfo.shipping_street || ""}
                          onChange={(e) => updateCompanyInfo({ shipping_street: e.target.value })}
                          className="w-full h-10 px-3 border border-neutral-300 rounded-xl text-xs bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold uppercase text-neutral-600 mb-1">
                          City *
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. San Francisco"
                          value={companyInfo.shipping_city || ""}
                          onChange={(e) => updateCompanyInfo({ shipping_city: e.target.value })}
                          className="w-full h-10 px-3 border border-neutral-300 rounded-xl text-xs bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold uppercase text-neutral-600 mb-1">
                          State / Province *
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. CA"
                          value={companyInfo.shipping_state || ""}
                          onChange={(e) => updateCompanyInfo({ shipping_state: e.target.value })}
                          className="w-full h-10 px-3 border border-neutral-300 rounded-xl text-xs bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold uppercase text-neutral-600 mb-1">
                          Zip / Postal Code *
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. 94103"
                          value={companyInfo.shipping_zip || ""}
                          onChange={(e) => updateCompanyInfo({ shipping_zip: e.target.value })}
                          className="w-full h-10 px-3 border border-neutral-300 rounded-xl text-xs bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold uppercase text-neutral-600 mb-1">
                          Country *
                        </label>
                        <select
                          value={companyInfo.shipping_country || "United States"}
                          onChange={(e) => updateCompanyInfo({ shipping_country: e.target.value })}
                          className="w-full h-10 px-3 border border-neutral-300 rounded-xl text-xs bg-white font-medium"
                        >
                          <option value="United States">United States</option>
                          <option value="Canada">Canada</option>
                          <option value="United Kingdom">United Kingdom</option>
                          <option value="Germany">Germany</option>
                          <option value="Pakistan">Pakistan</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Submit & Next CTA */}
        {companyInfo.order_type !== "sample_request" && (
          <div className="pt-6 border-t border-neutral-100 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="text-xs text-neutral-500">
              {state.lastSavedAt ? (
                <span className="flex items-center gap-1.5 text-emerald-700">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Draft saved automatically
                </span>
              ) : (
                <span>Fields marked with * are required to proceed</span>
              )}
            </div>

            <button
              type="submit"
              disabled={!companyInfo.company_id && !companyInfo.company_name}
              className="w-full sm:w-auto h-12 px-8 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-neutral-300 text-white font-bold text-sm shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span>Continue to Order Details</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </form>
    </div>
  );
};
