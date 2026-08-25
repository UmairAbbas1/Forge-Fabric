import React, { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { MapPin, Plus, CheckCircle2, Building2, Pencil, X, Save, AlertCircle } from "lucide-react";
import { CountryCityStateFields } from "./CountryCityStateFields";
import { validatePhoneForCountry, validateZipForCountry } from "../../lib/geoData";

export interface AddressData {
  id?: string;
  address_type: string;
  recipient_name: string;
  company_name_override?: string;
  street_1: string;
  street_2?: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  phone?: string;
  delivery_instructions?: string;
}

interface AddressSelectorProps {
  companyId?: string | null;
  value: AddressData | null;
  onChange: (address: AddressData) => void;
  label?: string;
}

export const AddressSelector: React.FC<AddressSelectorProps> = ({
  companyId,
  value,
  onChange,
  label = "Shipping Address",
}) => {
  const [existingAddresses, setExistingAddresses] = useState<AddressData[]>([]);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [loading, setLoading] = useState(false);

  // Fix #8: in-place editing of an existing saved address (UPDATE, not a
  // new address_book row). editForm is a separate draft so typing doesn't
  // affect the parent's `value` (and the currently-selected address) until
  // the edit is actually saved.
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<AddressData | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState("");
  // Item 4: phone/zip format validation, keyed per form (new vs. edit) so
  // errors don't bleed between the two.
  const [newFieldErrors, setNewFieldErrors] = useState<{ city?: string; phone?: string; postal_code?: string }>({});
  const [editFieldErrors, setEditFieldErrors] = useState<{ city?: string; phone?: string; postal_code?: string }>({});

  useEffect(() => {
    if (companyId) {
      loadAddresses(companyId);
    } else {
      setExistingAddresses([]);
      setIsCreatingNew(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  const loadAddresses = async (id: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("address_book")
        .select("*")
        .eq("company_id", id)
        .eq("is_active", true);

      if (error) throw error;

      setExistingAddresses(data || []);
      if (data && data.length === 0) {
        setIsCreatingNew(true);
      } else if (data && data.length > 0 && !value?.id && !isCreatingNew) {
        // Auto-select first address if none selected
        onChange(data[0]);
      }
    } catch (err) {
      console.error("Failed to load addresses", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectExisting = (address: AddressData) => {
    setIsCreatingNew(false);
    onChange(address);
  };

  const handleStartEdit = (address: AddressData, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingAddressId(address.id || null);
    setEditForm({ ...address });
    setEditError("");
  };

  const handleCancelEdit = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingAddressId(null);
    setEditForm(null);
    setEditError("");
  };

  const handleEditFieldChange = (field: keyof AddressData, val: string) => {
    setEditForm((prev) => (prev ? { ...prev, [field]: val } : prev));
  };

  const handleSaveEdit = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!editForm?.id) return;
    setEditError("");

    const phoneCheck = validatePhoneForCountry(editForm.phone || "", editForm.country);
    const zipCheck = validateZipForCountry(editForm.postal_code || "", editForm.country);
    const cityMissing = !editForm.city?.trim();
    if (!phoneCheck.valid || !zipCheck.valid || cityMissing) {
      setEditFieldErrors({
        city: cityMissing ? "City is required." : undefined,
        phone: phoneCheck.valid ? undefined : phoneCheck.message,
        postal_code: zipCheck.valid ? undefined : zipCheck.message,
      });
      return;
    }
    setEditFieldErrors({});

    setIsSavingEdit(true);
    try {
      const { id, ...fields } = editForm;
      const { error } = await supabase.from("address_book").update(fields).eq("id", id);
      if (error) throw error;

      setExistingAddresses((prev) => prev.map((a) => (a.id === id ? editForm : a)));
      // Keep the parent's selected address in sync if it's the one just edited
      if (value?.id === id) {
        onChange(editForm);
      }
      setEditingAddressId(null);
      setEditForm(null);
    } catch (err: any) {
      console.error("Failed to save address edit", err);
      setEditError(err.message || "Could not save changes to this address. Please try again.");
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleNewChange = (field: keyof AddressData, val: string) => {
    handleNewChangeMulti({ [field]: val });
  };

  // Two sequential handleNewChange() calls (e.g. city then state) would each
  // spread from the same stale `value` prop within one synchronous event
  // handler — React hasn't re-rendered with the first update yet — so the
  // second call silently clobbers the first. City+state selection always
  // needs both fields set together in one update; this is that path.
  const handleNewChangeMulti = (fields: Partial<AddressData>) => {
    const updated = {
      ...(value || {
        address_type: "Sample Receiving",
        recipient_name: "",
        street_1: "",
        city: "",
        state: "",
        postal_code: "",
        country: "United States",
      }),
      ...fields,
    } as AddressData;

    // Remove ID if we are creating new
    if (updated.id) delete updated.id;

    onChange(updated);
  };

  return (
    <div className="space-y-4">
      <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700">
        {label} <span className="text-red-500">*</span>
      </label>

      {/* Existing Addresses Selection */}
      {existingAddresses.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          {existingAddresses.map((addr) =>
            editingAddressId === addr.id && editForm ? (
              // Inline Edit Form — same fields as "create new," pre-populated,
              // saves as an UPDATE to this existing address_book row.
              <div
                key={addr.id}
                className="sm:col-span-2 p-4 rounded-xl border-2 border-blue-500 bg-blue-50/20 space-y-3 animate-in fade-in"
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase text-blue-800 flex items-center gap-1.5">
                    <Pencil className="w-3.5 h-3.5" /> Editing Saved Address
                  </h4>
                  <button type="button" onClick={handleCancelEdit} className="text-neutral-400 hover:text-neutral-700">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {editError && (
                  <p className="text-xs text-red-600 font-bold flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {editError}
                  </p>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-neutral-600 mb-1">Recipient Name</label>
                    <input
                      type="text"
                      value={editForm.recipient_name || ""}
                      onChange={(e) => handleEditFieldChange("recipient_name", e.target.value)}
                      className="w-full h-10 px-3 rounded-lg border border-neutral-300 text-sm focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-neutral-600 mb-1">Company / c/o (Optional)</label>
                    <input
                      type="text"
                      value={editForm.company_name_override || ""}
                      onChange={(e) => handleEditFieldChange("company_name_override", e.target.value)}
                      className="w-full h-10 px-3 rounded-lg border border-neutral-300 text-sm focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold uppercase text-neutral-600 mb-1">Street Address</label>
                    <input
                      type="text"
                      value={editForm.street_1 || ""}
                      onChange={(e) => handleEditFieldChange("street_1", e.target.value)}
                      className="w-full h-10 px-3 rounded-lg border border-neutral-300 text-sm focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold uppercase text-neutral-600 mb-1">Apt, Suite, Unit (Optional)</label>
                    <input
                      type="text"
                      value={editForm.street_2 || ""}
                      onChange={(e) => handleEditFieldChange("street_2", e.target.value)}
                      className="w-full h-10 px-3 rounded-lg border border-neutral-300 text-sm focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <CountryCityStateFields
                      country={editForm.country || ""}
                      city={editForm.city || ""}
                      state={editForm.state || ""}
                      onCountryChange={(c) => handleEditFieldChange("country", c)}
                      onCityChange={(c, s) => {
                        handleEditFieldChange("city", c);
                        handleEditFieldChange("state", s);
                      }}
                      cityError={editFieldErrors.city}
                      size="sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-neutral-600 mb-1">Zip Code *</label>
                    <input
                      type="text"
                      value={editForm.postal_code || ""}
                      onChange={(e) => handleEditFieldChange("postal_code", e.target.value)}
                      className={`w-full h-10 px-3 rounded-lg border text-sm focus:ring-2 focus:ring-blue-500 ${editFieldErrors.postal_code ? "border-red-400" : "border-neutral-300"}`}
                    />
                    {editFieldErrors.postal_code && <p className="text-[10px] text-red-600 font-bold mt-1">{editFieldErrors.postal_code}</p>}
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-neutral-600 mb-1">Phone Number *</label>
                    <input
                      type="tel"
                      value={editForm.phone || ""}
                      onChange={(e) => handleEditFieldChange("phone", e.target.value)}
                      className={`w-full h-10 px-3 rounded-lg border text-sm focus:ring-2 focus:ring-blue-500 ${editFieldErrors.phone ? "border-red-400" : "border-neutral-300"}`}
                    />
                    {editFieldErrors.phone && <p className="text-[10px] text-red-600 font-bold mt-1">{editFieldErrors.phone}</p>}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="px-4 py-2 text-xs font-bold text-neutral-600 hover:bg-neutral-100 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveEdit}
                    disabled={isSavingEdit}
                    className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 disabled:bg-neutral-300 text-white rounded-lg shadow-sm flex items-center gap-1.5"
                  >
                    <Save className="w-3.5 h-3.5" /> {isSavingEdit ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </div>
            ) : (
              <div
                key={addr.id}
                onClick={() => handleSelectExisting(addr)}
                className={`relative p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  !isCreatingNew && value?.id === addr.id
                    ? "border-blue-600 bg-blue-50/40 shadow-xs"
                    : "border-neutral-200 hover:border-neutral-300 bg-white"
                }`}
              >
                <div className="flex items-start gap-3 pr-6">
                  <MapPin
                    className={`w-5 h-5 mt-0.5 shrink-0 ${!isCreatingNew && value?.id === addr.id ? "text-blue-600" : "text-neutral-400"}`}
                  />
                  <div>
                    <h4 className="font-bold text-sm text-neutral-900">
                      {addr.recipient_name || "No Name"}
                    </h4>
                    <p className="text-xs text-neutral-600 mt-1">
                      {addr.street_1} {addr.street_2}
                    </p>
                    <p className="text-xs text-neutral-600">
                      {addr.city}, {addr.state} {addr.postal_code}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => handleStartEdit(addr, e)}
                  title="Edit this address"
                  className="absolute top-3 right-3 p-1.5 text-neutral-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                {!isCreatingNew && value?.id === addr.id && (
                  <div className="absolute bottom-3 right-3">
                    <CheckCircle2 className="w-5 h-5 text-blue-600" />
                  </div>
                )}
              </div>
            )
          )}

          {/* Create New Button Card */}
          <div
            onClick={() => {
              setIsCreatingNew(true);
              onChange({
                address_type: "Sample Receiving",
                recipient_name: "",
                street_1: "",
                city: "",
                state: "",
                postal_code: "",
                country: "United States",
              } as AddressData);
            }}
            className={`relative p-4 rounded-xl border-2 border-dashed cursor-pointer transition-all flex flex-col items-center justify-center text-center ${
              isCreatingNew
                ? "border-blue-500 bg-blue-50/20"
                : "border-neutral-300 hover:border-blue-400 hover:bg-neutral-50"
            }`}
          >
            <Plus
              className={`w-6 h-6 mb-2 ${isCreatingNew ? "text-blue-600" : "text-neutral-400"}`}
            />
            <span
              className={`text-sm font-bold ${isCreatingNew ? "text-blue-700" : "text-neutral-600"}`}
            >
              Enter New Address
            </span>
          </div>
        </div>
      )}

      {/* New Address Form */}
      {isCreatingNew && (
        <div className="bg-neutral-50 p-5 rounded-xl border border-neutral-200 animate-in fade-in space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold uppercase text-neutral-600 mb-1">
                Recipient Name
              </label>
              <input
                type="text"
                value={value?.recipient_name || ""}
                onChange={(e) => handleNewChange("recipient_name", e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-neutral-300 text-sm focus:ring-2 focus:ring-blue-500"
                placeholder="Person receiving the shipment"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase text-neutral-600 mb-1">
                Company / c/o (Optional)
              </label>
              <div className="relative">
                <Building2 className="absolute left-3 top-2.5 w-4 h-4 text-neutral-400" />
                <input
                  type="text"
                  value={value?.company_name_override || ""}
                  onChange={(e) => handleNewChange("company_name_override", e.target.value)}
                  className="w-full h-10 pl-9 pr-3 rounded-lg border border-neutral-300 text-sm focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. Acme Corp"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase text-neutral-600 mb-1">
              Street Address
            </label>
            <input
              type="text"
              value={value?.street_1 || ""}
              onChange={(e) => handleNewChange("street_1", e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-neutral-300 text-sm focus:ring-2 focus:ring-blue-500"
              placeholder="123 Production Way"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase text-neutral-600 mb-1">
              Apt, Suite, Unit (Optional)
            </label>
            <input
              type="text"
              value={value?.street_2 || ""}
              onChange={(e) => handleNewChange("street_2", e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-neutral-300 text-sm focus:ring-2 focus:ring-blue-500"
              placeholder="Suite 400"
            />
          </div>

          <CountryCityStateFields
            country={value?.country || ""}
            city={value?.city || ""}
            state={value?.state || ""}
            onCountryChange={(c) => handleNewChangeMulti({ country: c, city: "", state: "" })}
            onCityChange={(c, s) => {
              handleNewChangeMulti({ city: c, state: s });
              if (newFieldErrors.city) setNewFieldErrors((prev) => ({ ...prev, city: undefined }));
            }}
            cityError={newFieldErrors.city}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold uppercase text-neutral-600 mb-1">
                Zip Code * (Required for shipping)
              </label>
              <input
                type="text"
                value={value?.postal_code || ""}
                onChange={(e) => handleNewChange("postal_code", e.target.value)}
                onBlur={(e) => {
                  const check = validateZipForCountry(e.target.value, value?.country);
                  setNewFieldErrors((prev) => ({ ...prev, postal_code: check.valid ? undefined : check.message }));
                }}
                className={`w-full h-10 px-3 rounded-lg border text-sm focus:ring-2 focus:ring-blue-500 ${newFieldErrors.postal_code ? "border-red-400" : "border-neutral-300"}`}
              />
              {newFieldErrors.postal_code && <p className="text-[10px] text-red-600 font-bold mt-1">{newFieldErrors.postal_code}</p>}
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase text-neutral-600 mb-1">
                Phone Number * (Required for shipping)
              </label>
              <input
                type="tel"
                value={value?.phone || ""}
                onChange={(e) => handleNewChange("phone", e.target.value)}
                onBlur={(e) => {
                  const check = validatePhoneForCountry(e.target.value, value?.country);
                  setNewFieldErrors((prev) => ({ ...prev, phone: check.valid ? undefined : check.message }));
                }}
                className={`w-full h-10 px-3 rounded-lg border text-sm focus:ring-2 focus:ring-blue-500 ${newFieldErrors.phone ? "border-red-400" : "border-neutral-300"}`}
                placeholder="(555) 123-4567"
              />
              {newFieldErrors.phone && <p className="text-[10px] text-red-600 font-bold mt-1">{newFieldErrors.phone}</p>}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase text-neutral-600 mb-1">
              Delivery Instructions (Optional)
            </label>
            <input
              type="text"
              value={value?.delivery_instructions || ""}
              onChange={(e) => handleNewChange("delivery_instructions", e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-neutral-300 text-sm focus:ring-2 focus:ring-blue-500"
              placeholder="Gate code, loading dock info, etc."
            />
          </div>
        </div>
      )}
    </div>
  );
};
