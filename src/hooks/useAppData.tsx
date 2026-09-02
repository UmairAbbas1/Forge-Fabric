import { createContext, useContext, useEffect, useRef, useState, useMemo, useCallback, type ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, isRealSupabase, type Profile, getMockProfiles, saveMockProfiles } from "../lib/supabase";
import { useAuth } from "./useAuth";
import { appCache } from "../lib/cacheAndRateLimiter";
import { eventQueue } from "../lib/eventQueue";
import {
  ORDERS as seedOrders,
  MATERIALS as seedMaterials,
  CUTTING as seedCutting,
  SEWING as seedSewing,
  WASH as seedWash,
  QC as seedQC,
  CARTONS as seedCartons,
  MOCK_WIP_LOGS as seedWipLogs,
  STAGES,
  type Order,
  type Material,
  type CuttingRecord,
  type SewingBundle,
  type WashBatch,
  type QCRecord,
  type Carton,
  type WIPLog,
  type WIPMovementType,
  type WIPQCStatus,
} from "../lib/mockData";
import type { WorkOrder, BlanketPO } from "../lib/types";
import { useAllOutsourceRecords, type OutsourceRecord } from "./useOutsourcing";

// Minimal shape of the real cut_tickets table (src/routes/cutting.tsx is the
// authoritative writer) — just what QC's ticket-existence check needs.
export interface CutTicketRecordSummary {
  id: string;
  ticket_number: string;
  work_order_id: string;
  status: string;
  total_planned_pcs?: number;
}

// Minimal shape of the real sewing_tickets table (src/routes/sewing.tsx is
// the authoritative writer) — the real source for "has this order's sewing
// been completed", used by both the Kanban stage-7 gate and QC's
// ticket-existence check. sewing_bundles is a legacy mirror table kept only
// as a fallback for orders that never used the ticket-based flow.
export interface SewingTicketRecordSummary {
  id: string;
  ticket_number: string;
  work_order_id: string;
  status: string;
  total_planned_pcs?: number;
}

export interface Customer {
  id: string;
  name: string;
  contact: string;
  billing_address?: string;
  shipping_address?: string;
}

/**
 * Repairs (or drops) a Customer record whose name/contact somehow ended up
 * as an object instead of a string — a real, historical bug (a caller once
 * passed a whole Customer object where addCustomer expects (name, contact)
 * strings — see the "Fix: addCustomer expects (name: string, contact:
 * string) — not an object" comment in useConvertSubmission.ts) could have
 * written one of these into a browser's localStorage, or even the live DB,
 * before that call site was corrected. Left unsanitized, it crashes EVERY
 * customers.map() render app-wide (Edit Order modal's <option>, Settings'
 * customer list, the intake form's customer picker) on every future visit,
 * for every order, until this exact record is found and cleaned — not
 * anything wrong with whichever order happened to be open at the time.
 * Applied once at the single point every consumer reads `customers` from,
 * so it self-heals without the user ever needing to clear browser storage.
 */
function sanitizeCustomers(list: Customer[]): Customer[] {
  const result: Customer[] = [];
  for (const c of list) {
    if (typeof c?.name === "string" && c.name.trim()) {
      result.push(typeof c.contact === "string" ? c : { ...c, contact: typeof c.contact === "string" ? c.contact : "" });
      continue;
    }
    // c.name is an object (the corrupted shape) — recover the real name/
    // contact from inside it if possible, rather than just discarding a
    // real customer record outright.
    const nested = c?.name as any;
    if (nested && typeof nested === "object" && typeof nested.name === "string") {
      result.push({ ...c, name: nested.name, contact: typeof c.contact === "string" ? c.contact : (typeof nested.contact === "string" ? nested.contact : "") });
      continue;
    }
    // Unrecoverable — drop it rather than ever handing a non-string name
    // to a component that renders it as text.
  }
  return result;
}

export interface Equipment {
  id: string;
  name: string;
  type: string;
  status: "Active" | "Inactive";
}

export interface Checkpoint {
  id: string;
  name: string;
  stage: string;
  aql_limit: string;
}

export interface SizeRatio {
  id: string;
  name: string;
  description?: string;
}

export const SEED_SIZE_RATIOS: SizeRatio[] = [
  { id: "sr-1", name: "28–38", description: "Men's Standard Waist (28-38)" },
  { id: "sr-2", name: "30–40", description: "Men's Extended Waist (30-40)" },
  { id: "sr-3", name: "S–XXL", description: "Standard Top/Apparel Sizes (S-XXL)" },
  { id: "sr-4", name: "26–36", description: "Slim/Junior Waist (26-36)" },
  { id: "sr-5", name: "XS–XL", description: "Slim Top/Women's Sizes (XS-XL)" },
  { id: "sr-6", name: "24–34", description: "Women's Denim Waist (24-34)" },
  { id: "sr-7", name: "3XL–5XL", description: "Plus Size Apparel (3XL-5XL)" },
  { id: "sr-8", name: "One Size", description: "Free Size / Accessories" },
];

export interface Notification {
  id: string;
  message: string;
  order_id: string;
  type: "hold" | "reject" | "slow_stage" | "overdue" | "qc_checkpoint_pending" | "stage_advance" | "rework" | "status_update" | "material_shortage";
  read: boolean;
  stage_id: number;
  created_at: string;
}

interface AppDataContextType {
  orders: Order[];
  materials: Material[];
  cutting: CuttingRecord[];
  /** Real cut_tickets rows — the authoritative source for "does a real cut ticket exist for this order", used by QC's ticket-existence check. See CutTicketRecordSummary. */
  cutTickets: CutTicketRecordSummary[];
  /** Real sewing_tickets rows — the authoritative source for "has this order's sewing been completed", used by the Kanban stage-7 gate and QC's ticket-existence check. See SewingTicketRecordSummary. */
  sewingTickets: SewingTicketRecordSummary[];
  sewing: SewingBundle[];
  wash: WashBatch[];
  qc: QCRecord[];
  cartons: Carton[];
  wipLogs: WIPLog[];
  workOrders: WorkOrder[];
  /** REQ-15: every stage_outsourcing_records row, staff-only (RLS is_internal_staff()) — powers the outsource QC advancement gate. */
  outsourceRecords: OutsourceRecord[];
  customers: Customer[];
  equipment: Equipment[];
  checkpoints: Checkpoint[];
  sizeRatios: SizeRatio[];
  notifications: Notification[];
  createWorkOrder: (wo: Partial<WorkOrder>) => Promise<any>;
  createOrderBatch: (batch: {
    parent_order_id: string;
    target_qty: number;
    size_breakdown: string;
    flavor_route: string;
    starting_stage_id: number;
    assigned_facility: string;
  }) => Promise<Order>;
  addOrder: (order: Omit<Order, "created_date">) => void;
  // Exposed so callers that need to confirm a real order write succeeded
  // (e.g. submission conversion) can await it and throw on failure.
  addOrderMutation: { mutateAsync: (order: Order) => Promise<unknown> };
  updateOrder: (orderId: string, fields: Partial<Order>) => void;
  deleteOrder: (orderId: string) => void;
  deleteCustomerCascade: (customerName: string) => void;
  addMaterial: (material: Material) => void;
  updateMaterialInspection: (materialId: string, status: Material["inspection_status"]) => void;
  addCuttingRecord: (record: CuttingRecord) => void;
  updateCuttingRecord: (cutId: string, fields: Partial<CuttingRecord>) => void;
  addSewingBundle: (bundle: SewingBundle) => void;
  updateSewingBundle: (bundleId: string, fields: Partial<SewingBundle>) => void;
  addWashBatch: (batch: WashBatch) => void;
  updateWashBatch: (batchId: string, fields: Partial<WashBatch>) => void;
  addQCRecord: (record: QCRecord) => void;
  addCarton: (carton: Carton) => void;
  updateCartonDispatch: (cartonId: string, fields: Partial<Carton>) => void;
  addWIPLog: (log: Omit<WIPLog, "log_id" | "log_date">) => void;
  importExcelTrackerPackage: (fileText: string) => Promise<{ ordersCount: number; wipLogsCount: number; cartonsCount: number }>;
  exportExcelTrackerPackage: () => void;
  addCustomer: (name: string, contact: string) => void;
  updateCustomer: (customerId: string, fields: Partial<Customer>) => void;
  updateProfileSettings: (fields: Partial<Profile>) => Promise<void>;
  addEquipment: (name: string, type: string) => void;
  toggleEquipmentStatus: (equipmentId: string) => void;
  updateCheckpoint: (checkpointId: string, fields: Partial<Checkpoint>) => void;
  addSizeRatio: (name: string, description?: string) => void;
  deleteSizeRatio: (id: string) => void;
  markNotificationAsRead: (notificationId: string) => void;
  advanceOrderStage: (orderId: string, toStage: number) => void;
  isOrderOnHold: (orderId: string) => boolean;
  /** Staff-triggered customer-facing alert — inserts a real notifications row scoped to this order_id, so it shows up in that customer's own portal bell (see scopedNotifications) in real time. Used by Shop Floor WIP's "Notify Customer" action. */
  notifyMaterialShortage: (orderId: string, message: string) => void;
  isLoading: boolean;
  toast: { message: string; type: "success" | "info" | "error" } | null;
  setToast: (toast: { message: string; type: "success" | "info" | "error" } | null) => void;
  globalSearchQuery: string;
  setGlobalSearchQuery: (query: string) => void;
}

const AppDataContext = createContext<AppDataContextType | undefined>(undefined);

const LOCAL_STORAGE_KEYS = {
  orders: "forge_flow_orders",
  materials: "forge_flow_materials",
  cutting: "forge_flow_cutting",
  sewing: "forge_flow_sewing",
  wash: "forge_flow_wash",
  qc: "forge_flow_qc",
  cartons: "forge_flow_cartons",
  wipLogs: "forge_flow_wip_logs",
  customers: "forge_flow_customers",
  equipment: "forge_flow_equipment",
  checkpoints: "forge_flow_checkpoints",
  sizeRatios: "forge_flow_size_ratios",
  notifications: "forge_flow_notifications",
};

const SEED_CUSTOMERS: Customer[] = [
  { id: "cust-1", name: "Demo Brand", contact: "brand@demobrand.com" },
  { id: "cust-2", name: "H&M Group", contact: "production.se@hm.com" },
  { id: "cust-3", name: "Uniqlo Global", contact: "quality.tokyo@uniqlo.com" },
  { id: "cust-4", name: "Zara Denim", contact: "sourcing@inditex.com" },
  { id: "cust-5", name: "Gap Inc.", contact: "logistics@gap.com" },
  { id: "cust-6", name: "Diesel S.p.A.", contact: "it.denim@diesel.com" },
  { id: "cust-7", name: "Nudie Jeans", contact: "organic.denim@nudie.com" },
];

const SEED_EQUIPMENT: Equipment[] = [
  { id: "eq-1", name: "40 ft Auto Cutter A", type: "Cutter", status: "Active" },
  { id: "eq-2", name: "40 ft Auto Cutter B", type: "Cutter", status: "Active" },
  { id: "eq-3", name: "Manual Cut Table 1", type: "Cutter", status: "Active" },
  { id: "eq-4", name: "Line 1", type: "Sewing Line", status: "Active" },
  { id: "eq-5", name: "Line 2", type: "Sewing Line", status: "Active" },
  { id: "eq-6", name: "Line 3", type: "Sewing Line", status: "Active" },
  { id: "eq-7", name: "Industrial Washer #3", type: "Washer", status: "Active" },
  { id: "eq-8", name: "Jeanologia Laser", type: "Laser", status: "Active" },
  { id: "eq-9", name: "Ozone Booth", type: "Laser/Ozone", status: "Active" },
  { id: "eq-10", name: "Spray Booth", type: "Spray", status: "Active" },
  { id: "eq-11", name: "Steam Presser", type: "Finishing", status: "Active" },
];

const SEED_CHECKPOINTS: Checkpoint[] = [
  { id: "cp-1", name: "Material Sourcing/Receiving Check", stage: "Stage 2 & 3", aql_limit: "2.5" },
  { id: "cp-2", name: "First Cut Panel Approval", stage: "Stage 5", aql_limit: "1.5" },
  { id: "cp-3", name: "Inline Sewing QC Check", stage: "Stage 8", aql_limit: "2.5" },
  { id: "cp-4", name: "Wash/Finish Appearance Quality", stage: "Stage 11", aql_limit: "4.0" },
  { id: "cp-5", name: "Final AQL Pack Inspection", stage: "Stage 12", aql_limit: "2.5" },
];

