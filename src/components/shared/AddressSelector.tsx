import React, { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { MapPin, Plus, CheckCircle2, Building2 } from "lucide-react";

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

  const handleNewChange = (field: keyof AddressData, val: string) => {
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
      [field]: val,
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
          {existingAddresses.map((addr) => (
            <div
              key={addr.id}
              onClick={() => handleSelectExisting(addr)}
              className={`relative p-4 rounded-xl border-2 cursor-pointer transition-all ${
                !isCreatingNew && value?.id === addr.id
                  ? "border-blue-600 bg-blue-50/40 shadow-xs"
                  : "border-neutral-200 hover:border-neutral-300 bg-white"
              }`}
            >
              <div className="flex items-start gap-3">
                <MapPin
                  className={`w-5 h-5 mt-0.5 ${!isCreatingNew && value?.id === addr.id ? "text-blue-600" : "text-neutral-400"}`}
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
              {!isCreatingNew && value?.id === addr.id && (
                <div className="absolute top-4 right-4">
                  <CheckCircle2 className="w-5 h-5 text-blue-600" />
                </div>
              )}
            </div>
          ))}

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

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="col-span-2 sm:col-span-2">
              <label className="block text-[11px] font-bold uppercase text-neutral-600 mb-1">
                City
              </label>
              <input
                type="text"
                value={value?.city || ""}
                onChange={(e) => handleNewChange("city", e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-neutral-300 text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="col-span-1 sm:col-span-1">
              <label className="block text-[11px] font-bold uppercase text-neutral-600 mb-1">
                State
              </label>
              <input
                type="text"
                value={value?.state || ""}
                onChange={(e) => handleNewChange("state", e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-neutral-300 text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="col-span-1 sm:col-span-1">
              <label className="block text-[11px] font-bold uppercase text-neutral-600 mb-1">
                Zip Code
              </label>
              <input
                type="text"
                value={value?.postal_code || ""}
                onChange={(e) => handleNewChange("postal_code", e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-neutral-300 text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold uppercase text-neutral-600 mb-1">
                Country
              </label>
              <select
                value={value?.country || "United States"}
                onChange={(e) => handleNewChange("country", e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-neutral-300 text-sm focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="United States">United States</option>
                <option value="Canada">Canada</option>
                <option value="Mexico">Mexico</option>
                <option value="United Kingdom">United Kingdom</option>
                <option value="Australia">Australia</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase text-neutral-600 mb-1">
                Phone Number (Required for shipping)
              </label>
              <input
                type="tel"
                value={value?.phone || ""}
                onChange={(e) => handleNewChange("phone", e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-neutral-300 text-sm focus:ring-2 focus:ring-blue-500"
                placeholder="(555) 123-4567"
              />
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
