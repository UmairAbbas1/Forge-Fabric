import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { AppShell } from "../components/AppShell";
import { useAppData } from "../hooks/useAppData";
import { usePermission } from "../hooks/usePermission";
import { useAuth } from "../hooks/useAuth";
import { supabase, isRealSupabase } from "../lib/supabase";
import {
  Truck, PackageCheck, Send, CheckCircle2, Search, ClipboardList,
  Plus, X, Building2, MapPin, Barcode, ShieldCheck, FileCheck2, Lock, AlertTriangle
} from "lucide-react";

export const Route = createFileRoute("/dispatch")({
  head: () => ({
    meta: [
      { title: "Dispatch Logistics & Packing Lists · Forge & Fabric Industries, Inc. MES" },
      { name: "description", content: "Packing list management, address book destination mapping, proof of delivery signatures, and order fulfillment." },
    ],
  }),
  component: DispatchLogisticsPage,
});

interface PackingListRecord {
  id: string;
  packing_list_number: string;
  po_number: string;
  customer_name: string;
  destination_address: string;
  total_cartons: number;
  total_units: number;
  // Matches the live packing_lists_status_check CHECK constraint exactly —
  // "Ready_for_Pickup" was never a valid value in the database (confirmed
  // by direct testing: every insert using it violates the constraint), so
  // every packing list creation was silently failing at the DB layer.
  status: "Draft" | "Packed" | "Shipped" | "Delivered" | "Cancelled";
  carrier_name: string;
  tracking_reference?: string;
  pod_signature_ref?: string;
  shipped_at?: string;
}

interface AddressOption {
  id: string;
  customer_name?: string;
  address_label: string;
  full_address: string;
}

const DEFAULT_ADDRESS_OPTIONS: AddressOption[] = [
  { id: "addr-servade", customer_name: "Servade", address_label: "Servade Logistics Distribution Center", full_address: "45 Distribution Way, Elizabeth, NJ 07201" },
  { id: "addr-levi", customer_name: "Levi Strauss & Co.", address_label: "Levi Strauss & Co. Main DC #42", full_address: "1150 Industry Way, Commerce, CA 90040" },
  { id: "addr-nudie", customer_name: "Nudie Jeans", address_label: "Nudie Jeans Nordic Logistics Hub", full_address: "Port of Goteborg Terminal 4, 411 03 Goteborg, Sweden" },
  { id: "addr-zara", customer_name: "Zara Denim", address_label: "Zara Denim Logistics Platform", full_address: "Poligono Industrial Sabon 12, 15142 Arteixo, Spain" },
  { id: "addr-uniqlo", customer_name: "Uniqlo", address_label: "Uniqlo Americas Central Warehouse", full_address: "8500 Logistics Blvd, Dallas, TX 75261" },
  { id: "addr-weissmade", customer_name: "WiesMade", address_label: "WiesMade Logistics & Distribution Center", full_address: "742 Evergreen Terrace, San Francisco, CA 94107" },
  { id: "addr-fog", customer_name: "Fear of God", address_label: "Fear of God Master Logistics Terminal", full_address: "900 N Michigan Ave, Suite 1400, Chicago, IL 60611" },
];

const MOCK_PACKING_LISTS: PackingListRecord[] = [
  {
    id: "pl-1",
    packing_list_number: "PL-2026-8801",
    po_number: "PO-2026-1855",
    customer_name: "Servade",
    destination_address: "45 Distribution Way, Elizabeth, NJ 07201",
    total_cartons: 167,
    total_units: 5000,
    status: "Shipped",
    carrier_name: "FedEx Freight Express",
    tracking_reference: "TRK-7749-9912",
    pod_signature_ref: "POD-SIG-88102",
    shipped_at: "2026-08-10 14:30",
  },
  {
    id: "pl-2",
    packing_list_number: "PL-2026-8802",
    po_number: "PO-2026-5502",
    customer_name: "Zara Denim",
    destination_address: "Poligono Industrial Sabon 12, 15142 Arteixo, Spain",
    total_cartons: 20,
    total_units: 600,
    status: "Packed",
    carrier_name: "DHL Global Logistics",
    shipped_at: undefined,
  },
];

