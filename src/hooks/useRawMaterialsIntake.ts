import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, isRealSupabase, isSupabaseConfigured } from "../lib/supabase";
import { useAuth } from "./useAuth";
import type { RawMaterialsIntake, MaterialStatus, Facility, MaterialCategory } from "../lib/types";

const LOCAL_STORAGE_RAW_MATS_KEY = "forge_flow_raw_materials_intake";

const SEED_RAW_MATERIALS: RawMaterialsIntake[] = [
  {
    id: "rmi-seed-1",
    intake_number: "RMI-2026-0001",
    facility: "Sewing Facility",
    item_name: "13.5oz Kurabo Selvedge Raw Denim",
    category: "Fabric",
    supplier: "Kurabo Mills Japan",
    supplier_po: "KMB-9941",
    quantity_expected: 2500,
    quantity_received: 2500,
    quantity_damaged: 15,
    quantity_accepted: 2485,
    unit: "Yards",
    lot_number: "LOT-KB-882",
    shade_lot: "SHD-INDIGO-A",
    storage_location: "Warehouse A - Bay 04",
    status: "Approved",
    received_date: "2026-08-01",
    notes: "Grade A selvedge rolls verified with Kurabo inspection certificate.",
    created_at: new Date(Date.now() - 6 * 86400000).toISOString(),
  },
  {
    id: "rmi-seed-2",
    intake_number: "RMI-2026-0002",
    facility: "Sewing Facility",
    item_name: "Tex-80 Core Spun Indigo Sewing Thread",
    category: "Thread",
    supplier: "Coats Group",
    supplier_po: "CG-5520",
    quantity_expected: 400,
    quantity_received: 400,
    quantity_damaged: 0,
    quantity_accepted: 400,
    unit: "Rolls",
    lot_number: "LOT-CT-201",
    shade_lot: "Indigo Contrast Gold",
    storage_location: "Sewing Floor - Rack 2",
    status: "Received",
    received_date: "2026-08-03",
    notes: "High-tensile seam thread for waistbands and seat seams.",
    created_at: new Date(Date.now() - 4 * 86400000).toISOString(),
  },
  {
    id: "rmi-seed-3",
    intake_number: "RMI-2026-0003",
    facility: "Laundry Facility",
    item_name: "Eco-Enzyme Cellulase Wash Powder",
    category: "Chemical",
    supplier: "CHT Chemical Solutions",
    supplier_po: "CHT-8812",
    quantity_expected: 500,
    quantity_received: 500,
    quantity_damaged: 0,
    quantity_accepted: 500,
    unit: "Kg",
    lot_number: "LOT-CHT-55",
    shade_lot: "Standard",
    storage_location: "Chemical Bay 1",
    status: "Approved",
    received_date: "2026-08-04",
    notes: "Low-temperature neutral cellulase for vintage denim abrasion.",
    created_at: new Date(Date.now() - 3 * 86400000).toISOString(),
  },
  {
    id: "rmi-seed-4",
    intake_number: "RMI-2026-0004",
    facility: "Laundry Facility",
    item_name: "Turkish Natural Pumice Stones (Grade 3)",
    category: "Other",
    supplier: "Aegean Stone Minerals",
    supplier_po: "ASM-102",
    quantity_expected: 1200,
    quantity_received: 1200,
    quantity_damaged: 40,
    quantity_accepted: 1160,
    unit: "Kg",
    lot_number: "LOT-PS-909",
    shade_lot: "3-5cm Size",
    storage_location: "Wash House Hopper Bin",
    status: "In QC",
    received_date: "2026-08-05",
    notes: "Density check in progress for drum abrasion test.",
    created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
  {
    id: "rmi-seed-5",
    intake_number: "RMI-2026-0005",
    facility: "Sewing Facility",
    item_name: "Custom Embossed Antique Brass Donut Buttons (17mm)",
    category: "Button",
    supplier: "YKK Snap Fasteners",
    supplier_po: "YKK-7741",
    quantity_expected: 15000,
    quantity_received: 15000,
    quantity_damaged: 50,
    quantity_accepted: 14950,
    unit: "Pieces",
    lot_number: "LOT-YKK-33",
    shade_lot: "Antique Brass 02",
    storage_location: "Trims Vault - Shelf 12",
    status: "Approved",
    received_date: "2026-08-06",
    notes: "Logo engraving aligned with technical specification.",
    created_at: new Date(Date.now() - 1 * 86400000).toISOString(),
  },
];

export function useRawMaterialsIntake() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isRealSupabase = isSupabaseConfigured();

  const [localIntakes, setLocalIntakes] = useState<RawMaterialsIntake[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_RAW_MATS_KEY);
      if (saved) return JSON.parse(saved);
      localStorage.setItem(LOCAL_STORAGE_RAW_MATS_KEY, JSON.stringify(SEED_RAW_MATERIALS));
      return SEED_RAW_MATERIALS;
    } catch {
      return SEED_RAW_MATERIALS;
    }
  });

  // Query raw materials from Supabase
  const {
    data: supabaseIntakes = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["raw_materials_intake"],
    queryFn: async () => {
      if (!isRealSupabase) return [];
      const { data, error } = await supabase
        .from("raw_materials_intake")
        .select("*")
        .order("received_date", { ascending: false });

      if (error) {
        console.warn("Failed to fetch raw_materials_intake from Supabase:", error);
        return [];
      }

      return (data || []).map((row: any) => ({
        ...row,
        quantity_expected: Number(row.quantity_expected) || 0,
        quantity_received: Number(row.quantity_received) || 0,
        quantity_damaged: Number(row.quantity_damaged) || 0,
        quantity_accepted: Number(row.quantity_accepted ?? (row.quantity_received - row.quantity_damaged)) || 0,
      })) as RawMaterialsIntake[];
    },
    enabled: isRealSupabase,
    retry: 2,
  });

  // Supabase Realtime Subscription
  useEffect(() => {
    if (!isRealSupabase) return;

    const channel = supabase
      .channel("raw_materials_intake_realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "raw_materials_intake",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["raw_materials_intake"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isRealSupabase, queryClient]);

  // Combine Supabase data or local state
  const intakes: RawMaterialsIntake[] = useMemo(() => {
    if (isRealSupabase && supabaseIntakes.length > 0) {
      return supabaseIntakes;
    }
    return localIntakes;
  }, [isRealSupabase, supabaseIntakes, localIntakes]);

  // Create Intake Mutation
  const createIntakeMutation = useMutation({
    mutationFn: async (payload: Omit<RawMaterialsIntake, "id" | "intake_number" | "created_at">) => {
      const intakeNumber = `RMI-2026-${Math.floor(1000 + Math.random() * 9000)}`;
      const netAccepted = Math.max(0, payload.quantity_received - payload.quantity_damaged);
      
      const newIntake: RawMaterialsIntake = {
        ...payload,
        id: `rmi-${Date.now()}`,
        intake_number: intakeNumber,
        quantity_accepted: netAccepted,
        created_at: new Date().toISOString(),
      };

      // 1. Update local storage
      const updated = [newIntake, ...localIntakes];
      setLocalIntakes(updated);
      try {
        localStorage.setItem(LOCAL_STORAGE_RAW_MATS_KEY, JSON.stringify(updated));
      } catch (e) {
        console.error("Local storage error:", e);
      }

      // 2. Insert to Supabase if connected
      if (isRealSupabase) {
        try {
          const { error } = await supabase.from("raw_materials_intake").insert({
            facility: payload.facility,
            work_order_id: payload.work_order_id || null,
            blanket_po_id: payload.blanket_po_id || null,
            item_name: payload.item_name,
            category: payload.category,
            supplier: payload.supplier || null,
            supplier_po: payload.supplier_po || null,
            quantity_expected: payload.quantity_expected,
            quantity_received: payload.quantity_received,
            quantity_damaged: payload.quantity_damaged,
            unit: payload.unit,
            lot_number: payload.lot_number || null,
            shade_lot: payload.shade_lot || null,
            storage_location: payload.storage_location || null,
            status: payload.status,
            received_date: payload.received_date,
            expected_date: payload.expected_date || null,
            notes: payload.notes || null,
          });
          if (error) console.warn("Supabase raw_materials_intake insert:", error.message);
        } catch (dbErr) {
          console.warn("Supabase db insert fallback:", dbErr);
        }
      }

      return newIntake;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["raw_materials_intake"] });
    },
  });

  // Update Status Mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: MaterialStatus }) => {
      const updated = localIntakes.map((item) =>
        item.id === id ? { ...item, status, updated_at: new Date().toISOString() } : item
      );
      setLocalIntakes(updated);
      try {
        localStorage.setItem(LOCAL_STORAGE_RAW_MATS_KEY, JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }

      if (isRealSupabase) {
        try {
          await supabase.from("raw_materials_intake").update({ status }).eq("id", id);
        } catch (e) {
          console.warn("Supabase update error:", e);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["raw_materials_intake"] });
    },
  });

  // Delete Mutation
  const deleteIntakeMutation = useMutation({
    mutationFn: async (id: string) => {
      const updated = localIntakes.filter((i) => i.id !== id);
      setLocalIntakes(updated);
      try {
        localStorage.setItem(LOCAL_STORAGE_RAW_MATS_KEY, JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }

      if (isRealSupabase) {
        try {
          await supabase.from("raw_materials_intake").delete().eq("id", id);
        } catch (e) {
          console.warn("Supabase delete error:", e);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["raw_materials_intake"] });
    },
  });

  return {
    intakes,
    isLoading,
    refetch,
    createIntake: createIntakeMutation.mutateAsync,
    updateStatus: updateStatusMutation.mutateAsync,
    deleteIntake: deleteIntakeMutation.mutateAsync,
  };
}
