import { createClient } from "@supabase/supabase-js";

const DEFAULT_SUPABASE_URL = "https://myednlgltvpszzcjfrta.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15ZWRubGdsdHZwc3p6Y2pmcnRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxMDE0MjYsImV4cCI6MjA5OTY3NzQyNn0.VyUyVjXQ1WQpbjISoUsSi2byfeojjXpb50bxWPFQpsk";

const supabaseUrl = (typeof import.meta !== "undefined" && import.meta?.env?.VITE_SUPABASE_URL) || process?.env?.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const supabaseAnonKey = (typeof import.meta !== "undefined" && import.meta?.env?.VITE_SUPABASE_ANON_KEY) || process?.env?.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

export const isRealSupabase = Boolean(supabaseUrl && supabaseAnonKey);
export const isSupabaseConfigured = (): boolean => isRealSupabase;

export interface Profile {
  id: string;
  email: string;
  role: "admin" | "merchandiser" | "production" | "qc" | "customer";
  customer_name?: string; // used for customer-scoped views
  full_name?: string;
  contact_phone?: string;
  notification_prefs?: Record<string, any>;
  display_theme?: "light" | "dark" | "system";
  dashboard_view?: "default" | "pipeline" | "kanban";
  created_at: string;
  deactivated?: boolean;
}

// In-Memory/Local Storage Mock State for when Supabase is not connected
const MOCK_PROFILES_KEY = "forge_flow_mock_profiles";

const initialMockProfiles: Profile[] = [
  {
    id: "admin-uid",
    email: "admin@forgefabric.com",
    role: "admin",
    created_at: new Date().toISOString(),
  },
  {
    id: "merch-uid",
    email: "merch@forgefabric.com",
    role: "merchandiser",
    created_at: new Date().toISOString(),
  },
  {
    id: "prod-uid",
    email: "prod@forgefabric.com",
    role: "production",
    created_at: new Date().toISOString(),
  },
  {
    id: "qc-uid",
    email: "qc@forgefabric.com",
    role: "qc",
    created_at: new Date().toISOString(),
  },
  {
    id: "customer-uid",
    email: "customer@forgefabric.com",
    role: "customer",
    customer_name: "Levi Strauss & Co.",
    created_at: new Date().toISOString(),
  },
];

// Initialize localStorage with initial profiles if not present
if (typeof window !== "undefined" && !localStorage.getItem(MOCK_PROFILES_KEY)) {
  localStorage.setItem(MOCK_PROFILES_KEY, JSON.stringify(initialMockProfiles));
}

// Helper to retrieve and save mock profiles
export const getMockProfiles = (): Profile[] => {
  if (typeof window === "undefined") return initialMockProfiles;
  try {
    const raw = localStorage.getItem(MOCK_PROFILES_KEY);
    return raw ? JSON.parse(raw) : initialMockProfiles;
  } catch (e) {
    return initialMockProfiles;
  }
};

export const saveMockProfiles = (profiles: Profile[]) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(MOCK_PROFILES_KEY, JSON.stringify(profiles));
};

// Main Export Client
export const supabase = isRealSupabase
  ? createClient(supabaseUrl, supabaseAnonKey)
  : (null as any); // Fallback is emulated inside the useAuth hook for complete control