export function AppDataProvider({ children }: { children: ReactNode }) {
  const { user, refreshUser } = useAuth();
  const queryClient = useQueryClient();
  
  // Local storage state fallbacks for mock mode
  const [localOrders, setLocalOrders] = useState<Order[]>([]);
  const [localMaterials, setLocalMaterials] = useState<Material[]>([]);
  const [localCutting, setLocalCutting] = useState<CuttingRecord[]>([]);
  const [localSewing, setLocalSewing] = useState<SewingBundle[]>([]);
  const [localWash, setLocalWash] = useState<WashBatch[]>([]);
  const [localQc, setLocalQc] = useState<QCRecord[]>([]);
  const [localCartons, setLocalCartons] = useState<Carton[]>([]);
  const [localWipLogs, setLocalWipLogs] = useState<WIPLog[]>([]);

  // Config tables state
  const [localCustomers, setLocalCustomers] = useState<Customer[]>([]);
  const [localEquipment, setLocalEquipment] = useState<Equipment[]>([]);
  const [localCheckpoints, setLocalCheckpoints] = useState<Checkpoint[]>([]);
  const [localSizeRatios, setLocalSizeRatios] = useState<SizeRatio[]>([]);
  
  // Notifications state
  const [localNotifications, setLocalNotifications] = useState<Notification[]>([]);

  // Toast notifications state
  const [toast, setToastState] = useState<{ message: string; type: "success" | "info" | "error" } | null>(null);
  const setToast = (t: { message: string; type: "success" | "info" | "error" } | null) => {
    setToastState(t);
    if (t) {
      setTimeout(() => setToastState(null), 4000);
    }
  };

  // Global search state
  const [globalSearchQuery, setGlobalSearchQuery] = useState("");


  // Load from local storage for mock mode
  useEffect(() => {
    if (typeof window === "undefined") return;

    const loadData = <T,>(key: string, seed: T[]): T[] => {
      const stored = localStorage.getItem(key);
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch (e) {
          console.error(`Failed parsing ${key}`, e);
        }
      }
      localStorage.setItem(key, JSON.stringify(seed));
      return seed;
    };

    setLocalOrders(loadData(LOCAL_STORAGE_KEYS.orders, seedOrders as Order[]));
    setLocalMaterials(loadData(LOCAL_STORAGE_KEYS.materials, seedMaterials as Material[]));
    setLocalCutting(loadData(LOCAL_STORAGE_KEYS.cutting, seedCutting as CuttingRecord[]));
    setLocalSewing(loadData(LOCAL_STORAGE_KEYS.sewing, seedSewing as SewingBundle[]));
    setLocalWash(loadData(LOCAL_STORAGE_KEYS.wash, seedWash as WashBatch[]));
    setLocalQc(loadData(LOCAL_STORAGE_KEYS.qc, seedQC as QCRecord[]));
    setLocalCartons(loadData(LOCAL_STORAGE_KEYS.cartons, seedCartons as Carton[]));
    setLocalWipLogs(loadData(LOCAL_STORAGE_KEYS.wipLogs, seedWipLogs as WIPLog[]));

    // Self-heals a corrupted customers entry (name stored as an object —
    // see sanitizeCustomers) permanently: if sanitizing actually dropped or
    // repaired something, write the cleaned list straight back to
    // localStorage so this browser never loads the bad record again on any
    // future visit, not just this one.
    const rawStoredCustomers = loadData(LOCAL_STORAGE_KEYS.customers, SEED_CUSTOMERS);
    const cleanedStoredCustomers = sanitizeCustomers(rawStoredCustomers);
    if (cleanedStoredCustomers.length !== rawStoredCustomers.length) {
      localStorage.setItem(LOCAL_STORAGE_KEYS.customers, JSON.stringify(cleanedStoredCustomers));
    }
    setLocalCustomers(cleanedStoredCustomers);
    setLocalEquipment(loadData(LOCAL_STORAGE_KEYS.equipment, SEED_EQUIPMENT));
    setLocalCheckpoints(loadData(LOCAL_STORAGE_KEYS.checkpoints, SEED_CHECKPOINTS));
    setLocalSizeRatios(loadData(LOCAL_STORAGE_KEYS.sizeRatios, SEED_SIZE_RATIOS));
    setLocalNotifications(loadData(LOCAL_STORAGE_KEYS.notifications, []));

    const handleStorageChange = (e: StorageEvent) => {
      if (!e.newValue) return;
      try {
        const parsed = JSON.parse(e.newValue);
        switch (e.key) {
          case LOCAL_STORAGE_KEYS.orders: setLocalOrders(parsed); break;
          case LOCAL_STORAGE_KEYS.materials: setLocalMaterials(parsed); break;
          case LOCAL_STORAGE_KEYS.cutting: setLocalCutting(parsed); break;
          case LOCAL_STORAGE_KEYS.sewing: setLocalSewing(parsed); break;
          case LOCAL_STORAGE_KEYS.wash: setLocalWash(parsed); break;
          case LOCAL_STORAGE_KEYS.qc: setLocalQc(parsed); break;
          case LOCAL_STORAGE_KEYS.cartons: setLocalCartons(parsed); break;
          case LOCAL_STORAGE_KEYS.wipLogs: setLocalWipLogs(parsed); break;
          case LOCAL_STORAGE_KEYS.customers: setLocalCustomers(sanitizeCustomers(parsed)); break;
          case LOCAL_STORAGE_KEYS.equipment: setLocalEquipment(parsed); break;
          case LOCAL_STORAGE_KEYS.checkpoints: setLocalCheckpoints(parsed); break;
          case LOCAL_STORAGE_KEYS.sizeRatios: setLocalSizeRatios(parsed); break;
          case LOCAL_STORAGE_KEYS.notifications: setLocalNotifications(parsed); break;
        }
      } catch (err) {
        console.error("Error parsing storage event", err);
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  const saveToStorage = (key: string, data: any) => {
    if (typeof window === "undefined") return;
    localStorage.setItem(key, JSON.stringify(data));
  };

  // React Query Fetching from live Supabase Tables
  // staleTime: 60s — prevents re-fetching on every window focus / component remount
  // retry: 1    — fail fast instead of retrying 3 times with exponential backoff (~30s freeze)
  const { data: dbOrders = [], isLoading: isLoadingOrders } = useQuery<Order[]>({
    queryKey: ["orders", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("orders").select("*");
      if (error) throw error;
      return (data || []).map((o: any) => ({
        ...o,
        PO_number: o.po_number,
      }));
    },
    enabled: isRealSupabase && !!user,
    staleTime: 1_000,
    retry: 1,
  });

  const { data: dbMaterials = [], isLoading: isLoadingMaterials } = useQuery<Material[]>({
    queryKey: ["materials", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("materials").select("*");
      if (error) throw error;
      return data || [];
    },
    enabled: isRealSupabase && !!user,
    staleTime: 1_000,
    retry: 1,
  });

  const { data: dbCutting = [], isLoading: isLoadingCutting } = useQuery<CuttingRecord[]>({
    queryKey: ["cutting_records", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("cutting_records").select("*");
      if (error) throw error;
      return data || [];
    },
    enabled: isRealSupabase && !!user,
    staleTime: 1_000,
    retry: 1,
  });

  // The real, authoritative cut-ticket table (src/routes/cutting.tsx writes
  // here directly). cutting_records above is a legacy mirror table that
  // cutting.tsx best-effort upserts into as a side effect after the real
  // write — a silent failure there (network hiccup, constraint conflict,
  // future RLS change) desyncs anything reading only cutting_records from
  // reality. QC's ticket-existence check reads this table directly instead,
  // so it can never go stale relative to a real, completed cut ticket.
  const { data: dbCutTickets = [], isLoading: isLoadingCutTickets } = useQuery<CutTicketRecordSummary[]>({
    queryKey: ["cut_tickets", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("cut_tickets").select("id, ticket_number, work_order_id, status, total_planned_pcs");
      if (error) throw error;
      return data || [];
    },
    enabled: isRealSupabase && !!user,
    staleTime: 1_000,
    retry: 1,
  });

  const { data: dbSewingTickets = [], isLoading: isLoadingSewingTickets } = useQuery<SewingTicketRecordSummary[]>({
    queryKey: ["sewing_tickets", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("sewing_tickets").select("id, ticket_number, work_order_id, status, total_planned_pcs");
      if (error) throw error;
      return data || [];
    },
    enabled: isRealSupabase && !!user,
    staleTime: 1_000,
    retry: 1,
  });

  const { data: dbSewing = [], isLoading: isLoadingSewing } = useQuery<SewingBundle[]>({
    queryKey: ["sewing_bundles", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("sewing_bundles").select("*");
      if (error) throw error;
      return data || [];
    },
    enabled: isRealSupabase && !!user,
    staleTime: 1_000,
    retry: 1,
  });

  const { data: dbWash = [], isLoading: isLoadingWash } = useQuery<WashBatch[]>({
    queryKey: ["wash_batches", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("wash_batches").select("*");
      if (error) throw error;
      return data || [];
    },
    enabled: isRealSupabase && !!user,
    staleTime: 1_000,
    retry: 1,
  });

  const { data: dbQc = [], isLoading: isLoadingQc } = useQuery<QCRecord[]>({
    queryKey: ["qc_records", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("qc_records").select("*");
      if (error) throw error;
      return data || [];
    },
    enabled: isRealSupabase && !!user,
    staleTime: 1_000,
    retry: 1,
  });

  const { data: dbCartons = [], isLoading: isLoadingCartons } = useQuery<Carton[]>({
    queryKey: ["cartons", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("cartons").select("*");
      if (error) throw error;
      return data || [];
    },
    enabled: isRealSupabase && !!user,
    staleTime: 1_000,
    retry: 1,
  });

  const { data: dbWipLogs = [], isLoading: isLoadingWipLogs } = useQuery<WIPLog[]>({
    queryKey: ["wip_logs", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("wip_logs").select("*");
      if (error) throw error;
      return data || [];
    },
    enabled: isRealSupabase && !!user,
    staleTime: 1_000,
    retry: 1,
  });

  const { data: dbWorkOrders = [], isLoading: isLoadingWorkOrders } = useQuery<WorkOrder[]>({
    queryKey: ["work_orders", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("work_orders").select("*");
      if (error) throw error;
      return data || [];
    },
    enabled: isRealSupabase && !!user,
    staleTime: 1_000,
    retry: 1,
  });

  // REQ-15: reuses useOutsourcing.ts's useAllOutsourceRecords() (same
  // queryKey, so this shares one cache entry with StageOutsourcingPanel /
  // OutsourceReturnQCPanel / the cutting-sewing-wash badges rather than
  // running a second, duplicate fetch of the same table).
  const { data: dbOutsourceRecords = [] } = useAllOutsourceRecords();

  const { data: dbCustomers = [], isLoading: isLoadingCustomers } = useQuery<Customer[]>({
    queryKey: ["customers", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("*");
      if (error) throw error;
      return data || [];
    },
    enabled: isRealSupabase && !!user,
    staleTime: 5_000,
    retry: 1,
  });

  const { data: dbSizeRatios = [], isLoading: isLoadingSizeRatios } = useQuery<SizeRatio[]>({
    queryKey: ["size_ratios", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("size_ratios").select("*").order("name");
      if (error) return [];
      return data || [];
    },
    enabled: isRealSupabase && !!user,
    staleTime: 5_000,
    retry: 1,
  });

  // Equipment — now backed by Supabase (qc_checkpoints table via bridge migration)
  const { data: dbEquipment = [] } = useQuery<Equipment[]>({
    queryKey: ["equipment"],
    queryFn: async () => {
      const { data, error } = await supabase.from("equipment").select("*").order("name");
      if (error) return [];
      return (data || []).map((e: any) => ({
        id: e.id,
        name: e.name,
        type: e.type,
        status: e.status || "Active",
      }));
    },
    enabled: isRealSupabase && !!user,
    staleTime: 30_000,
    retry: 1,
  });

  // QC Checkpoints — now backed by Supabase (qc_checkpoints table via bridge migration)
  const { data: dbCheckpoints = [] } = useQuery<Checkpoint[]>({
    queryKey: ["qc_checkpoints"],
    queryFn: async () => {
      const { data, error } = await supabase.from("qc_checkpoints").select("*").order("stage");
      if (error) return [];
      return (data || []).map((c: any) => ({
        id: c.id,
        name: c.name,
        stage: c.stage,
        aql_limit: c.aql_limit,
      }));
    },
    enabled: isRealSupabase && !!user,
    staleTime: 30_000,
    retry: 1,
  });

  const { data: dbNotifications = [], isLoading: isLoadingNotifications, refetch: refetchNotifications } = useQuery<Notification[]>({
    queryKey: ["notifications", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) {
        console.error("Notifications fetch error:", error);
        throw error;
      }
      return data || [];
    },
    enabled: isRealSupabase && !!user,
    staleTime: 5_000,
    refetchInterval: 15_000,
    retry: 1,
  });

  // notifications.order_id is the only scoping column the table has — no
  // company_id/customer_id column exists (checked live schema). Submission
  // lifecycle events (e.g. rejection) aren't tied to a real orders row, so
  // their notification's order_id is stored as the submission's own
  // apply_reference_code instead. For a customer session to actually see
  // those, scopedOrderIds (below) needs to also recognize this customer's
  // own reference codes as "theirs" — this lightweight query supplies that.
  const { data: dbCustomerSubmissionRefs = [] } = useQuery<{ apply_reference_code: string; company_name: string; brand_name: string | null; contact_email: string }[]>({
    queryKey: ["customer_submission_refs", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("apply_submissions")
        .select("apply_reference_code, company_name, brand_name, contact_email");
      if (error) throw error;
      return (data || []).filter((s: { apply_reference_code: string | null }) => s.apply_reference_code);
    },
    enabled: isRealSupabase && !!user && user.role === "customer",
    staleTime: 15_000,
  });

  // Same reasoning as dbCustomerSubmissionRefs above, but for sample requests
  // sourced from the sample_requests table — it has its own real
  // apply_reference_code column (added by the 20260830000000 migration) but
  // no company_name/contact_email columns to match against directly. Its
  // RLS SELECT policy already restricts rows to public.is_internal_staff()
  // OR company_id = get_auth_user_company_id(), so for a customer session
  // every row this query returns already belongs to them — no client-side
  // company/email matching needed, unlike the apply_submissions query above.
  const { data: dbCustomerSampleRefs = [] } = useQuery<{ apply_reference_code: string }[]>({
    queryKey: ["customer_sample_refs", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sample_requests")
        .select("apply_reference_code");
      if (error) throw error;
      return (data || []).filter((s: { apply_reference_code: string | null }) => s.apply_reference_code);
    },
    enabled: isRealSupabase && !!user && user.role === "customer",
    staleTime: 15_000,
  });

  // --- SUPABASE-FIRST DATA RESOLUTION ---
  // In live Supabase mode: ALWAYS use DB data, even if the table is empty.
  // Empty DB = real empty state, NOT a signal to show mock seed data.
  // Falling back to local seed when DB is empty was masking real data states
  // (e.g. new production db with no orders would show fake Levi/Diesel orders).
  // Only use local seed data in pure offline/mock mode (!isRealSupabase).
  const isAnyLoading = isLoadingOrders || isLoadingMaterials || isLoadingCutting || isLoadingCutTickets ||
    isLoadingSewing || isLoadingSewingTickets || isLoadingWash || isLoadingQc || isLoadingCartons ||
    isLoadingWipLogs || isLoadingCustomers || isLoadingSizeRatios;

  const orders = isRealSupabase ? dbOrders : localOrders;
  const materials = isRealSupabase ? dbMaterials : localMaterials;
  const cutting = isRealSupabase ? dbCutting : localCutting;
  const cutTickets = isRealSupabase ? dbCutTickets : [];
  const sewingTicketsData = isRealSupabase ? dbSewingTickets : [];
  const sewing = isRealSupabase ? dbSewing : localSewing;
  const wash = isRealSupabase ? dbWash : localWash;
  const qc = isRealSupabase ? dbQc : localQc;
  const cartons = isRealSupabase ? dbCartons : localCartons;
  const wipLogs = isRealSupabase ? dbWipLogs : localWipLogs;

  // Customers: merge DB + any locally-added ones (in case RLS blocked insert but app still needs it)
  const rawCustomers = isRealSupabase
    ? [...dbCustomers, ...localCustomers.filter(lc => !dbCustomers.some(dc => String(dc.name).toLowerCase() === String(lc.name).toLowerCase()))]
    : localCustomers;
  const customers = sanitizeCustomers(rawCustomers);

  // Size ratios: merge DB + local, fall back to seed ONLY in offline mode
  const sizeRatios = isRealSupabase
    ? (dbSizeRatios.length > 0
        ? [...dbSizeRatios, ...localSizeRatios.filter(lsr => !dbSizeRatios.some(dsr => String(dsr.name).toLowerCase() === String(lsr.name).toLowerCase()))]
        : SEED_SIZE_RATIOS) // seed ratios as config fallback only, not fake orders
    : (localSizeRatios.length > 0 ? localSizeRatios : SEED_SIZE_RATIOS);

  // Always use DB notifications in Supabase mode
  const notifications = isRealSupabase ? dbNotifications : localNotifications;

  // Strict Customer Scoping Security Logic
  const scopedOrders = useMemo(() => {
    let result = orders;
    if (user?.role === "customer") {
      const custName = user.customer_name?.trim().toLowerCase();
      const custId = (user as any).customer_id;
      const userEmail = user.email?.trim().toLowerCase();

      // Find all customer company names associated with this user
      const userCompanyNames = new Set<string>();
      if (custName) userCompanyNames.add(custName);

      if (userEmail && customers.length > 0) {
        customers.forEach((c) => {
          if (
            (c.contact && c.contact.trim().toLowerCase() === userEmail) ||
            (c.id && custId && c.id === custId)
          ) {
            userCompanyNames.add(c.name.trim().toLowerCase());
          }
        });
      }

      // If user has no explicit company name set on profile or customers list,
      // fallback to fuzzy matching user email prefix (e.g. "happyca" matches "HappyAI")
      if (userCompanyNames.size === 0 && userEmail) {
        const emailPrefix = userEmail.split("@")[0].toLowerCase();
        customers.forEach((c) => {
          const cNameLow = c.name.toLowerCase();
          if (cNameLow.includes(emailPrefix) || emailPrefix.includes(cNameLow.slice(0, 4))) {
            userCompanyNames.add(cNameLow);
          }
        });
      }

      // Match orders strictly for user's verified company or ID
      result = orders.filter((o) => {
        // 1. Direct customer_id match
        if (custId && o.customer_id && o.customer_id === custId) {
          return true;
        }
        // 2. Matching any associated company name
        const oNameLow = o.customer_name?.trim().toLowerCase();
        if (oNameLow && userCompanyNames.has(oNameLow)) {
          return true;
        }
        return false;
      });
    }

    return result;
  }, [user, orders, customers]);

  const scopedOrderIds = useMemo(() => {
    const ids = new Set(scopedOrders.map((o) => o.order_id));

    // Also recognize this customer's own apply_submissions reference codes
    // (e.g. "APP-2026-0028") — submission-lifecycle notifications (like a
    // rejection) use the reference code as their order_id since there's no
    // real orders row to point at yet.
    if (user?.role === "customer") {
      const custName = user.customer_name?.trim().toLowerCase();
      const userEmail = user.email?.trim().toLowerCase();
      dbCustomerSubmissionRefs.forEach((sub) => {
        const compLow = sub.company_name?.trim().toLowerCase();
        const brandLow = sub.brand_name?.trim().toLowerCase();
        const emailLow = sub.contact_email?.trim().toLowerCase();
        const matches =
          (custName && ((compLow && compLow.includes(custName)) || (brandLow && brandLow.includes(custName)))) ||
          (userEmail && emailLow === userEmail);
        if (matches && sub.apply_reference_code) {
          ids.add(sub.apply_reference_code);
        }
      });

      // sample_requests rows are already company-scoped server-side by RLS
      // (see dbCustomerSampleRefs) — every reference code returned for this
      // customer session genuinely belongs to them.
      dbCustomerSampleRefs.forEach((sub) => {
        if (sub.apply_reference_code) ids.add(sub.apply_reference_code);
      });
    }

    return ids;
  }, [scopedOrders, user, dbCustomerSubmissionRefs, dbCustomerSampleRefs]);

  const scopedMaterials = useMemo(() => {
    if (user?.role === "customer") {
      return materials.filter((m) => scopedOrderIds.has(m.order_id));
    }
    return materials;
  }, [user, materials, scopedOrderIds]);

  const scopedCutting = useMemo(() => {
    if (user?.role === "customer") {
      return cutting.filter((c) => scopedOrderIds.has(c.order_id));
    }
    return cutting;
  }, [user, cutting, scopedOrderIds]);

  const scopedCutTickets = useMemo(() => {
    if (user?.role === "customer") {
      return cutTickets.filter((c) => scopedOrderIds.has(c.work_order_id));
    }
    return cutTickets;
  }, [user, cutTickets, scopedOrderIds]);

  const scopedSewingTickets = useMemo(() => {
    if (user?.role === "customer") {
      return sewingTicketsData.filter((t) => scopedOrderIds.has(t.work_order_id));
    }
    return sewingTicketsData;
  }, [user, sewingTicketsData, scopedOrderIds]);

  const scopedSewing = useMemo(() => {
    if (user?.role === "customer") {
      return sewing.filter((s) => scopedOrderIds.has(s.order_id));
    }
    return sewing;
  }, [user, sewing, scopedOrderIds]);

  const scopedWash = useMemo(() => {
    if (user?.role === "customer") {
      return wash.filter((w) => scopedOrderIds.has(w.order_id));
    }
    return wash;
  }, [user, wash, scopedOrderIds]);

  const scopedQc = useMemo(() => {
    if (user?.role === "customer") {
      return qc.filter((q) => scopedOrderIds.has(q.order_id));
    }
    return qc;
  }, [user, qc, scopedOrderIds]);

  const scopedCartons = useMemo(() => {
    if (user?.role === "customer") {
      return cartons.filter((c) => scopedOrderIds.has(c.order_id));
    }
    return cartons;
  }, [user, cartons, scopedOrderIds]);

  const scopedWipLogs = useMemo(() => {
    if (user?.role === "customer") {
      return wipLogs.filter((w) => scopedOrderIds.has(w.order_id));
    }
    return wipLogs;
  }, [user, wipLogs, scopedOrderIds]);

  const scopedNotifications = useMemo(() => {
    if (user?.role === "customer") {
      return notifications.filter((n) => !n.order_id || scopedOrderIds.has(n.order_id));
    }
    return notifications;
  }, [user, notifications, scopedOrderIds]);

  // Equipment & Checkpoints: use DB data in Supabase mode, localStorage as fallback
  const equipment = isRealSupabase && dbEquipment.length > 0 ? dbEquipment : localEquipment;
  const checkpoints = isRealSupabase && dbCheckpoints.length > 0 ? dbCheckpoints : localCheckpoints;

  // React Query Mutations for live Supabase Tables
  const addOrderMutation = useMutation({
    mutationFn: async (order: Order) => {
      const dbOrder = {
        order_id: order.order_id,
        customer_name: order.customer_name,
        customer_id: order.customer_id,
        po_number: order.PO_number,
        tech_pack_ref: order.tech_pack_ref,
        size_breakdown: order.size_breakdown,
        status: order.status,
        created_date: order.created_date,
        current_stage: order.current_stage,
        qty: order.qty,
        notes: order.notes,
        style_no: order.style_no,
        style_description: order.style_description,
        color: order.color,
        planned_ship_date: order.planned_ship_date,
        material_status: order.material_status,
        delivered_qty: order.delivered_qty,
        open_balance: order.open_balance,
        delivery_status: order.delivery_status,
        // REQ-14: omit entirely when absent so the orders.selected_stages
        // DB default (all 13 stages) applies, rather than inserting an
        // explicit NULL that would defeat that default.
        ...(order.selected_stages && order.selected_stages.length > 0 ? { selected_stages: order.selected_stages } : {}),
        ...(order.priority ? { priority: order.priority } : {}),
        ...(order.rush_multiplier !== undefined ? { rush_multiplier: order.rush_multiplier } : {}),
        ...(order.is_sample !== undefined ? { is_sample: order.is_sample } : {}),
        // Requires the orders.apply_reference_code column from the
        // 2026-08-28 realtime/conversion-integrity migration — omitted
        // entirely when absent so this never breaks order writes before
        // that migration is applied.
        ...(order.apply_reference_code ? { apply_reference_code: order.apply_reference_code } : {}),
        // Requires the orders.wash_type column from the
        // 20260901000800_add_orders_wash_type migration — same
        // omit-when-absent guard.
        ...(order.wash_type ? { wash_type: order.wash_type } : {}),
      };
      const { error } = await supabase.from("orders").upsert(dbOrder, { onConflict: "order_id" });
      if (error) throw error;

      // Auto-generate and sync real-time SKU mapping for this order
      try {
        const custSku = order.style_no || `SKU-${(order.PO_number || '101').replace(/[^a-zA-Z0-9]/g, '').slice(-4)}`;
        const custPrefix = (order.customer_name || 'CST').replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 3);
        const styleTag = custSku.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6);
        const factoryCode = `FF-${custPrefix}-${styleTag}-${order.order_id ? order.order_id.replace(/[^0-9]/g, '').slice(-3) : Math.floor(100 + Math.random() * 900)}`;

        await supabase.from("sku_mappings").insert({
          customer_name: order.customer_name,
          brand_name: order.customer_name,
          po_number: order.PO_number || order.order_id,
          customer_sku: custSku,
          factory_code: factoryCode,
          style_name: order.style_description || order.style_no || "Custom Production Order",
          colorway: order.color || "Standard Rinse",
          notes: order.notes || `Auto-mapped upon PO ${order.PO_number || order.order_id} creation`
        });
      } catch (mappingErr) {
        console.warn("Auto sku mapping sync note:", mappingErr);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["sku_mappings"] });
      setToast({ message: "Order and SKU Mapping created successfully!", type: "success" });
    },
    onError: (error: any) => {
      setToast({ message: `Failed to add order: ${error.message}`, type: "error" });
    },
  });

  const createWorkOrderMutation = useMutation({
    mutationFn: async (wo: Partial<WorkOrder>) => {
      const { data, error } = await supabase.from("work_orders").insert(wo).select("*").single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["work_orders"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      setToast({ message: "Work Order batch created successfully!", type: "success" });
    },
    onError: (error: any) => {
      setToast({ message: `Failed to create work order: ${error.message}`, type: "error" });
    },
  });

  // "Split into Batch" on the Order Detail page creates a genuine CHILD ROW in
  // public.orders (linked via parent_order_id), not a public.work_orders row —
  // work_orders/blanket_pos is a separate, disconnected schema that no live
  // shop-floor page (cutting/sewing/qc/dispatch) reads. A child order flows
  // into the exact same pipeline every other stage page already understands.
  const createOrderBatchMutation = useMutation({
    mutationFn: async (batch: {
      parent_order_id: string;
      target_qty: number;
      size_breakdown: string;
      flavor_route: string;
      starting_stage_id: number;
      assigned_facility: string;
    }) => {
      const parent = orders.find((o) => o.order_id === batch.parent_order_id);
      if (!parent) throw new Error("Parent order not found.");

      const existingBatchCount = orders.filter((o) => (o as any).parent_order_id === batch.parent_order_id).length;
      const batchOrderId = `${parent.order_id}-B${existingBatchCount + 1}`;

      const dbBatchOrder = {
        order_id: batchOrderId,
        parent_order_id: batch.parent_order_id,
        customer_name: parent.customer_name,
        customer_id: parent.customer_id,
        po_number: parent.PO_number,
        tech_pack_ref: parent.tech_pack_ref,
        size_breakdown: batch.size_breakdown,
        status: "Open",
        created_date: new Date().toISOString().slice(0, 10),
        current_stage: batch.starting_stage_id,
        qty: batch.target_qty,
        style_no: parent.style_no,
        style_description: parent.style_description,
        color: parent.color,
        planned_ship_date: parent.planned_ship_date,
        flavor_route: batch.flavor_route,
        assigned_facility: batch.assigned_facility,
      };

      const { data, error } = await supabase.from("orders").insert(dbBatchOrder).select("*").single();
      if (error) throw error;
      return data as Order;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      setToast({ message: "Production batch created successfully!", type: "success" });
    },
    onError: (error: any) => {
      setToast({ message: `Failed to create batch: ${error.message}`, type: "error" });
    },
  });

  const updateOrderMutation = useMutation({
    mutationFn: async ({ id, fields }: { id: string; fields: Partial<Order> }) => {
      const dbFields: any = { ...fields };
      if (fields.PO_number !== undefined) {
        dbFields.po_number = fields.PO_number;
        delete dbFields.PO_number;
      }
      const { error } = await supabase.from("orders").update(dbFields).eq("order_id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      // Invalidate notifications so the DB trigger's new notification becomes visible immediately
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["notifications"] });
      }, 500);
      setToast({ message: "Order updated successfully!", type: "success" });
    },
    onError: (error: any) => {
      setToast({ message: `Failed to update order: ${error.message}`, type: "error" });
    },
  });

  const deleteOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const { error } = await supabase.from("orders").delete().eq("order_id", orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      setToast({ message: "Order deleted successfully!", type: "success" });
    },
    onError: (error: any) => {
      setToast({ message: `Failed to delete order: ${error.message}`, type: "error" });
    },
  });

  const addMaterialMutation = useMutation({
    mutationFn: async (material: Material) => {
      if (isRealSupabase && material.order_id) {
        try {
          const cleanPo = material.order_id.trim();
          const { data: ord } = await supabase
            .from("orders")
            .select("order_id")
            .or(`order_id.eq.${cleanPo},po_number.eq.${cleanPo}`)
            .maybeSingle();

          if (ord?.order_id) {
            material.order_id = ord.order_id;
          } else {
            await supabase.from("orders").upsert(
              {
                order_id: cleanPo,
                customer_name: "Brand Partner",
                po_number: cleanPo,
                tech_pack_ref: `TP-${cleanPo.replace(/[^a-zA-Z0-9]/g, "-").toUpperCase()}`,
                size_breakdown: "Standard Matrix",
                status: "Open",
                created_date: new Date().toISOString().slice(0, 10),
                current_stage: 3,
                qty: material.qty_received || 1000,
              },
              { onConflict: "order_id" }
            );
          }
        } catch (poErr) {
          console.warn("Material parent order check warning:", poErr);
        }
      }

      const { error } = await supabase.from("materials").insert(material);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["materials"] });
      setToast({ message: "Material registered successfully!", type: "success" });
    },
    onError: (error: any) => {
      setToast({ message: `Failed to add material: ${error.message}`, type: "error" });
    },
  });

  const updateMaterialInspectionMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Material["inspection_status"] }) => {
      const { error } = await supabase
        .from("materials")
        .update({ inspection_status: status })
        .eq("material_id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["materials"] });
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["notifications"] });
      }, 500);
      setToast({ message: "Material inspection updated successfully!", type: "success" });
    },
    onError: (error: any) => {
      setToast({ message: `Failed to update inspection: ${error.message}`, type: "error" });
    },
  });

  const addCuttingRecordMutation = useMutation({
    mutationFn: async (record: CuttingRecord) => {
      const { error } = await supabase.from("cutting_records").insert(record);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cutting_records"] });
      setToast({ message: "Cutting record created successfully!", type: "success" });
    },
    onError: (error: any) => {
      setToast({ message: `Failed to add cutting record: ${error.message}`, type: "error" });
    },
  });

  const updateCuttingRecordMutation = useMutation({
    mutationFn: async ({ id, fields }: { id: string; fields: Partial<CuttingRecord> }) => {
      const { error } = await supabase
        .from("cutting_records")
        .update(fields)
        .eq("cut_id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cutting_records"] });
      setToast({ message: "Cutting record updated successfully!", type: "success" });
    },
    onError: (error: any) => {
      setToast({ message: `Failed to update cutting record: ${error.message}`, type: "error" });
    },
  });

  const addSewingBundleMutation = useMutation({
    mutationFn: async (bundle: SewingBundle) => {
      const { error } = await supabase.from("sewing_bundles").insert(bundle);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sewing_bundles"] });
      setToast({ message: "Sewing bundle registered successfully!", type: "success" });
    },
    onError: (error: any) => {
      setToast({ message: `Failed to add sewing bundle: ${error.message}`, type: "error" });
    },
  });

  const updateSewingBundleMutation = useMutation({
    mutationFn: async ({ id, fields }: { id: string; fields: Partial<SewingBundle> }) => {
      const { error } = await supabase
        .from("sewing_bundles")
        .update(fields)
        .eq("bundle_id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sewing_bundles"] });
      setToast({ message: "Sewing bundle updated successfully!", type: "success" });
    },
    onError: (error: any) => {
      setToast({ message: `Failed to update sewing bundle: ${error.message}`, type: "error" });
    },
  });

  const addWashBatchMutation = useMutation({
    mutationFn: async (batch: WashBatch) => {
      const { error } = await supabase.from("wash_batches").insert(batch);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wash_batches"] });
      setToast({ message: "Wash batch registered successfully!", type: "success" });
    },
    onError: (error: any) => {
      setToast({ message: `Failed to register wash batch: ${error.message}`, type: "error" });
    },
  });

  const updateWashBatchMutation = useMutation({
    mutationFn: async ({ id, fields }: { id: string; fields: Partial<WashBatch> }) => {
      const { error } = await supabase
        .from("wash_batches")
        .update(fields)
        .eq("batch_id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wash_batches"] });
      setToast({ message: "Wash batch updated successfully!", type: "success" });
    },
    onError: (error: any) => {
      setToast({ message: `Failed to update wash batch: ${error.message}`, type: "error" });
    },
  });

  const addQCRecordMutation = useMutation({
    mutationFn: async (record: QCRecord) => {
      // Defensive order_id resolution: match by order_id, PO_number, or style_no
      let targetOrderId = record.order_id;
      const matched = (orders || []).find(
        (o) => o.order_id === record.order_id || o.PO_number === record.order_id || o.style_no === record.order_id
      );
      if (matched) {
        targetOrderId = matched.order_id;
      }

      const payload = {
        ...record,
        order_id: targetOrderId,
      };

      const { error } = await supabase.from("qc_records").insert(payload);
      if (error) {
        // If order_id does not exist in backend orders table (e.g. offline mock or transient data)
        if (error.code === "23503" || error.message?.toLowerCase().includes("foreign key")) {
          console.warn("qc_records foreign key fallback — synced locally:", error.message);
          return;
        }
        throw error;
      }
    },
    onSuccess: () => {
      // Invalidate all qc_records queries (including user-scoped variants)
      queryClient.invalidateQueries({ queryKey: ["qc_records"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      setToast({ message: "QC audit record saved successfully!", type: "success" });
    },
    onError: (error: any) => {
      setToast({ message: `Failed to submit QC record: ${error.message}`, type: "error" });
    },
  });

  const addCartonMutation = useMutation({
    mutationFn: async (carton: Carton) => {
      const { error } = await supabase.from("cartons").insert(carton);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cartons"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      setToast({ message: "Carton record created successfully!", type: "success" });
    },
    onError: (error: any) => {
      setToast({ message: `Failed to add carton: ${error.message}`, type: "error" });
    },
  });

  const updateCartonDispatchMutation = useMutation({
    mutationFn: async ({ id, fields }: { id: string; fields: Partial<Carton> }) => {
      const { error } = await supabase
        .from("cartons")
        .update(fields)
        .eq("carton_id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cartons"] });
      setToast({ message: "Carton dispatch status updated!", type: "success" });
    },
    onError: (error: any) => {
      setToast({ message: `Failed to dispatch carton: ${error.message}`, type: "error" });
    },
  });

  const addCustomerMutation = useMutation({
    mutationFn: async (customer: Customer) => {
      const dbCustomer = {
        name: customer.name,
        contact: customer.contact,
      };
      const { error } = await supabase.from("customers").insert(dbCustomer);
      if (error && (error.message.includes("duplicate") || error.code === "23505")) {
        return; // Customer company already exists in DB
      }
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      setToast({ message: "Customer profile registered!", type: "success" });
    },
    onError: (error: any) => {
      setToast({ message: `Failed to add customer: ${error.message}`, type: "error" });
    },
  });

  const updateCustomerMutation = useMutation({
    mutationFn: async ({ id, fields }: { id: string; fields: Partial<Customer> }) => {
      const { error } = await supabase.from("customers").update(fields).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      setToast({ message: "Customer profile updated successfully!", type: "success" });
    },
    onError: (error: any) => {
      setToast({ message: `Failed to update customer: ${error.message}`, type: "error" });
    },
  });

  const updateProfileSettingsMutation = useMutation({
    mutationFn: async (fields: Partial<Profile>) => {
      if (!user) throw new Error("Not authenticated");
      if (isRealSupabase) {
        const { error } = await supabase.from("profiles").update(fields).eq("id", user.id);
        if (error) throw error;
      } else {
        // mock logic
        const profs = getMockProfiles();
        const idx = profs.findIndex((p: Profile) => p.id === user.id);
        if (idx !== -1) {
          profs[idx] = { ...profs[idx], ...fields };
          saveMockProfiles(profs);
        }
      }
    },
    onSuccess: async () => {
      await refreshUser();
      setToast({ message: "Profile settings saved successfully!", type: "success" });
    },
    onError: (error: any) => {
      setToast({ message: `Failed to save settings: ${error.message}`, type: "error" });
    },
  });

  const addNotificationMutation = useMutation({
    mutationFn: async (notif: Notification) => {
      const dbNotif: any = { ...notif };
      delete dbNotif.id; // Let Postgres generate the UUID
      const { error } = await supabase.from("notifications").insert(dbNotif);
      if (error && (error.message.includes("duplicate") || error.code === "23505")) {
        return; // Notification already exists
      }
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
    onError: (error: any) => {
      console.error("Failed to insert notification:", error);
    },
  });

  const markNotificationReadMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notifications").update({ read: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
    onError: (error: any) => {
      setToast({ message: `Failed to read notification: ${error.message}`, type: "error" });
    },
  });

  const createRealtimeNotification = (message: string, orderId: string, type: Notification["type"], stageId: number) => {
    const notif: Notification = {
      id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      message,
      order_id: orderId,
      type,
      read: false,
      stage_id: stageId,
      created_at: new Date().toISOString(),
    };
    if (isRealSupabase) {
      addNotificationMutation.mutate(notif);
    } else {
      setLocalNotifications((prev) => {
        const merged = [notif, ...prev];
        saveToStorage(LOCAL_STORAGE_KEYS.notifications, merged);
        return merged;
      });
    }
  };

  // Manual, staff-triggered version of createRealtimeNotification for
  // material shortages — looks up the order's own current_stage so the
  // caller (Shop Floor WIP) doesn't need to plumb it through, and always
  // tags the notification "material_shortage" so it renders as an urgent
  // alert in the customer's own bell (see AppShell.tsx's red-dot condition).
  const notifyMaterialShortage = (orderId: string, message: string) => {
    const order = orders.find((o) => o.order_id === orderId);
    createRealtimeNotification(message, orderId, "material_shortage", order?.current_stage || 0);
  };

  /**
   * Notification Audit Engine
   *
   * PROBLEM FIXED: The old version depended on `notifications` in its dep array.
   * Every time it created a new notification → state update → re-render → effect
   * ran again → more notifications → infinite loop causing complete UI freeze for
   * admin (42 orders × 5 rules = 210 notifications created per cycle).
   *
   * FIX: Run the audit once when source data first loads (auditRan ref), and then
   * only re-run when orders/materials/qc/cartons change — NEVER depend on
   * `notifications` or `localNotifications` inside the effect. Deduplication is
   * done against a stable Set built from the initial loaded list, not live state.
   */
  const auditRan = useRef(false); // kept for future manual re-audit trigger

  useEffect(() => {
    // In live Supabase mode, the audit runs server-side via triggers.
    if (isRealSupabase) return;

    // Don't run until source data is available
    if (orders.length === 0) return;

    // Build a Set of "type:orderId" keys already in persistent storage so we
    // never write a duplicate, even across HMR reloads.
    const existingKeys = new Set(
      localNotifications.map((n) => `${n.type}:${n.order_id}`)
    );

    const auditList: Notification[] = [];

    const hasAlert = (type: string, orderId: string) =>
      existingKeys.has(`${type}:${orderId}`) ||
      auditList.some((n) => n.type === type && n.order_id === orderId);

    const makeId = () =>
      `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    // 1. Material Hold
    materials.forEach((m) => {
      if (m.inspection_status === "Hold" && !hasAlert("hold", m.order_id)) {
        auditList.push({
          id: makeId(),
          message: `[HOLD] Material ${m.material_id} for Order ${m.order_id} is on inspection HOLD.`,
          order_id: m.order_id,
          type: "hold",
          read: false,
          stage_id: 2,
          created_at: new Date().toISOString(),
        });
      }
    });

    // 1b. Order Hold
    orders.forEach((o) => {
      if (o.status === "On Hold" && !hasAlert("hold", o.order_id)) {
        auditList.push({
          id: makeId(),
          message: `[HOLD] Order ${o.order_id} has been put on hold.`,
          order_id: o.order_id,
          type: "hold",
          read: false,
          stage_id: o.current_stage,
          created_at: new Date().toISOString(),
        });
      }
    });

    // 2. QC Reject
    qc.forEach((q) => {
      if (q.result === "Reject" && !hasAlert("reject", q.order_id)) {
        auditList.push({
          id: makeId(),
          message: `[REJECT] QC checkpoint "${q.stage_checkpoint}" failed for Order ${q.order_id}.`,
          order_id: q.order_id,
          type: "reject",
          read: false,
          stage_id: 11,
          created_at: new Date().toISOString(),
        });
      }
    });

    // 3. Slow Stage (>5 days in production without reaching stage 13)
    orders.forEach((o) => {
      const ageDays = Math.round(
        (Date.now() - new Date(o.created_date).getTime()) / 86_400_000
      );
      if (
        o.status === "In Production" &&
        o.current_stage < 13 &&
        ageDays > 5 &&
        !hasAlert("slow_stage", o.order_id)
      ) {
        auditList.push({
          id: makeId(),
          message: `[DELAY] Order ${o.order_id} has been at Stage ${o.current_stage} for over 5 days.`,
          order_id: o.order_id,
          type: "slow_stage",
          read: false,
          stage_id: o.current_stage,
          created_at: new Date().toISOString(),
        });
      }
    });

    // 4. Overdue dispatch (carton ready >10 days after order creation)
    cartons.forEach((c) => {
      if (c.dispatch_status !== "Ready") return;
      const order = orders.find((o) => o.order_id === c.order_id);
      if (!order) return;
      const ageDays = Math.round(
        (Date.now() - new Date(order.created_date).getTime()) / 86_400_000
      );
      if (ageDays > 10 && !hasAlert("overdue", c.order_id)) {
        auditList.push({
          id: makeId(),
          message: `[OVERDUE] Carton ${c.carton_id} for Order ${c.order_id} is overdue for dispatch.`,
          order_id: c.order_id,
          type: "overdue",
          read: false,
          stage_id: 13,
          created_at: new Date().toISOString(),
        });
      }
    });

    // 5. QC Checkpoint Pending (order at gate stage >2 days, no QC record)
    const QC_GATES: Record<number, string> = {
      5: "First Cut Approval",
      8: "Inline Sewing QC",
      11: "Wash-Finish Approval",
      12: "Final AQL-Packing Audit",
    };
    orders.forEach((o) => {
      const ageDays = Math.round(
        (Date.now() - new Date(o.created_date).getTime()) / 86_400_000
      );
      if (ageDays <= 2 || o.status !== "In Production") return;
      const checkpointName = QC_GATES[o.current_stage];
      if (!checkpointName) return;
      const hasQcRecord = qc.some(
        (q) => q.order_id === o.order_id && q.stage_checkpoint === checkpointName
      );
      if (!hasQcRecord && !hasAlert("qc_checkpoint_pending", o.order_id)) {
        auditList.push({
          id: makeId(),
          message: `[QC PENDING] Order ${o.order_id} at Stage ${o.current_stage} for >2 days — "${checkpointName}" audit not completed.`,
          order_id: o.order_id,
          type: "qc_checkpoint_pending",
          read: false,
          stage_id: o.current_stage,
          created_at: new Date().toISOString(),
        });
      }
    });

    if (auditList.length === 0) return;

    if (isRealSupabase) {
      auditList.forEach((notif) => addNotificationMutation.mutate(notif));
    } else {
      // Merge with existing and persist — single write, no re-render loop
      setLocalNotifications((prev) => {
        const merged = [...prev, ...auditList];
        saveToStorage(LOCAL_STORAGE_KEYS.notifications, merged);
        return merged;
      });
    }
  // Intentionally omit localNotifications and notifications from deps.
  // Including them causes an infinite loop: new notif → state change → effect → new notif.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, materials, qc, cartons]);

  // Realtime subscription for notifications and database updates from Supabase
  useEffect(() => {
    if (!isRealSupabase || !user) return;

    const channel = supabase
      .channel("db-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["notifications", user.id] });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["orders", user.id] });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "qc_records",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["qc_records", user.id] });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "cartons",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["cartons", user.id] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "work_orders" },
        () => queryClient.invalidateQueries({ queryKey: ["work_orders"] })
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "stage_outsourcing_records" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["outsource_records_all"] });
          queryClient.invalidateQueries({ queryKey: ["outsource_records"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "outsource_return_qc" },
        () => queryClient.invalidateQueries({ queryKey: ["outsource_return_qc_pending"] })
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "blanket_pos" },
        () => queryClient.invalidateQueries({ queryKey: ["blanket_pos"] })
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "invoicing_records" },
        () => queryClient.invalidateQueries({ queryKey: ["invoicing_records"] })
      )
      // Cross-module production pipeline sync: a new/updated GRN, cut
      // ticket, or sewing ticket must be visible to every dependent role
      // (QC, Admin, Dispatch) within seconds — these all read through this
      // central hook (see qc.tsx's cutTickets/sewingTickets/materials
      // destructure), so this is the one place that fixes visibility for
      // all of them at once rather than patching each screen separately.
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "materials" },
        () => queryClient.invalidateQueries({ queryKey: ["materials", user.id] })
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cutting_records" },
        () => queryClient.invalidateQueries({ queryKey: ["cutting_records", user.id] })
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cut_tickets" },
        () => queryClient.invalidateQueries({ queryKey: ["cut_tickets", user.id] })
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sewing_tickets" },
        () => queryClient.invalidateQueries({ queryKey: ["sewing_tickets", user.id] })
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sewing_bundles" },
        () => queryClient.invalidateQueries({ queryKey: ["sewing_bundles", user.id] })
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "customers",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["customers", user.id] });
          queryClient.invalidateQueries({ queryKey: ["customers"] });
        }
      )
      // Pricing & Rates engine (Phase F): any open quote-building session or
      // admin pricing view reflects a rate/rule change live, on this same
      // shared channel — same postgres_changes pattern as every table above,
      // not a separate realtime mechanism. Query keys match the ones each
      // pricing hook file (useRateCards.ts/useRushPricing.ts/
      // useCustomerPricingRules.ts/useSamplePricingRules.ts) actually uses.
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rate_cards" },
        () => queryClient.invalidateQueries({ queryKey: ["rate_cards"] })
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "article_cycle_profiles" },
        () => queryClient.invalidateQueries({ queryKey: ["article_cycle_profiles"] })
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rush_multiplier_tiers" },
        () => queryClient.invalidateQueries({ queryKey: ["rush_multiplier_tiers"] })
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "customer_pricing_rules" },
        () => queryClient.invalidateQueries({ queryKey: ["customer_pricing_rules"] })
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sample_pricing_rules" },
        () => queryClient.invalidateQueries({ queryKey: ["sample_pricing_rules"] })
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);



  // Order Mutations
  const addOrder = (order: Omit<Order, "created_date">) => {
    appCache.invalidateTag("orders");
    const newOrder: Order = {
      ...order,
      created_date: new Date().toISOString().slice(0, 10),
    };
    if (isRealSupabase) {
      addOrderMutation.mutate(newOrder);
    } else {
      const updated = [newOrder, ...localOrders];
      setLocalOrders(updated);
      saveToStorage(LOCAL_STORAGE_KEYS.orders, updated);
    }
  };

  const updateOrder = (orderId: string, fields: Partial<Order>) => {
    const order = orders.find(o => o.order_id === orderId);
    const resultingStage = fields.current_stage ?? order?.current_stage ?? 1;
    const finalStageId = STAGES[STAGES.length - 1].id;

    // Defense in depth: "Shipped" is only ever legitimate at the real final
    // stage, reached through the /dispatch POD-confirmation flow (which
    // always sets status and current_stage together). Any other caller
    // trying to set status: "Shipped" without the order genuinely being at
    // the final stage is rejected here, not just hidden in the UI — this
    // guard holds even if a future UI change reintroduces a free-form
    // status dropdown.
    if (fields.status === "Shipped" && resultingStage !== finalStageId) {
      console.warn(
        `Blocked: cannot set order ${orderId} to Shipped — current_stage is ${resultingStage}, not ${finalStageId}. ` +
        `Shipped is only reachable through the real dispatch flow.`
      );
      setToast({
        message: `Cannot mark ${orderId} as Shipped — it hasn't completed the real dispatch flow (currently Stage ${resultingStage}/${finalStageId}).`,
        type: "error",
      });
      return;
    }

    appCache.invalidateTag("orders");
    if (isRealSupabase) {
      updateOrderMutation.mutate({ id: orderId, fields });
    } else {
      const updated = localOrders.map((o) => (o.order_id === orderId ? { ...o, ...fields } : o));
      setLocalOrders(updated);
      saveToStorage(LOCAL_STORAGE_KEYS.orders, updated);
    }

    if (fields.status) {
      const stage = resultingStage;

      if (fields.status === "On Hold") {
        createRealtimeNotification(`[HOLD] Order ${orderId} has been put on hold.`, orderId, "hold", stage);
      } else if (fields.status === "In Production") {
        createRealtimeNotification(`[UPDATE] Order ${orderId} is now In Production.`, orderId, "status_update", stage);
      } else if (fields.status === "Shipped") {
        createRealtimeNotification(`[SHIPPED] Order ${orderId} has been Shipped!`, orderId, "status_update", stage);
      } else if (fields.status === "Open") {
        createRealtimeNotification(`[UPDATE] Order ${orderId} status changed to Open.`, orderId, "status_update", stage);
      }
    }
  };

  // Material Mutations
  const addMaterial = (material: Material) => {
    if (isRealSupabase) {
      addMaterialMutation.mutate(material);
    } else {
      const updated = [material, ...localMaterials];
      setLocalMaterials(updated);
      saveToStorage(LOCAL_STORAGE_KEYS.materials, updated);
    }
  };

  const updateMaterialInspection = (materialId: string, status: Material["inspection_status"]) => {
    if (isRealSupabase) {
      updateMaterialInspectionMutation.mutate({ id: materialId, status });
    } else {
      const updated = localMaterials.map((m) =>
        m.material_id === materialId ? { ...m, inspection_status: status } : m
      );
      setLocalMaterials(updated);
      saveToStorage(LOCAL_STORAGE_KEYS.materials, updated);
    }
  };

  // Cutting Mutations
  const addCuttingRecord = (record: CuttingRecord) => {
    if (isRealSupabase) {
      addCuttingRecordMutation.mutate(record);
    } else {
      const updated = [record, ...localCutting];
      setLocalCutting(updated);
      saveToStorage(LOCAL_STORAGE_KEYS.cutting, updated);
    }
  };

  const updateCuttingRecord = (cutId: string, fields: Partial<CuttingRecord>) => {
    if (isRealSupabase) {
      updateCuttingRecordMutation.mutate({ id: cutId, fields });
    } else {
      const updated = localCutting.map((c) => (c.cut_id === cutId ? { ...c, ...fields } : c));
      setLocalCutting(updated);
      saveToStorage(LOCAL_STORAGE_KEYS.cutting, updated);
    }
  };

  // Sewing Mutations
  const addSewingBundle = (bundle: SewingBundle) => {
    if (isRealSupabase) {
      addSewingBundleMutation.mutate(bundle);
    } else {
      const updated = [bundle, ...localSewing];
      setLocalSewing(updated);
      saveToStorage(LOCAL_STORAGE_KEYS.sewing, updated);
    }
  };

  const updateSewingBundle = (bundleId: string, fields: Partial<SewingBundle>) => {
    if (isRealSupabase) {
      updateSewingBundleMutation.mutate({ id: bundleId, fields });
    } else {
      const updated = localSewing.map((s) => (s.bundle_id === bundleId ? { ...s, ...fields } : s));
      setLocalSewing(updated);
      saveToStorage(LOCAL_STORAGE_KEYS.sewing, updated);
    }
  };

  // Wash Mutations
  const addWashBatch = (batch: WashBatch) => {
    if (isRealSupabase) {
      addWashBatchMutation.mutate(batch);
    } else {
      const updated = [batch, ...localWash];
      setLocalWash(updated);
      saveToStorage(LOCAL_STORAGE_KEYS.wash, updated);
    }
  };

  const updateWashBatch = (batchId: string, fields: Partial<WashBatch>) => {
    if (isRealSupabase) {
      updateWashBatchMutation.mutate({ id: batchId, fields });
    } else {
      const updated = localWash.map((w) => (w.batch_id === batchId ? { ...w, ...fields } : w));
      setLocalWash(updated);
      saveToStorage(LOCAL_STORAGE_KEYS.wash, updated);
    }
  };

  // QC Mutations
  const addQCRecord = (record: QCRecord) => {
    if (isRealSupabase) {
      addQCRecordMutation.mutate(record);
    } else {
      const updated = [record, ...localQc];
      setLocalQc(updated);
      saveToStorage(LOCAL_STORAGE_KEYS.qc, updated);
    }
    
    if (record.result === "Reject") {
      createRealtimeNotification(`[REJECT] QC checkpoint "${record.stage_checkpoint}" failed for Order ${record.order_id}.`, record.order_id, "reject", 11);
    } else if (record.result === "Rework") {
      createRealtimeNotification(`[REWORK] Order ${record.order_id} requires rework at "${record.stage_checkpoint}".`, record.order_id, "rework", 11);
    }
  };

  // Carton Mutations
  const addCarton = (carton: Carton) => {
    if (isRealSupabase) {
      addCartonMutation.mutate(carton);
    } else {
      const updated = [carton, ...localCartons];
      setLocalCartons(updated);
      saveToStorage(LOCAL_STORAGE_KEYS.cartons, updated);
    }
  };

  const updateCartonDispatch = (cartonId: string, fields: Partial<Carton>) => {
    const carton = cartons.find(c => c.carton_id === cartonId);
    if (carton) {
      const orderId = carton.order_id;
      if (isRealSupabase) {
        updateCartonDispatchMutation.mutate({ id: cartonId, fields });
        const oCartons = cartons.map(c => c.carton_id === cartonId ? { ...c, ...fields } : c).filter(c => c.order_id === orderId);
        if (oCartons.length > 0 && oCartons.every(c => c.dispatch_status === "Shipped")) {
          updateOrder(orderId, { status: "Shipped", current_stage: 13 });
        }
      } else {
        const updated = localCartons.map((c) => (c.carton_id === cartonId ? { ...c, ...fields } : c));
        setLocalCartons(updated);
        saveToStorage(LOCAL_STORAGE_KEYS.cartons, updated);
        const oCartons = updated.filter(c => c.order_id === orderId);
        if (oCartons.length > 0 && oCartons.every(c => c.dispatch_status === "Shipped")) {
          const updatedOrders = localOrders.map(o => o.order_id === orderId ? { ...o, status: "Shipped" as const, current_stage: 13 } : o);
          setLocalOrders(updatedOrders);
          saveToStorage(LOCAL_STORAGE_KEYS.orders, updatedOrders);
        }
      }
    }
  };

  // WIP Logs Mutations
  const addWIPLogMutation = useMutation({
    mutationFn: async (log: Omit<WIPLog, "log_id" | "log_date">) => {
      const newLog: WIPLog = {
        ...log,
        log_id: `LOG-${Date.now().toString().slice(-6)}`,
        log_date: new Date().toISOString().slice(0, 10),
      };
      if (isRealSupabase) {
        const { error } = await supabase.from("wip_logs").insert(newLog);
        if (error) throw error;
      }
      return newLog;
    },
    onSuccess: (newLog) => {
      if (isRealSupabase) {
        queryClient.invalidateQueries({ queryKey: ["wip_logs"] });
      } else {
        const updated = [newLog, ...localWipLogs];
        setLocalWipLogs(updated);
        saveToStorage(LOCAL_STORAGE_KEYS.wipLogs, updated);
      }
      setToast({ message: `WIP Movement ${newLog.movement_type} recorded successfully!`, type: "success" });
    },
    onError: (err: any) => {
      setToast({ message: `Failed to record WIP movement: ${err.message || "Unknown error"}`, type: "error" });
    },
  });

  const addWIPLog = (log: Omit<WIPLog, "log_id" | "log_date">) => {
    addWIPLogMutation.mutate(log);
  };

  // Excel / CSV Importer Matching Forge_Fabric_WIP_Production_Tracker.xlsx
  const importExcelTrackerPackage = async (fileText: string) => {
    let ordersCount = 0;
    let wipLogsCount = 0;
    let cartonsCount = 0;

    const lines = fileText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) return { ordersCount, wipLogsCount, cartonsCount };

    const parseCSVLine = (line: string): string[] => {
      const result: string[] = [];
      let current = "";
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if ((char === ',' || char === '\t') && !inQuotes) {
          result.push(current.trim());
          current = "";
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };

    const header = parseCSVLine(lines[0]);
    const isOrdersSheet = header.some(h => h.toLowerCase().includes("order id") || h.toLowerCase().includes("po number"));
    const isWIPSheet = header.some(h => h.toLowerCase().includes("wip") || h.toLowerCase().includes("movement type"));
    const isDeliverySheet = header.some(h => h.toLowerCase().includes("delivery date") || h.toLowerCase().includes("carrier"));

    for (let i = 1; i < lines.length; i++) {
      const row = parseCSVLine(lines[i]);
      if (row.length === 0 || !row[0]) continue;

      if (isOrdersSheet) {
        const order_id = row[0] || `FF-${Date.now().toString().slice(-4)}`;
        const customer_name = row[1] || "Demo Brand";
        const PO_number = row[2] || `PO-${Math.floor(10000 + Math.random() * 90000)}`;
        const style_no = row[3] || "STL-101";
        const style_description = row[4] || "Denim Garment";
        const color = row[5] || "Indigo";
        const qty = parseInt(row[6], 10) || 1000;
        const planned_ship_date = row[8] || new Date().toISOString().slice(0, 10);
        const notes = row[17] || "Imported from Excel WIP Tracker";

        addOrder({
          order_id,
          customer_name,
          PO_number,
          tech_pack_ref: `TP-${Math.floor(1000 + Math.random() * 9000)}`,
          size_breakdown: "28-38",
          status: "In Production",
          current_stage: 1,
          qty,
          style_no,
          style_description,
          color,
          planned_ship_date,
          material_status: "Pending",
          delivered_qty: 0,
          open_balance: qty,
          delivery_status: "Open",
          notes,
        });
        ordersCount++;
      } else if (isWIPSheet) {
        const order_id = row[2] || row[0];
        const stage_name = row[5] || "Sewing Production";
        const stage_id = STAGES.find(s => s.name.toLowerCase() === stage_name.toLowerCase())?.id || 7;
        const movement_type = (["IN", "OUT", "REWORK", "REJECT", "HOLD", "ADJUSTMENT"].includes(row[6]) ? row[6] : "IN") as WIPMovementType;
        const qty_in = parseInt(row[7], 10) || 0;
        const qty_out = parseInt(row[8], 10) || 0;
        const rework_qty = parseInt(row[9], 10) || 0;
        const reject_qty = parseInt(row[10], 10) || 0;
        const qc_status = (["Not Checked", "Pass", "Rework", "Reject", "Hold", "Customer Review"].includes(row[12]) ? row[12] : "Pass") as WIPQCStatus;
        const operator = row[13] || "Operator 1";
        const batch_lot = row[14] || "LOT-01";
        const remarks = row[15] || "Imported WIP log";

        addWIPLog({
          order_id,
          stage_id,
          movement_type,
          qty_in,
          qty_out,
          rework_qty,
          reject_qty,
          net_wip_impact: qty_in - qty_out,
          qc_status,
          operator,
          batch_lot,
          remarks,
          updated_by: user?.email || "system",
        });
        wipLogsCount++;
      } else if (isDeliverySheet) {
        const order_id = row[1] || row[0];
        const packed_qty = parseInt(row[4], 10) || 100;
        const carrier = row[6] || "DHL Express";
        const pod_reference = row[7] || `POD-${Math.floor(10000 + Math.random() * 90000)}`;
        const customer_acceptance = (["Pending", "Accepted", "Rejected", "Claims / Review"].includes(row[8]) ? row[8] : "Pending") as any;
        const invoice_ref = row[9] || `INV-${Math.floor(1000 + Math.random() * 9000)}`;

        addCarton({
          carton_id: `CTN-${Date.now().toString().slice(-5)}`,
          order_id,
          packed_qty,
          dispatch_status: "Shipped",
          pod_reference,
          ship_date: row[0] || new Date().toISOString().slice(0, 10),
          carrier,
          customer_acceptance,
          invoice_ref,
          remarks: row[10] || "Imported delivery log",
        });
        cartonsCount++;
      }
    }

    return { ordersCount, wipLogsCount, cartonsCount };
  };

  const exportExcelTrackerPackage = () => {
    const downloadCSV = (filename: string, text: string) => {
      const blob = new Blob([text], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    };

    // 1. Orders Sheet
    const ordersHeaders = ["Order ID", "Customer", "PO Number", "Style No", "Style Description", "Color", "Order Qty", "Order Date", "Planned Ship Date", "Material Status", "Current Stage", "Delivered Qty", "Open Balance", "Delivery Status", "Notes"];
    const ordersRows = orders.map((o) => {
      // Dynamic Material Status from materials state
      const oMaterials = materials.filter((m) => m.order_id === o.order_id);
      let calcMaterialStatus = "Approved";
      if (oMaterials.length === 0) {
        calcMaterialStatus = o.current_stage >= 4 ? "Approved" : "Pending";
      } else if (oMaterials.some((m) => m.inspection_status === "Hold")) {
        calcMaterialStatus = "Hold";
      } else if (oMaterials.some((m) => m.inspection_status === "Pending")) {
        calcMaterialStatus = "Pending";
      }

      // Dynamic Delivered Qty from shipped cartons
      const shippedCartons = cartons.filter((c) => c.order_id === o.order_id && c.dispatch_status === "Shipped");
      let calcDeliveredQty = shippedCartons.reduce((sum, c) => sum + (c.packed_qty || 0), 0);
      if (calcDeliveredQty === 0 && (o.current_stage === 13 || o.status === "Shipped")) {
        calcDeliveredQty = o.qty;
      }

      // Dynamic Open Balance
      const calcOpenBalance = Math.max(0, o.qty - calcDeliveredQty);

      // Dynamic Delivery Status
      let calcDeliveryStatus = "Pending";
      if (calcDeliveredQty >= o.qty || o.current_stage === 13 || o.status === "Shipped") {
        calcDeliveryStatus = "Dispatched";
      } else if (calcDeliveredQty > 0) {
        calcDeliveryStatus = "Partial";
      } else if (o.status === "On Hold") {
        calcDeliveryStatus = "On Hold";
      } else if (o.current_stage >= 6) {
        calcDeliveryStatus = "In Production";
      }

      // Clean YYYY-MM-DD dates to prevent Excel '########' date overflow
      const cleanOrderDate = (o.created_date || "").slice(0, 10) || new Date().toISOString().slice(0, 10);
      let cleanPlannedShipDate = (o.planned_ship_date || "").slice(0, 10);
      if (!cleanPlannedShipDate) {
        const d = new Date(cleanOrderDate);
        d.setDate(d.getDate() + 14);
        cleanPlannedShipDate = d.toISOString().slice(0, 10);
      }

      const styleNo = o.style_no || `ST-${o.order_id.replace(/\D/g, "") || "101"}`;
      const styleDesc = o.style_description || "Denim Garment";
      const color = o.color || "Indigo";

      return [
        o.order_id,
        `"${o.customer_name || ""}"`,
        o.PO_number || "PO-N/A",
        styleNo,
        `"${styleDesc}"`,
        color,
        o.qty,
        cleanOrderDate,
        cleanPlannedShipDate,
        calcMaterialStatus,
        o.current_stage,
        calcDeliveredQty,
        calcOpenBalance,
        calcDeliveryStatus,
        `"${o.notes || ""}"`
      ].join(",");
    });
    downloadCSV("Forge_Fabric_Orders.csv", [ordersHeaders.join(","), ...ordersRows].join("\n"));

    // 2. WIPLog Sheet
    const wipHeaders = ["Log Date", "Log ID", "Order ID", "Customer", "Style No", "Stage", "Movement Type", "Qty IN", "Qty OUT", "Rework Qty", "Reject Qty", "Net WIP Impact", "QC Status", "Operator", "Batch / Lot", "Remarks", "Updated By"];
    const wipRows = wipLogs.map(w => {
      const o = orders.find(ord => ord.order_id === w.order_id);
      const stageName = STAGES.find(s => s.id === w.stage_id)?.name || `Stage ${w.stage_id}`;
      return [
        w.log_date,
        w.log_id,
        w.order_id,
        `"${o?.customer_name || ""}"`,
        o?.style_no || "N/A",
        `"${stageName}"`,
        w.movement_type,
        w.qty_in,
        w.qty_out,
        w.rework_qty,
        w.reject_qty,
        w.net_wip_impact,
        w.qc_status,
        `"${w.operator || ""}"`,
        `"${w.batch_lot || ""}"`,
        `"${w.remarks || ""}"`,
        w.updated_by || "system"
      ].join(",");
    });
    downloadCSV("Forge_Fabric_WIPLog.csv", [wipHeaders.join(","), ...wipRows].join("\n"));

    // 3. Stage Summary Sheet
    const stageSummaryHeaders = ["Stage ID", "Stage Name", "Total Orders", "Total IN Qty", "Total OUT Qty", "Total Rework Qty", "Total Reject Qty", "Net WIP Balance"];
    const stageSummaryRows = STAGES.map(s => {
      const stageOrders = orders.filter(o => o.current_stage === s.id);
      const stageLogs = wipLogs.filter(w => w.stage_id === s.id);
      const totalIn = stageLogs.reduce((acc, l) => acc + l.qty_in, 0);
      const totalOut = stageLogs.reduce((acc, l) => acc + l.qty_out, 0);
      const rework = stageLogs.reduce((acc, l) => acc + l.rework_qty, 0);
      const reject = stageLogs.reduce((acc, l) => acc + l.reject_qty, 0);
      return [
        s.id,
        `"${s.name}"`,
        stageOrders.length,
        totalIn,
        totalOut,
        rework,
        reject,
        totalIn - totalOut
      ].join(",");
    });
    downloadCSV("Forge_Fabric_Stage_Summary.csv", [stageSummaryHeaders.join(","), ...stageSummaryRows].join("\n"));

    // 4. Delivery Log Sheet
    const deliveryHeaders = ["Delivery Date", "Order ID", "Customer", "Style No", "Delivered Qty", "Cartons Count", "Carrier / Truck", "POD / Tracking", "Customer Acceptance", "Invoice / Ref", "Remarks"];
    const deliveryRows = cartons.filter(c => c.dispatch_status === "Shipped").map(c => {
      const o = orders.find(ord => ord.order_id === c.order_id);
      return [
        c.ship_date || new Date().toISOString().slice(0, 10),
        c.order_id,
        `"${o?.customer_name || ""}"`,
        o?.style_no || "N/A",
        c.packed_qty,
        1,
        `"${c.carrier || "Standard Carrier"}"`,
        c.pod_reference || "N/A",
        c.customer_acceptance || "Accepted",
        c.invoice_ref || "N/A",
        `"${c.remarks || ""}"`
      ].join(",");
    });
    downloadCSV("Forge_Fabric_Delivery_Log.csv", [deliveryHeaders.join(","), ...deliveryRows].join("\n"));

    setToast({ message: "Exported full 4-sheet WIP Excel package successfully!", type: "success" });
  };

  // Customer Config Mutations
  const addCustomer = (name: string, contact: string) => {
    const newCustomer: Customer = {
      id: `cust-${Date.now()}`,
      name,
      contact,
    };
    
    // Always update local storage as a fallback, especially useful if Supabase RLS blocks inserts
    const updated = [...localCustomers, newCustomer];
    setLocalCustomers(updated);
    saveToStorage(LOCAL_STORAGE_KEYS.customers, updated);

    if (isRealSupabase) {
      addCustomerMutation.mutate(newCustomer);
    }
  };

  const updateCustomer = (customerId: string, fields: Partial<Customer>) => {
    if (isRealSupabase) {
      updateCustomerMutation.mutate({ id: customerId, fields });
    } else {
      const updated = localCustomers.map((c) =>
        c.id === customerId ? { ...c, ...fields } : c
      );
      setLocalCustomers(updated);
      saveToStorage(LOCAL_STORAGE_KEYS.customers, updated);
    }
  };

  // Equipment Config Mutations
  const addEquipmentMutation = useMutation({
    mutationFn: async (eq: Equipment) => {
      const { error } = await supabase.from("equipment").insert({
        name: eq.name,
        type: eq.type,
        status: eq.status,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["equipment"] });
      setToast({ message: "Equipment registered successfully!", type: "success" });
    },
    onError: (error: any) => {
      setToast({ message: `Failed to add equipment: ${error.message}`, type: "error" });
    },
  });

  const toggleEquipmentStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      // The equipment table uses a UUID PK. The local id may be text ("eq-1").
      // Try UUID first, fall back to name-based lookup if the id doesn't look like UUID.
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      if (isUUID) {
        const { error } = await supabase.from("equipment").update({ status }).eq("id", id);
        if (error) throw error;
      } else {
        // Seeded data uses text IDs — find by name match via local state
        const eq = localEquipment.find((e) => e.id === id);
        if (eq) {
          const { error } = await supabase.from("equipment").update({ status }).eq("name", eq.name);
          if (error) throw error;
        }
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["equipment"] }),
    onError: (error: any) => {
      console.warn("Equipment status toggle warning:", error.message);
    },
  });

  const addEquipment = (name: string, type: string) => {
    const newEq: Equipment = {
      id: `eq-${Date.now()}`,
      name,
      type,
      status: "Active",
    };
    // Always update local state immediately for responsive UI
    const updated = [...localEquipment, newEq];
    setLocalEquipment(updated);
    saveToStorage(LOCAL_STORAGE_KEYS.equipment, updated);
    // Persist to Supabase
    if (isRealSupabase) {
      addEquipmentMutation.mutate(newEq);
    }
  };

  const toggleEquipmentStatus = (equipmentId: string) => {
    const newStatus = localEquipment.find((e) => e.id === equipmentId)?.status === "Active"
      ? "Inactive"
      : "Active";
    const updated = localEquipment.map((eq) =>
      eq.id === equipmentId ? { ...eq, status: newStatus as "Active" | "Inactive" } : eq
    );
    setLocalEquipment(updated);
    saveToStorage(LOCAL_STORAGE_KEYS.equipment, updated);
    // Persist to Supabase
    if (isRealSupabase) {
      toggleEquipmentStatusMutation.mutate({ id: equipmentId, status: newStatus });
    }
  };

  // Size Ratio Config Mutations
  const addSizeRatioMutation = useMutation({
    mutationFn: async (ratio: { name: string; description?: string }) => {
      const { data, error } = await supabase.from("size_ratios").insert({
        name: ratio.name,
        description: ratio.description || null,
      }).select();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["size_ratios"] });
      setToast({ message: "Size ratio added successfully!", type: "success" });
    },
    onError: (error: any) => {
      setToast({ message: `Failed to save size ratio: ${error.message}`, type: "error" });
    },
  });

  const deleteSizeRatioMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("size_ratios").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["size_ratios"] });
      setToast({ message: "Size ratio deleted successfully!", type: "success" });
    },
    onError: (error: any) => {
      setToast({ message: `Failed to delete size ratio: ${error.message}`, type: "error" });
    },
  });

  const addSizeRatio = useCallback((name: string, description?: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const newRatio: SizeRatio = {
      id: `sr-${Date.now()}`,
      name: trimmed,
      description: description || undefined,
    };
    setLocalSizeRatios((prev) => {
      if (prev.some((r) => r.name.toLowerCase() === trimmed.toLowerCase())) return prev;
      const updated = [...prev, newRatio];
      saveToStorage(LOCAL_STORAGE_KEYS.sizeRatios, updated);
      return updated;
    });
    if (isRealSupabase) {
      addSizeRatioMutation.mutate({ name: trimmed, description });
    }
  }, [isRealSupabase, addSizeRatioMutation]);

  const deleteSizeRatio = useCallback((id: string) => {
    setLocalSizeRatios((prev) => {
      const updated = prev.filter((r) => r.id !== id);
      saveToStorage(LOCAL_STORAGE_KEYS.sizeRatios, updated);
      return updated;
    });
    if (isRealSupabase) {
      deleteSizeRatioMutation.mutate(id);
    }
  }, [isRealSupabase, deleteSizeRatioMutation]);

  // Checkpoints Config Mutations
  const updateCheckpointMutation = useMutation({
    mutationFn: async ({ id, fields }: { id: string; fields: Partial<Checkpoint> }) => {
      // The qc_checkpoints table uses UUID PKs. Local seed IDs are "cp-1" etc.
      // Try UUID match first, fall back to name-based match.
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      if (isUUID) {
        const { error } = await supabase.from("qc_checkpoints").update(fields).eq("id", id);
        if (error) throw error;
      } else {
        const cp = localCheckpoints.find((c) => c.id === id);
        if (cp) {
          const { error } = await supabase.from("qc_checkpoints").update(fields).eq("name", cp.name);
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["qc_checkpoints"] });
      setToast({ message: "QC checkpoint AQL limit updated successfully!", type: "success" });
    },
    onError: (error: any) => {
      console.warn("Checkpoint update warning:", error.message);
    },
  });

  const updateCheckpoint = (checkpointId: string, fields: Partial<Checkpoint>) => {
    const updated = localCheckpoints.map((cp) =>
      cp.id === checkpointId ? { ...cp, ...fields } : cp
    );
    setLocalCheckpoints(updated);
    saveToStorage(LOCAL_STORAGE_KEYS.checkpoints, updated);
    if (isRealSupabase) {
      updateCheckpointMutation.mutate({ id: checkpointId, fields });
    }
  };

  // Mark notification read
  const markNotificationAsRead = (notificationId: string) => {
    if (isRealSupabase) {
      markNotificationReadMutation.mutate(notificationId);
    } else {
      const updated = localNotifications.map((n) =>
        n.id === notificationId ? { ...n, read: true } : n
      );
      setLocalNotifications(updated);
      saveToStorage(LOCAL_STORAGE_KEYS.notifications, updated);
    }
  };

  const deleteOrder = (orderId: string) => {
    if (isRealSupabase) {
      deleteOrderMutation.mutate(orderId);
    } else {
      const filterByOrderId = (items: any[]) => items.filter((item: any) => item.order_id !== orderId);

      const newOrders = localOrders.filter(o => o.order_id !== orderId);
      setLocalOrders(newOrders);
      saveToStorage(LOCAL_STORAGE_KEYS.orders, newOrders);

      const newMaterials = filterByOrderId(localMaterials);
      setLocalMaterials(newMaterials);
      saveToStorage(LOCAL_STORAGE_KEYS.materials, newMaterials);

      const newCutting = filterByOrderId(localCutting);
      setLocalCutting(newCutting);
      saveToStorage(LOCAL_STORAGE_KEYS.cutting, newCutting);

      const newSewing = filterByOrderId(localSewing);
      setLocalSewing(newSewing);
      saveToStorage(LOCAL_STORAGE_KEYS.sewing, newSewing);

      const newWash = filterByOrderId(localWash);
      setLocalWash(newWash);
      saveToStorage(LOCAL_STORAGE_KEYS.wash, newWash);

      const newQc = filterByOrderId(localQc);
      setLocalQc(newQc);
      saveToStorage(LOCAL_STORAGE_KEYS.qc, newQc);

      const newCartons = filterByOrderId(localCartons);
      setLocalCartons(newCartons);
      saveToStorage(LOCAL_STORAGE_KEYS.cartons, newCartons);

      const newWipLogs = filterByOrderId(localWipLogs);
      setLocalWipLogs(newWipLogs);
      saveToStorage(LOCAL_STORAGE_KEYS.wipLogs, newWipLogs);

      const newNotifications = filterByOrderId(localNotifications);
      setLocalNotifications(newNotifications);
      saveToStorage(LOCAL_STORAGE_KEYS.notifications, newNotifications);

      setToast({ message: "Order and all related records deleted successfully!", type: "success" });
    }
  };

  const deleteCustomerCascade = async (customerName: string) => {
    if (isRealSupabase) {
      const o = orders.filter(o => o.customer_name === customerName);
      for (const order of o) {
        await supabase.from("orders").delete().eq("order_id", order.order_id);
      }
      await supabase.from("customers").delete().eq("name", customerName);
      await supabase.from("profiles").delete().eq("customer_name", customerName);
      queryClient.invalidateQueries();
    } else {
      const o = localOrders.filter(o => o.customer_name === customerName);
      const filterByCustomer = (items: any[]) => items.filter((item: any) => !o.some(ord => ord.order_id === item.order_id));
      
      const newOrders = localOrders.filter(o => o.customer_name !== customerName);
      setLocalOrders(newOrders);
      saveToStorage(LOCAL_STORAGE_KEYS.orders, newOrders);

      const newMaterials = filterByCustomer(localMaterials);
      setLocalMaterials(newMaterials);
      saveToStorage(LOCAL_STORAGE_KEYS.materials, newMaterials);

      const newCutting = filterByCustomer(localCutting);
      setLocalCutting(newCutting);
      saveToStorage(LOCAL_STORAGE_KEYS.cutting, newCutting);

      const newSewing = filterByCustomer(localSewing);
      setLocalSewing(newSewing);
      saveToStorage(LOCAL_STORAGE_KEYS.sewing, newSewing);

      const newWash = filterByCustomer(localWash);
      setLocalWash(newWash);
      saveToStorage(LOCAL_STORAGE_KEYS.wash, newWash);

      const newQc = filterByCustomer(localQc);
      setLocalQc(newQc);
      saveToStorage(LOCAL_STORAGE_KEYS.qc, newQc);

      const newCartons = filterByCustomer(localCartons);
      setLocalCartons(newCartons);
      saveToStorage(LOCAL_STORAGE_KEYS.cartons, newCartons);

      const newWipLogs = filterByCustomer(localWipLogs);
      setLocalWipLogs(newWipLogs);
      saveToStorage(LOCAL_STORAGE_KEYS.wipLogs, newWipLogs);

      const newNotifications = filterByCustomer(localNotifications);
      setLocalNotifications(newNotifications);
      saveToStorage(LOCAL_STORAGE_KEYS.notifications, newNotifications);

      const newCustomers = localCustomers.filter(c => c.name !== customerName);
      setLocalCustomers(newCustomers);
      saveToStorage(LOCAL_STORAGE_KEYS.customers, newCustomers);

      try {
        const raw = localStorage.getItem("forge_flow_mock_profiles");
        if (raw) {
          const profiles = JSON.parse(raw);
          const newProfiles = profiles.filter((p: any) => p.customer_name !== customerName);
          localStorage.setItem("forge_flow_mock_profiles", JSON.stringify(newProfiles));
        }
      } catch(e) {}
    }
    setToast({ message: `Brand "${customerName}" and all associated data deleted successfully!`, type: "success" });
  };

  const advanceOrderStage = (orderId: string, toStage: number) => {
    // Single source of truth: reaching Stage 13 (Dispatch & Delivery) must
    // mark the order Shipped in the same write, regardless of which UI path
    // got it there (Kanban drag, StageNavigator jump, or the packing-list
    // dispatch cascade) — otherwise current_stage and status can disagree,
    // and every view reading status (customer dashboard, KPIs) goes stale.
    updateOrder(orderId, { current_stage: toStage, ...(toStage >= 13 ? { status: "Shipped" as const } : {}) });
    const stageName = STAGES.find(s => s.id === toStage)?.name || `Stage ${toStage}`;
    createRealtimeNotification(
      `[STAGE ADVANCED] Order ${orderId} has advanced to Stage ${toStage}: ${stageName}.`,
      orderId,
      "stage_advance",
      toStage
    );
    setToast({
      message: `Order ${orderId} successfully advanced to Stage ${toStage}: ${stageName}!`,
      type: "success"
    });
  };

  const isOrderOnHold = (orderId: string): boolean => {
    const order = orders.find((o) => o.order_id === orderId);
    if (order?.status === "On Hold") return true;
    
    // Check if any material is "Hold"
    const oMaterials = materials.filter((m) => m.order_id === orderId);
    if (oMaterials.some((m) => m.inspection_status === "Hold")) return true;
    
    // Check if any QC checkpoint is "Reject"
    const oQc = qc.filter((q) => q.order_id === orderId);
    if (oQc.some((q) => q.result === "Reject")) return true;
    
    return false;
  };

  const isLoading = isRealSupabase && (
    isLoadingOrders ||
    isLoadingMaterials ||
    isLoadingCutting ||
    isLoadingCutTickets ||
    isLoadingSewing ||
    isLoadingWash ||
    isLoadingQc ||
    isLoadingCartons ||
    isLoadingCustomers ||
    isLoadingWorkOrders ||
    isLoadingNotifications
  );

  const contextValue = useMemo(() => ({
    orders: scopedOrders,
    materials: scopedMaterials,
    cutting: scopedCutting,
    cutTickets: scopedCutTickets,
    sewingTickets: scopedSewingTickets,
    sewing: scopedSewing,
    wash: scopedWash,
    qc: scopedQc,
    cartons: scopedCartons,
    wipLogs: scopedWipLogs,
    workOrders: dbWorkOrders,
    outsourceRecords: dbOutsourceRecords,
    customers,
    equipment,
    checkpoints,
    sizeRatios,
    notifications: scopedNotifications,
    createWorkOrder: async (wo: Partial<WorkOrder>) => createWorkOrderMutation.mutateAsync(wo),
    createOrderBatch: async (batch: {
      parent_order_id: string;
      target_qty: number;
      size_breakdown: string;
      flavor_route: string;
      starting_stage_id: number;
      assigned_facility: string;
    }) => createOrderBatchMutation.mutateAsync(batch),
    addOrder,
    // Exposed alongside the fire-and-forget `addOrder` helper so callers that
    // need to KNOW a real order write actually succeeded (e.g. submission
    // conversion) can await it and throw on failure, instead of reporting
    // success before the DB write is even confirmed.
    addOrderMutation,
    updateOrder,
    deleteOrder,
    deleteCustomerCascade,
    addMaterial,
    updateMaterialInspection,
    addCuttingRecord,
    updateCuttingRecord,
    addSewingBundle,
    updateSewingBundle,
    addWashBatch,
    updateWashBatch,
    addQCRecord,
    addCarton,
    updateCartonDispatch,
    addWIPLog,
    importExcelTrackerPackage,
    exportExcelTrackerPackage,
    addCustomer,
    updateCustomer,
    updateProfileSettings: async (f: any) => updateProfileSettingsMutation.mutateAsync(f),
    addEquipment,
    toggleEquipmentStatus,
    updateCheckpoint,
    addSizeRatio,
    deleteSizeRatio,
    markNotificationAsRead,
    advanceOrderStage,
    isOrderOnHold,
    notifyMaterialShortage,
    isLoading,
    toast,
    setToast,
    globalSearchQuery,
    setGlobalSearchQuery,
  }), [
    scopedOrders,
    scopedMaterials,
    scopedCutting,
    scopedCutTickets,
    scopedSewingTickets,
    scopedSewing,
    scopedWash,
    scopedQc,
    scopedCartons,
    scopedWipLogs,
    dbWorkOrders,
    dbOutsourceRecords,
    customers,
    equipment,
    checkpoints,
    sizeRatios,
    scopedNotifications,
    isLoading,
    toast,
    globalSearchQuery,
    addSizeRatio,
    deleteSizeRatio,
  ]);

  return (
    <AppDataContext.Provider value={contextValue}>
      {children}
    </AppDataContext.Provider>
  );
}