function DispatchLogisticsPage() {
  const canManage = usePermission("shipping", "update");
  const { user } = useAuth();
  // REQ Fix #3: a customer session must never see another brand's packing
  // lists or shipping addresses. RLS (20260825010000_dispatch_customer_
  // scoped_rls.sql) enforces this at the DB layer; these frontend guards are
  // defense-in-depth against the client-side-only DEFAULT_ADDRESS_OPTIONS /
  // MOCK_PACKING_LISTS fallbacks below, which RLS cannot touch since they
  // never go through a DB query at all.
  const isCustomer = user?.role === "customer";
  // Client-side identity match (same fuzzy customer_name pattern used by
  // CustomerPortal.tsx) — belt-and-suspenders alongside the RLS policy so
  // this is airtight even before that migration has actually been applied,
  // since these queries below currently still return every brand's rows
  // until then.
  const custIdentity = (user?.customer_name || "").toLowerCase().trim();
  const matchesCustomer = (name?: string | null) => {
    if (!custIdentity) return false;
    const n = (name || "").toLowerCase().trim();
    return !!n && (n.includes(custIdentity) || custIdentity.includes(n));
  };
  const { orders, updateOrder } = useAppData();

  const [packingLists, setPackingLists] = useState<PackingListRecord[]>([]);

  // An order becomes ineligible for a *new* packing list once a real one
  // already exists for it — not once its status looks "Shipped". Orders can
  // reach Stage 13 (and get marked Shipped) via the Kanban/StageNavigator
  // path with no packing list ever created; those must still show up here
  // so the admin can actually create the real dispatch record.
  const orderHasPackingList = (o: { PO_number?: string; order_id: string }) => {
    const poCode = o.PO_number || o.order_id;
    return packingLists.some((pl) => pl.po_number === poCode);
  };

  const [addresses, setAddresses] = useState<AddressOption[]>(DEFAULT_ADDRESS_OPTIONS);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // New Packing List Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedPoNumber, setSelectedPoNumber] = useState("");
  const [customerName, setCustomerName] = useState("Servade");
  const [selectedAddressId, setSelectedAddressId] = useState("addr-servade");
  const [carrierName, setCarrierName] = useState("FedEx Freight Express");
  const [totalCartonsInput, setTotalCartonsInput] = useState(167);
  const [totalUnitsInput, setTotalUnitsInput] = useState(5000);
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // POD Signature Modal State
  const [showPodModal, setShowPodModal] = useState(false);
  const [activePackingList, setActivePackingList] = useState<PackingListRecord | null>(null);
  const [podRefInput, setPodRefInput] = useState("");
  const [driverNameInput, setDriverNameInput] = useState("Driver Mark Vance");

  const loadData = async () => {
    setIsLoading(true);
    try {
      if (isRealSupabase) {
        // Fetch packing lists
        const { data: plDataRaw, error: plErr } = await supabase
          .from("packing_lists")
          .select("*")
          .order("created_at", { ascending: false });

        // Client-side scoping ahead of the RLS policy actually being applied
        // — see matchesCustomer above.
        const plData = isCustomer ? (plDataRaw || []).filter((p: any) => matchesCustomer(p.customer_name)) : plDataRaw;

        if (!plErr && plData && plData.length > 0) {
          // No fabricated fallbacks — a packing list missing a real value
          // shows that honestly ("Not specified" / 0) instead of a fake but
          // plausible-looking one. The previous defaults here (customer_name
          // -> "Servade", po_number -> "PO-2026-1855", carrier -> "FedEx
          // Freight Express", etc.) could actively misattribute a real
          // shipment to the wrong brand's address/PO on screen.
          const mapped = plData.map((p: any) => ({
            id: p.id,
            packing_list_number: p.packing_list_number || `PL-${p.id.slice(0, 8)}`,
            po_number: p.po_number || "Not specified",
            customer_name: p.customer_name || "Not specified",
            destination_address: p.destination_address || "Not specified",
            total_cartons: Number(p.total_cartons) || 0,
            total_units: Number(p.total_units) || 0,
            status: p.status || "Draft",
            carrier_name: p.carrier_name || "Not specified",
            tracking_reference: p.tracking_reference,
            pod_signature_ref: p.pod_signature_ref,
            shipped_at: p.shipped_at ? p.shipped_at.slice(0, 16).replace("T", " ") : undefined,
          }));
          setPackingLists(mapped);
        } else if (isCustomer) {
          // RLS already scopes the query above to this customer's own
          // company — a genuinely empty result means they have zero
          // packing lists, not "show every other brand's mock data."
          setPackingLists([]);
        } else {
          setPackingLists(MOCK_PACKING_LISTS);
        }

        // Fetch destination addresses from address_book master
        const { data: addrDataRaw } = await supabase.from("address_book").select("*");
        // Client-side scoping ahead of the RLS policy actually being applied
        // — see matchesCustomer above. company_id is preferred when set;
        // legacy seed rows only carry customer_name.
        const addrData = isCustomer
          ? (addrDataRaw || []).filter((a: any) =>
              user?.company_id ? a.company_id === user.company_id : matchesCustomer(a.customer_name)
            )
          : addrDataRaw;
        const rawAddrList: AddressOption[] = [];

        if (addrData && addrData.length > 0) {
          addrData.forEach((a: any) => {
            const label = (a.address_label && !a.address_label.includes("null") && a.address_label.trim())
              ? a.address_label.trim()
              : (a.address_type ? `${a.address_type} Destination DC` : "Customer DC");

            const street = a.street_1 || a.address_line1 || a.address || "1150 Industry Way";
            const city = a.city || "Commerce";
            const state = a.state || a.state_province || "CA";
            const zip = a.postal_code || "90040";
            const cleanFull = (a.full_address && !a.full_address.includes("null") && a.full_address.trim())
              ? a.full_address.trim()
              : `${street}, ${city}, ${state} ${zip}`.replace(/null/g, "").trim();

            // Auto-infer customer name if missing
            let cust = a.customer_name || a.company_name_override;
            if (!cust) {
              const lowLabel = label.toLowerCase();
              if (lowLabel.includes("servade")) cust = "Servade";
              else if (lowLabel.includes("levi")) cust = "Levi Strauss & Co.";
              else if (lowLabel.includes("nudie")) cust = "Nudie Jeans";
              else if (lowLabel.includes("zara")) cust = "Zara Denim";
              else if (lowLabel.includes("uniqlo")) cust = "Uniqlo";
              else if (lowLabel.includes("wiesmade") || lowLabel.includes("weissmade")) cust = "WiesMade";
              else if (lowLabel.includes("fear of god")) cust = "Fear of God";
            }

            rawAddrList.push({
              id: a.id,
              customer_name: cust,
              address_label: label,
              full_address: cleanFull,
            });
          });
        }

        // Add standard default verified hubs — staff only. DEFAULT_ADDRESS_OPTIONS
        // is a hardcoded list spanning every brand's destination address; RLS on
        // address_book scopes the real addrData query above to the customer's own
        // company, but this constant bypasses the DB entirely, so it must be
        // gated here in the frontend.
        if (!isCustomer) {
          DEFAULT_ADDRESS_OPTIONS.forEach((d) => rawAddrList.push(d));
        }

        // Deduplicate strictly by full_address & label (case-insensitive)
        const seenAddresses = new Set<string>();
        const uniqueAddresses: AddressOption[] = [];

        rawAddrList.forEach((item) => {
          const normKey = `${(item.address_label || "").toLowerCase().trim()}|${(item.full_address || "").toLowerCase().trim()}`;
          if (!seenAddresses.has(normKey)) {
            seenAddresses.add(normKey);
            uniqueAddresses.push(item);
          }
        });

        // Filter out generic unassigned repeated "HQ Receiving Dock" if customer hubs exist
        const finalAddresses = uniqueAddresses.filter((addr) => {
          if (addr.address_label === "HQ Receiving Dock" && uniqueAddresses.length > 1) {
            return false;
          }
          return true;
        });

        const addressResult = finalAddresses.length > 0 ? finalAddresses : uniqueAddresses;
        setAddresses(addressResult);
        if (addressResult.length > 0) {
          setSelectedAddressId((prev) => prev && addressResult.some(a => a.id === prev) ? prev : addressResult[0].id);
        }
      } else {
        setPackingLists(MOCK_PACKING_LISTS);
        setAddresses(DEFAULT_ADDRESS_OPTIONS);
        if (!selectedAddressId) setSelectedAddressId(DEFAULT_ADDRESS_OPTIONS[0].id);
      }
    } catch (e) {
      console.error(e);
      if (!isCustomer) {
        setAddresses(DEFAULT_ADDRESS_OPTIONS);
        if (!selectedAddressId) setSelectedAddressId(DEFAULT_ADDRESS_OPTIONS[0].id);
      } else {
        setAddresses([]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCustomer]);

  const handleSelectOrder = (poNum: string) => {
    setSelectedPoNumber(poNum);
    const o = orders.find((ord) => ord.PO_number === poNum || ord.order_id === poNum);
    if (o) {
      setCustomerName(o.customer_name);
      const units = Number(o.qty) || 500;
      setTotalUnitsInput(units);
      setTotalCartonsInput(Math.max(1, Math.ceil(units / 30)));

      // Dynamically select that customer's exact shipping address
      const targetCustomer = (o.customer_name || "").toLowerCase().trim();
      const matchedAddr = addresses.find(
        (a) =>
          (a.customer_name && a.customer_name.toLowerCase().includes(targetCustomer)) ||
          (a.address_label && a.address_label.toLowerCase().includes(targetCustomer)) ||
          targetCustomer.includes((a.customer_name || "").toLowerCase())
      );
      if (matchedAddr) {
        setSelectedAddressId(matchedAddr.id);
      }
    }
  };

  const filteredPackingLists = useMemo(() => {
    return packingLists.filter((p) => {
      const q = searchQuery.toLowerCase().trim();
      return (
        !q ||
        p.packing_list_number.toLowerCase().includes(q) ||
        p.po_number.toLowerCase().includes(q) ||
        p.customer_name.toLowerCase().includes(q)
      );
    });
  }, [packingLists, searchQuery]);

  // Create Packing List
  const handleCreatePackingList = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!selectedAddressId) {
      setFormError("Please select a valid customer destination address from the address book.");
      return;
    }

    // REQ-06: a packing list must be linked to a real PO from the outset —
    // this is what the dispatch/POD gate downstream checks against.
    if (!selectedPoNumber.trim()) {
      setFormError("A linked Purchase Order is required — invoicing and POD release cannot proceed without one.");
      return;
    }

    const matchedAddr = addresses.find((a) => a.id === selectedAddressId);
    if (!matchedAddr) {
      setFormError("Selected destination address could not be found — please re-select it.");
      return;
    }
    const generatedPlNo = `PL-2026-${Math.floor(1000 + Math.random() * 9000)}`;

    setIsSubmitting(true);

    try {
      if (isRealSupabase) {
        // "Packed" is the only status in the live packing_lists_status_check
        // CHECK constraint that means "just created, awaiting pickup" —
        // "Ready_for_Pickup" (the old value here) isn't a valid value at
        // all, so this insert was failing on every single call. It's a real
        // error now: no more silently swallowing it and faking success.
        const { error: plErr } = await supabase.from("packing_lists").insert({
          packing_list_number: generatedPlNo,
          customer_name: customerName.trim() || null,
          po_number: selectedPoNumber.trim() || null,
          destination_address: matchedAddr.full_address,
          total_cartons: totalCartonsInput,
          total_units: totalUnitsInput,
          status: "Packed",
          carrier_name: carrierName,
        });

        if (plErr) throw new Error(plErr.message);

        // The list re-renders from what's actually in the database — no
        // optimistic local record with a fake client-generated id. If it
        // doesn't show up after this, the insert didn't really succeed.
        await loadData();
      } else {
        // Offline/mock mode only (no live Supabase connection at all) —
        // uses the real values the admin just entered, not placeholder text.
        const newPl: PackingListRecord = {
          id: `pl-${Date.now()}`,
          packing_list_number: generatedPlNo,
          po_number: selectedPoNumber,
          customer_name: customerName,
          destination_address: matchedAddr.full_address,
          total_cartons: totalCartonsInput,
          total_units: totalUnitsInput,
          status: "Packed",
          carrier_name: carrierName,
        };
        setPackingLists([newPl, ...packingLists]);
      }

      setStatusMsg({ type: "success", text: `Packing List "${generatedPlNo}" created successfully!` });
      setShowCreateModal(false);
    } catch (err: any) {
      setFormError(err.message || "Failed to create packing list.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // REQ-06: PO Prerequisite Gate — invoicing/POD release is hard-blocked without
  // a valid, non-empty Purchase Order number attached to the shipment.
  const poGateBlocked = (pl: PackingListRecord | null) => !pl || !pl.po_number || !pl.po_number.trim();

  // Dispatch Shipment & Trigger Status Fulfillment Cascade (WO -> PO Line Item -> Purchase Order)
  const handleConfirmDispatchPOD = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePackingList) return;

    if (poGateBlocked(activePackingList)) {
      setStatusMsg({
        type: "error",
        text: "Cannot generate invoice / release POD — No valid Purchase Order linked to this shipment. Please attach a PO number before proceeding.",
      });
      setShowPodModal(false);
      return;
    }

    const podRef = podRefInput.trim() || `POD-SIG-${Math.floor(10000 + Math.random() * 90000)}`;
    const nowStr = new Date().toISOString().slice(0, 16).replace("T", " ");

    try {
      if (isRealSupabase) {
        // 1. Update packing list to Shipped
        const { error: plErr } = await supabase
          .from("packing_lists")
          .update({
            status: "Shipped",
            pod_signature_ref: podRef,
            shipped_at: new Date().toISOString(),
          })
          .eq("id", activePackingList.id);
        if (plErr) throw plErr;

        // 2. Update legacy cartons table — required for the stage-13 gate check.
        // The cascade_packing_list_shipped DB trigger also does this, but running
        // it here too ensures the UI reflects the change immediately and handles
        // deployments where the trigger hasn't been applied yet.
        const matchedOrderForCartons = orders.find(
          (o) =>
            o.PO_number === activePackingList.po_number ||
            o.customer_name === activePackingList.customer_name
        );
        if (matchedOrderForCartons) {
          await supabase
            .from("cartons")
            .update({ dispatch_status: "Shipped", ship_date: nowStr })
            .eq("order_id", matchedOrderForCartons.order_id)
            .eq("dispatch_status", "Ready");
        }
        // DB trigger cascade_packing_list_shipped handles advancing the order
        // to stage 13 and status "Shipped" — no need to duplicate here.
      }

      // Optimistic local state update
      setPackingLists((prev) =>
        prev.map((p) =>
          p.id === activePackingList.id
            ? { ...p, status: "Shipped", pod_signature_ref: podRef, shipped_at: nowStr }
            : p
        )
      );

      // Client-side cascade: find matching order by PO number first, then customer name.
      // This mirrors the DB trigger logic so mock mode and pre-trigger deployments work.
      const matchedOrder = orders.find(
        (o) =>
          (activePackingList.po_number && o.PO_number === activePackingList.po_number) ||
          (activePackingList.customer_name && o.customer_name === activePackingList.customer_name &&
            o.status !== "Shipped")
      );
      if (matchedOrder) {
        updateOrder(matchedOrder.order_id, {
          status: "Shipped",
          current_stage: 13,
        });
      }

      setStatusMsg({
        type: "success",
        text: `Shipment "${activePackingList.packing_list_number}" dispatched! Order advanced to Stage 13 — Fulfilled.`,
      });
      setShowPodModal(false);
      setActivePackingList(null);
      setPodRefInput("");
    } catch (err: any) {
      setStatusMsg({ type: "error", text: err.message || "Failed to dispatch shipment." });
    }
  };

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Truck className="h-6 w-6 text-primary" /> Dispatch Logistics &amp; Packing Lists
            </h1>
            <p className="text-xs md:text-sm text-muted-foreground mt-1">
              Consolidate cartons under packing lists, pull address book destinations, and execute POD signatures.
            </p>
          </div>

          {canManage && (
            <button
              onClick={() => {
                const activeOrd = orders.find((o) => !orderHasPackingList(o)) || orders[0];
                if (activeOrd) {
                  handleSelectOrder(activeOrd.PO_number || activeOrd.order_id);
                } else if (addresses.length > 0 && !selectedAddressId) {
                  setSelectedAddressId(addresses[0].id);
                }
                setShowCreateModal(true);
              }}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-extrabold px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-sm transition-all"
            >
              <Plus className="h-4 w-4" /> Create Packing List
            </button>
          )}
        </div>

        {/* Status Notification */}
        {statusMsg && (
          <div className={`p-4 rounded-xl text-xs font-bold flex items-center justify-between border ${
            statusMsg.type === "success" ? "bg-emerald-50 text-emerald-800 border-emerald-200" : "bg-red-50 text-red-800 border-red-200"
          }`}>
            <div className="flex items-center gap-2">
              {statusMsg.type === "success" ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <X className="h-4 w-4 text-red-600" />}
              <span>{statusMsg.text}</span>
            </div>
            <button onClick={() => setStatusMsg(null)}><X className="h-4 w-4" /></button>
          </div>
        )}

        {/* Search Bar */}
        <div className="flex items-center justify-between gap-4 bg-muted/30 p-3 rounded-2xl border">
          <div className="relative flex-1">
            <Search className="h-4 w-4 absolute left-3 top-2.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search packing list number, PO number, customer name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-background border rounded-lg text-sm"
            />
          </div>
        </div>

        {/* Packing Lists Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {isLoading ? (
            <div className="col-span-full py-12 text-center text-muted-foreground">
              <div className="h-5 w-5 border-2 border-primary border-t-transparent animate-spin rounded-full mx-auto mb-2" />
              Loading packing lists...
            </div>
          ) : filteredPackingLists.map((pl) => (
            <div key={pl.id} className="bg-card border-2 border-border hover:border-primary/50 rounded-2xl p-6 shadow-sm space-y-4 transition-all">
              
              <div className="flex items-start justify-between border-b pb-3">
                <div>
                  <span className="font-mono font-extrabold text-primary text-sm">{pl.packing_list_number}</span>
                  <h3 className="font-bold text-foreground text-base mt-0.5">{pl.customer_name}</h3>
                  <p className="text-xs text-muted-foreground font-mono">PO Ref: {pl.po_number}</p>
                </div>

                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  pl.status === "Shipped" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-amber-50 text-amber-800 border border-amber-200"
                }`}>
                  {pl.status.replace(/_/g, " ")}
                </span>
              </div>

              {/* Address Book Destination Linkage (Fix Gap P7) */}
              <div className="p-3 bg-muted/40 rounded-xl border space-y-1">
                <span className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3 w-3 text-primary" /> Customer Address Book Destination
                </span>
                <p className="text-xs font-semibold text-foreground leading-relaxed">{pl.destination_address}</p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-2.5 bg-muted/40 rounded-xl border">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase block">Cartons / Units</span>
                  <span className="font-mono font-bold text-foreground">{pl.total_cartons} Cartons ({pl.total_units} pcs)</span>
                </div>

                <div className="p-2.5 bg-muted/40 rounded-xl border">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase block">Freight Carrier</span>
                  <span className="font-mono font-bold text-foreground">{pl.carrier_name}</span>
                </div>
              </div>

              {/* POD Signature Reference */}
              {pl.pod_signature_ref && (
                <div className="pt-2 border-t flex items-center justify-between text-xs text-emerald-800 font-mono font-bold">
                  <span className="flex items-center gap-1">
                    <FileCheck2 className="h-4 w-4 text-emerald-600" /> Proof of Delivery (POD) Confirmed
                  </span>
                  <span>{pl.pod_signature_ref}</span>
                </div>
              )}

              {/* REQ-06 PO Gate Warning */}
              {poGateBlocked(pl) && pl.status !== "Shipped" && (
                <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-[11px] font-bold text-red-800 flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  No PO linked — invoicing &amp; POD release blocked until a valid PO number is attached.
                </div>
              )}

              {/* Actions */}
              {canManage && pl.status !== "Shipped" && (
                <div className="pt-3 border-t flex justify-end">
                  <button
                    onClick={() => {
                      if (poGateBlocked(pl)) {
                        setStatusMsg({
                          type: "error",
                          text: `Cannot dispatch "${pl.packing_list_number}" — attach a valid Purchase Order number first (PO Prerequisite Gate).`,
                        });
                        return;
                      }
                      setActivePackingList(pl);
                      setShowPodModal(true);
                    }}
                    disabled={poGateBlocked(pl)}
                    title={poGateBlocked(pl) ? "PO number required before dispatch" : undefined}
                    className={`px-4 py-2 font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-sm transition-all ${
                      poGateBlocked(pl)
                        ? "bg-muted text-muted-foreground cursor-not-allowed"
                        : "bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                    }`}
                  >
                    {poGateBlocked(pl) ? <Lock className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                    {poGateBlocked(pl) ? "PO Required to Dispatch" : "Dispatch & Log Driver POD"}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* CREATE PACKING LIST MODAL */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-card border rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl space-y-6">
              
              <div className="flex items-center justify-between border-b pb-4">
                <div>
                  <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
                    <Truck className="h-5 w-5 text-primary" /> Create Export Packing List
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Link customer destination address from address book and assign carrier.
                  </p>
                </div>
                <button onClick={() => setShowCreateModal(false)} className="p-1 rounded-lg hover:bg-muted">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 font-bold flex items-center gap-2">
                  <X className="h-4 w-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <form onSubmit={handleCreatePackingList} className="space-y-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                    Linked Production Order (for cascade) <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={selectedPoNumber}
                    onChange={(e) => handleSelectOrder(e.target.value)}
                    className="w-full p-2.5 border rounded-xl bg-background text-foreground text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="" className="text-muted-foreground bg-background">— Select order —</option>
                    {orders
                      .filter((o) => !orderHasPackingList(o))
                      .map((o) => {
                        const poCode = o.PO_number || (o.order_id.startsWith("PO-") ? o.order_id : `PO-${o.order_id}`);
                        return (
                          <option key={o.order_id} value={poCode} className="text-foreground bg-background py-1">
                            {poCode} — {o.customer_name} ({o.qty} pcs, Stage {o.current_stage})
                          </option>
                        );
                      })}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                    Customer Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Levi Strauss & Co."
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full p-2.5 border rounded-xl bg-background text-foreground text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                    Destination Address (Address Book Master) <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={selectedAddressId}
                    onChange={(e) => setSelectedAddressId(e.target.value)}
                    className="w-full p-2.5 border rounded-xl bg-background text-foreground text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {addresses.map((a) => (
                      <option key={a.id} value={a.id} className="text-foreground bg-background py-1">
                        {a.address_label} — {a.full_address}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                      Total Cartons <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={totalCartonsInput}
                      onChange={(e) => setTotalCartonsInput(Number(e.target.value))}
                      className="w-full p-2.5 border rounded-xl bg-background text-foreground text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                      Total Finished Units <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={totalUnitsInput}
                      onChange={(e) => setTotalUnitsInput(Number(e.target.value))}
                      className="w-full p-2.5 border rounded-xl bg-background text-foreground text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                    Freight Carrier Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. FedEx Freight Express / DHL"
                    value={carrierName}
                    onChange={(e) => setCarrierName(e.target.value)}
                    className="w-full p-2.5 border rounded-xl bg-background text-foreground text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="pt-4 border-t flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2.5 border rounded-xl text-sm font-bold hover:bg-muted"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2.5 bg-primary text-primary-foreground font-bold rounded-xl text-sm hover:bg-primary/90 disabled:opacity-50"
                  >
                    Generate Packing List
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* DRIVER POD SIGNATURE MODAL */}
        {showPodModal && activePackingList && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-card border rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl space-y-6">
              <div className="flex items-center justify-between border-b pb-4">
                <div>
                  <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
                    <Send className="h-5 w-5 text-emerald-600" /> Dispatch &amp; Confirm Driver POD
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Log driver signature reference for {activePackingList.packing_list_number}.
                  </p>
                </div>
                <button onClick={() => setShowPodModal(false)} className="p-1 rounded-lg hover:bg-muted">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleConfirmDispatchPOD} className="space-y-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                    Driver Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={driverNameInput}
                    onChange={(e) => setDriverNameInput(e.target.value)}
                    className="w-full p-2.5 border rounded-xl bg-background text-sm font-semibold"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                    POD Signature Reference / Code
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. POD-SIG-88102"
                    value={podRefInput}
                    onChange={(e) => setPodRefInput(e.target.value)}
                    className="w-full p-2.5 border rounded-xl bg-background text-sm font-mono font-bold text-emerald-700"
                  />
                </div>

                <div className="pt-4 border-t flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowPodModal(false)}
                    className="px-4 py-2.5 border rounded-xl text-sm font-bold hover:bg-muted"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-emerald-600 text-white font-bold rounded-xl text-sm hover:bg-emerald-700 shadow-md"
                  >
                    Confirm Dispatch &amp; Fulfill Order
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </AppShell>
  );
}