export function useAppData() {
  const context = useContext(AppDataContext);
  if (context === undefined) {
    throw new Error("useAppData must be used within an AppDataProvider");
  }
  return context;
}

export function checkStageAdvancement(
  toStage: number,
  orderId: string,
  data: {
    materials: Material[];
    cutting: CuttingRecord[];
    sewing: SewingBundle[];
    /** Real sewing_tickets rows — the authoritative source for the stage-7 sewing-completion gate below. Legacy `sewing` bundles are only consulted as a fallback for orders with no sewing_tickets rows at all. */
    sewingTickets?: SewingTicketRecordSummary[];
    qc: QCRecord[];
    wash: WashBatch[];
    cartons: Carton[];
    /** REQ-15: every stage_outsourcing_records row (useAppData's outsourceRecords) — powers the outsource QC gate below. */
    outsourceRecords?: OutsourceRecord[];
  },
  // REQ-14 Section 3G: "respect selected_stages" — an order's selective
  // pipeline can skip Washing (stage 9) entirely, e.g. the customer supplies
  // already-washed garments and only orders Finishing + Packing. When that's
  // the case, stages 10/11's wash-batch requirement (below) would otherwise
  // permanently block a perfectly valid order that will never have a wash
  // record. Undefined/omitted means the legacy full 13-stage pipeline, so
  // every gate below behaves exactly as it did before this parameter existed.
  selectedStages?: number[],
  // REQ-15 Section 4D: the stage the order is currently leaving (not
  // toStage, the one it's entering) — the outsource QC gate below is keyed
  // off this. Undefined skips the outsource check entirely (callers that
  // don't pass it get the exact old behavior).
  fromStage?: number
): { allowed: boolean; message?: string } {
  // REQ-15 Section 4D: mandatory QC return gate. An order cannot leave a
  // stage while outsourced work dispatched for that stage hasn't returned
  // and passed (or partially passed) QC — mirrors the DB trigger
  // enforce_order_stage_gates() added by 20260825000000_selective_pipeline_
  // and_enhanced_outsourcing.sql, so a blocked advance is caught here with
  // an immediate, specific message instead of surfacing as a raw DB error.
  //
  // Extended (20260901000300_outsource_shortage_resolution.sql): passing
  // return QC is a QUALITY signal about whatever pieces actually arrived —
  // it says nothing about whether the full dispatched quantity came back.
  // A live quantity_short > 0 must be separately resolved (a follow-up
  // return zeroing it, or an explicit "accepted as final" with a reason)
  // before the stage counts as clear, even when return_qc_status is
  // Passed/Partial_Pass.
  if (fromStage !== undefined && data.outsourceRecords && data.outsourceRecords.length > 0) {
    const relevantOutsource = data.outsourceRecords.filter((r) => r.order_id === orderId && r.stage_number === fromStage);
    const pendingOutsource = relevantOutsource.filter(
      (r) => r.return_qc_status !== "Passed" && r.return_qc_status !== "Partial_Pass"
    );
    const unresolvedShortage = relevantOutsource.filter(
      (r) => (r.return_qc_status === "Passed" || r.return_qc_status === "Partial_Pass") &&
        (r.quantity_short || 0) > 0 && !r.shortage_resolved
    );
    if (pendingOutsource.length > 0) {
      return {
        allowed: false,
        message: `Outsourced work for this stage has ${pendingOutsource.length} pending return QC inspection(s). Cannot advance until all return QC inspections pass.`,
      };
    }
    if (unresolvedShortage.length > 0) {
      const short = unresolvedShortage.reduce((sum, r) => sum + (r.quantity_short || 0), 0);
      return {
        allowed: false,
        message: `Outsourced work for this stage has a live, unresolved shortage of ${short} pcs. Log a follow-up return receiving the rest, or explicitly accept the shortage as final, before advancing.`,
      };
    }
  }

  // Confirmed live bug (order FF-2026-00005, Sewing-only pipeline): nothing
  // here ever verified the destination stage was actually a member of this
  // order's own selected pipeline before running the (universal, absolute-
  // stage-numbered) checks below. A stray "current_stage + 1" advance (the
  // StageNavigator Quick Advance button, fixed alongside this) pushed that
  // order to Stage 4 — Pre-Production Planning, which only belongs to a
  // Cutting-inclusive pipeline — and every check below happened to pass
  // (Material Check, the only thing gating stage 4, was genuinely done), so
  // it silently "succeeded" at a stage that shouldn't exist for that order.
  // Mirrors the same guard added to enforce_order_stage_gates() in
  // supabase/migrations/20260901001700_selective_pipeline_stage_gate_fix.sql
  // — this is the client-side copy of that authoritative DB-level check.
  if (selectedStages && selectedStages.length > 0 && !selectedStages.includes(toStage)) {
    return {
      allowed: false,
      message: `Stage ${toStage} is not part of this order's selected production pipeline. Pick a stage this order actually includes.`,
    };
  }

  const washIncluded = !selectedStages || selectedStages.includes(9);
  // Cutting & Bundling (stages 5-6) is a selectable service, never
  // auto-included — an order that never selected it (e.g. Sewing Assembly
  // only, customer supplies pre-cut panels) will never have a cutting
  // record or First Cut Approval QC to check for at the stage-7 boundary
  // below, and must not be permanently blocked waiting for one.
  const cuttingIncluded = !selectedStages || selectedStages.includes(5) || selectedStages.includes(6);
  if (toStage === 2) {
    return { allowed: true };
  }
  if (toStage === 3) {
    const oMaterials = data.materials.filter((m) => m.order_id === orderId);
    if (oMaterials.length === 0) {
      return { allowed: false, message: "No material sourcing record exists for this order. Please register fabric arrivals first." };
    }
    return { allowed: true };
  }
  if (toStage === 4) {
    // Material Check checkpoint boundary (after Fabric & Trim Inspection,
    // before Pre-Production Planning). Two independent conditions required:
    // (1) the real material/GRN records exist and are Approved — unchanged
    // from before — and (2) a genuine, separately-logged 'Material Check'
    // QC checkpoint with result 'Pass' exists. Previously only (1) was
    // checked, so logging a GRN and marking it Approved was — by itself —
    // sufficient to advance, with no independent QC sign-off required at
    // all. That was the root cause of the reported regression.
    const oMaterials = data.materials.filter((m) => m.order_id === orderId);
    if (oMaterials.length === 0) {
      return { allowed: false, message: "No material records exist for this order." };
    }
    const holds = oMaterials.filter((m) => m.inspection_status === "Hold");
    if (holds.length > 0) {
      return {
        allowed: false,
        message: `${holds.length} of ${oMaterials.length} materials are still On Hold (e.g. Fabric ID: ${holds[0].material_id}) — resolve inspection holds before advancing to Pre-Production Planning.`
      };
    }
    const unapproved = oMaterials.filter((m) => m.inspection_status !== "Approved");
    if (unapproved.length > 0) {
      return {
        allowed: false,
        message: `${unapproved.length} of ${oMaterials.length} materials are not Approved yet — resolve all inspections before advancing to Pre-Production Planning.`
      };
    }
    const materialCheckQc = data.qc.find((q) => q.order_id === orderId && q.stage_checkpoint === "Material Check" && q.result === "Pass");
    if (!materialCheckQc) {
      return { allowed: false, message: "Awaiting Material Check inspection — log a 'Material Check' QC checkpoint with result Pass in the QC module before advancing to Pre-Production Planning." };
    }
    return { allowed: true };
  }
  if (toStage === 5) {
    return { allowed: true }; // Planning sign-off
  }
  if (toStage === 6) {
    // No checkpoint sits at this boundary — Cutting and Bundling (stages
    // 5-6) are one continuous phase per the reference architecture. The
    // First Cut Approval checkpoint belongs at the 6->7 boundary (toStage
    // === 7 below), not here — it was previously misplaced at this earlier
    // transition, which both gated the wrong boundary and meant toStage 7
    // (the real Cutting/Bundling -> Sewing boundary) never checked cutting
    // completeness or approval at all.
    return { allowed: true };
  }
  if (toStage === 7) {
    // First Cut Approval checkpoint boundary (after Cutting & Bundling,
    // before Sewing). Confirmed live bug: this was unconditional, so a
    // Sewing-only order (Cutting never selected — customer supplies pre-cut
    // panels) could never satisfy it — there is no cutting record and never
    // will be one — permanently deadlocking Stage 6->7 for that order. Skip
    // entirely when Cutting & Bundling isn't part of this order's pipeline.
    if (!cuttingIncluded) return { allowed: true };
    // Three independent conditions: (1) a sewing bundle
    // exists — confirms cutting output was actually fed to the line,
    // unchanged from before; (2) the cutting record is Completed with
    // first_cut_approval_status Approved — moved here from the wrong
    // toStage===6 boundary above; (3) a genuine, separately-logged 'First
    // Cut Approval' QC checkpoint with result 'Pass' exists — previously
    // missing entirely, so a Completed+Approved cutting ticket was, by
    // itself, sufficient with no independent QC sign-off.
    const oBundles = data.sewing.filter((s) => s.order_id === orderId);
    if (oBundles.length === 0) {
      return { allowed: false, message: "No sewing bundle has been fed to the assembly line. Please register sewing bundles first." };
    }
    const oCuts = data.cutting.filter((c) => c.order_id === orderId);
    const approvedCut = oCuts.find((c) => c.status === "Completed" && c.first_cut_approval_status === "Approved");
    if (!approvedCut) {
      return { allowed: false, message: "Requires a Cutting record with status 'Completed' and First Cut Approval set to 'Approved' before panels can be fed to Sewing." };
    }
    const firstCutQc = data.qc.find((q) => q.order_id === orderId && q.stage_checkpoint === "First Cut Approval" && q.result === "Pass");
    if (!firstCutQc) {
      return { allowed: false, message: "Awaiting First Cut Approval inspection — log a 'First Cut Approval' QC checkpoint with result Pass in the QC module before advancing to Sewing." };
    }
    return { allowed: true };
  }
  if (toStage === 8) {
    // Gate mirrors the DB trigger exactly (enforce_order_stage_gates,
    // 20260901000400_prevent_duplicate_tickets_and_fix_sewing_gate.sql):
    // 1. Real completed sewing work exists — sewing_tickets when this order
    //    has ever used the ticket-based flow (checked first, since that's
    //    the authoritative table sewing.tsx actually writes to), falling
    //    back to legacy sewing_bundles only when no sewing_tickets rows
    //    exist for this order at all. Checking sewing_bundles unconditionally
    //    was the root cause of a real bug: cutting.tsx mirror-writes one
    //    "Active" sewing_bundles row per cut bundle that the ticket-based
    //    flow never completes, permanently blocking this gate even with a
    //    genuinely completed sewing ticket.
    // 2. An Inline Sewing QC record with result != 'Reject' must exist.
    const orderTickets = (data.sewingTickets || []).filter((t) => t.work_order_id === orderId);
    let sewingOk: boolean;
    let sewingMessage: string;
    if (orderTickets.length > 0) {
      const activeTickets = orderTickets.filter((t) => t.status !== "Completed");
      sewingOk = activeTickets.length === 0;
      sewingMessage = `${activeTickets.length} of ${orderTickets.length} sewing ticket(s) are still in progress — complete all sewing tickets before proceeding to Pre-Wash QC.`;
    } else {
      const oBundles = data.sewing.filter((s) => s.order_id === orderId);
      if (oBundles.length === 0) {
        return { allowed: false, message: "No sewing bundles exist for this order. Register sewing bundles first." };
      }
      const active = oBundles.filter((s) => s.status !== "Completed");
      sewingOk = active.length === 0;
      sewingMessage = `${active.length} of ${oBundles.length} sewing bundles are still active — complete all bundles before proceeding to Pre-Wash QC.`;
    }
    if (!sewingOk) {
      return { allowed: false, message: sewingMessage };
    }
    // QC gate (matches DB trigger enforce_order_stage_gates stage 7 check)
    const inlineQc = data.qc.filter((q) => q.order_id === orderId && q.stage_checkpoint === "Inline Sewing QC");
    const passedInlineQc = inlineQc.find((q) => q.result !== "Reject");
    if (!passedInlineQc) {
      return { allowed: false, message: "Requires an 'Inline Sewing QC' record with result Pass or Rework before advancing to Pre-Wash QC. Log the QC checkpoint in the QC module first." };
    }
    return { allowed: true };
  }
  if (toStage === 9) {
    // Stage 9 has no gate in the DB trigger — just needs to be past stage 8
    return { allowed: true };
  }
  if (toStage === 10) {
    if (!washIncluded) return { allowed: true }; // Washing not in this order's selected pipeline — nothing to gate
    const oWash = data.wash.filter((w) => w.order_id === orderId);
    const readyWash = oWash.find((w) => w.stage === "Finish" || w.stage === "Approved");
    if (!readyWash) {
      return { allowed: false, message: "Requires laundry wash batch to be completed to 'Finish' or 'Approved' stage." };
    }
    return { allowed: true };
  }
  if (toStage === 11) {
    // Wash/Finish Approval checkpoint boundary (after Washing & Finishing,
    // before Final Quality Inspection). Two independent conditions: (1) the
    // wash batch itself reached 'Approved' — unchanged from before — and
    // (2) a genuine, separately-logged 'Wash-Finish Approval' QC checkpoint
    // with result 'Pass' exists — previously missing at this boundary
    // entirely (it was checked one transition too late, at toStage===12).
    if (!washIncluded) return { allowed: true }; // Washing not in this order's selected pipeline — nothing to gate
    const oWash = data.wash.filter((w) => w.order_id === orderId);
    const approvedWash = oWash.find((w) => w.stage === "Approved");
    if (!approvedWash) {
      return { allowed: false, message: "Requires laundry wash batch status to be set to 'Approved'." };
    }
    const washFinishQc = data.qc.find((q) => q.order_id === orderId && q.stage_checkpoint === "Wash-Finish Approval" && q.result === "Pass");
    if (!washFinishQc) {
      return { allowed: false, message: "Awaiting Wash/Finish Approval inspection — log a 'Wash-Finish Approval' QC checkpoint with result Pass in the QC module before advancing to Final Quality Inspection." };
    }
    return { allowed: true };
  }
  if (toStage === 12) {
    // No checkpoint sits at this boundary (Final Quality Inspection ->
    // Pressing/Tagging/Packing) — the Wash-Finish Approval check that used
    // to live here belonged one transition earlier (toStage===11 above),
    // and Final AQL/Packing Audit belongs at toStage===13 (Dispatch), where
    // it's already correctly enforced below.
    return { allowed: true };
  }
  if (toStage === 13) {
    // Gate mirrors DB trigger exactly:
    // 1. At least one carton with dispatch_status = 'Ready'
    // 2. A 'Final AQL-Packing Audit' QC record with result = 'Pass'
    const oCartons = data.cartons.filter((c) => c.order_id === orderId);
    const readyCarton = oCartons.find((c) => c.dispatch_status === "Ready");
    if (!readyCarton) {
      return { allowed: false, message: "Requires at least one packing carton with status 'Ready' for dispatch. Create a carton in the Dispatch module first." };
    }
    const finalQc = data.qc.filter(
      (q) => q.order_id === orderId && q.stage_checkpoint === "Final AQL-Packing Audit" && q.result === "Pass"
    );
    if (finalQc.length === 0) {
      return { allowed: false, message: "Requires a 'Final AQL-Packing Audit' QC checkpoint record with result 'Pass' before dispatch. Log the final inspection in the QC module." };
    }
    return { allowed: true };
  }
  return { allowed: true };
}
