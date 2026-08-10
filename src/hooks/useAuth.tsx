import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { supabase, isRealSupabase, getMockProfiles, saveMockProfiles, type Profile } from "../lib/supabase";

interface AuthContextType {
  user: Profile | null;
  loading: boolean;
  authError: string | null;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (
    email: string,
    password: string,
    role: Profile["role"],
    customerName?: string,
    fullName?: string
  ) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  updateUserRole: (userId: string, role: Profile["role"]) => Promise<{ error: Error | null }>;
  updateUserProfile: (fields: Partial<Profile>) => Promise<{ error: Error | null }>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/** Wraps a promise with a hard timeout so auth init never stalls the UI. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Auth request timed out after ${ms}ms`)),
      ms
    );
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (err)   => { clearTimeout(timer); reject(err); }
    );
  });
}

/** Fetches the full profile row for a given user id. Returns null on any failure. */
async function fetchProfile(userId: string): Promise<Profile | null> {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("*, customers(name)")
      .eq("id", userId)
      .single();
    if (error || !data) return null;
    return {
      ...(data as any),
      customer_name: (data as any).customers?.name || (data as any).customer_name,
      full_name: (data as any).full_name,
    } as Profile;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  // Prevent the onAuthStateChange callback from overwriting a completed initAuth.
  const initDone = useRef(false);

  // Load session
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (isRealSupabase) {
      // Real Supabase Auth Flow
      const initAuth = async () => {
        // Hard safety net — never leave loading=true for more than 12s
        const safetyTimer = setTimeout(() => {
          if (!initDone.current) {
            console.warn("Auth init safety timeout fired — clearing loading state.");
            setAuthError("Connection to authentication service timed out. Check your network.");
            setLoading(false);
            initDone.current = true;
          }
        }, 12_000);

        try {
          const { data: sessionData } = await supabase.auth.getSession();
          const session = sessionData?.session ?? null;
          if (session?.user) {
            const profile = await fetchProfile(session.user.id);
            setUser(
              profile ?? {
                id: session.user.id,
                email: session.user.email || "",
                role: (session.user.user_metadata?.role as Profile["role"]) || "customer",
                customer_name: session.user.user_metadata?.customer_name,
                full_name: session.user.user_metadata?.full_name,
                created_at: session.user.created_at,
              }
            );
          }
        } catch (e: any) {
          console.error("Auth loading failed:", e?.message ?? e);
          setAuthError("Failed to connect to authentication service. Running in offline mode.");
        } finally {
          clearTimeout(safetyTimer);
          initDone.current = true;
          setLoading(false);
        }
      };

      initAuth();

      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (event: AuthChangeEvent, session: Session | null) => {
          // SIGNED_OUT should always update, but INITIAL_SESSION is handled by initAuth.
          if (event === "SIGNED_OUT") {
            setUser(null);
            setLoading(false);
            return;
          }
          // Skip if initAuth hasn't completed yet — it will set state itself.
          if (!initDone.current) return;

          if (session?.user) {
            const profile = await fetchProfile(session.user.id);
            if (profile) setUser(profile);
          } else {
            setUser(null);
          }
          setLoading(false);
        }
      );

      return () => {
        subscription.unsubscribe();
      };
    } else {
      // Local Mock Auth Flow — synchronous, never blocks
      try {
        const mockSession = localStorage.getItem("forge_flow_session");
        if (mockSession) {
          const parsed = JSON.parse(mockSession) as Profile;
          const profiles = getMockProfiles();
          const fresh = profiles.find((p) => p.id === parsed.id) || parsed;
          setUser(fresh);
        }
      } catch (e) {
        localStorage.removeItem("forge_flow_session");
      }
      setLoading(false);
    }
  }, []);

  // Sign In
  const signIn = async (email: string, password: string) => {
    if (!email || !password) {
      return { error: new Error("Please enter both email and password.") };
    }

    if (isRealSupabase) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          return { error: new Error("Invalid login credentials. Please check your email and password.") };
        }

        // Check deactivation state in Supabase profiles table
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", data.user?.id)
          .maybeSingle();

        if (profile?.deactivated) {
          await supabase.auth.signOut();
          return { error: new Error("This account has been deactivated by system administration.") };
        }

        if (profile) {
          setUser(profile as Profile);
        } else if (data.user) {
          // Auto-create missing profile row
          const newProf: Profile = {
            id: data.user.id,
            email: data.user.email || email,
            role: (data.user.user_metadata?.role as Profile["role"]) || "customer",
            customer_name: data.user.user_metadata?.customer_name,
            full_name: data.user.user_metadata?.full_name,
            created_at: data.user.created_at,
          };
          try {
            await supabase.from("profiles").upsert(newProf);
          } catch (upsertErr) {
            console.error("Auto profile creation warning:", upsertErr);
          }
          setUser(newProf);
        }
        return { error: null };
      } catch (e: any) {
        return { error: new Error(e?.message ?? "Failed to authenticate with Supabase.") };
      }
    } else {
      // Offline fallback mode — strictly verify email AND password match
      const profiles = getMockProfiles();
      const match = profiles.find((p) => p.email.toLowerCase() === email.toLowerCase());
      if (!match) {
        return { error: new Error("Invalid login credentials. User account not found.") };
      }
      if (match.deactivated) {
        return { error: new Error("This account has been deactivated.") };
      }

      // Check stored account password or default demo password
      const storedPassword = (match as any).password || "password123";
      if (password !== storedPassword) {
        return { error: new Error("Invalid password. Please enter the correct password for this account.") };
      }

      localStorage.setItem("forge_flow_session", JSON.stringify(match));
      setUser(match);
      return { error: null };
    }
  };

  // Sign Up
  const signUp = async (
    email: string,
    password: string,
    role: Profile["role"],
    customerName?: string,
    fullName?: string
  ) => {
    if (isRealSupabase) {
      try {
        let customerId: string | null = null;
        if (customerName) {
          const { data: customerData } = await supabase
            .from("customers")
            .select("id")
            .ilike("name", customerName.trim())
            .maybeSingle();
          if (customerData?.id) {
            customerId = customerData.id;
          }
        }

        const { data: authData, error: authErr } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: {
            data: {
              role: role || "customer",
              customer_name: customerName?.trim() || null,
              customer_id: customerId,
              full_name: fullName?.trim() || null,
              name: fullName?.trim() || null,
            },
          },
        });

        if (authErr) {
          const rawMsg = authErr.message;
          let cleanMsg = "Failed to create account. Please try again.";
          if (rawMsg && rawMsg !== "{}" && rawMsg !== "[object Object]") {
            cleanMsg = rawMsg;
          } else if ((authErr as any)?.status === 500) {
            cleanMsg = "Account registration failed due to database trigger. Please apply the latest database migration script in Supabase SQL Editor.";
          }
          return { error: new Error(cleanMsg) };
        }

        if (authData?.user) {
          // Try update first (if trigger created profile), fallback to upsert
          const { error: updateErr } = await supabase
            .from("profiles")
            .update({
              email,
              role,
              customer_name: customerName,
              customer_id: customerId,
              full_name: fullName,
            })
            .eq("id", authData.user.id);

          if (updateErr) {
            const { error: profErr } = await supabase.from("profiles").upsert({
              id: authData.user.id,
              email,
              role,
              customer_name: customerName,
              customer_id: customerId,
              full_name: fullName,
            });
            if (profErr) {
              console.warn("Profiles table upsert warning:", profErr.message);
            }
          }

          const createdProf: Profile = {
            id: authData.user.id,
            email,
            role,
            customer_name: customerName,
            full_name: fullName,
            created_at: new Date().toISOString(),
          };
          setUser(createdProf);
          return { error: null };
        }

        return { error: null };
      } catch (err: any) {
        return { error: new Error(err?.message || "Failed to create account in Supabase database.") };
      }
    } else {
      const profiles = getMockProfiles();
      if (profiles.some((p) => p.email.toLowerCase() === email.toLowerCase())) {
        return { error: new Error("This email is already registered.") };
      }

      const newProfile: Profile = {
        id: `mock-uid-${Math.random().toString(36).substring(2, 9)}`,
        email,
        role,
        customer_name: customerName,
        full_name: fullName,
        created_at: new Date().toISOString(),
        password, // Store password for strict offline verification
      } as any;

      profiles.push(newProfile);
      saveMockProfiles(profiles);

      localStorage.setItem("forge_flow_session", JSON.stringify(newProfile));
      setUser(newProfile);
      return { error: null };
    }
  };

  // Sign Out
  const signOut = async () => {
    if (isRealSupabase) {
      await supabase.auth.signOut();
    } else {
      localStorage.removeItem("forge_flow_session");
    }
    setUser(null);
    queryClient.clear();
  };

  // Update user role (Settings User Management Panel)
  const updateUserRole = async (userId: string, role: Profile["role"]) => {
    if (isRealSupabase) {
      const { error } = await supabase
        .from("profiles")
        .update({ role })
        .eq("id", userId);
      if (error) return { error };
      return { error: null };
    } else {
      const profiles = getMockProfiles();
      const idx = profiles.findIndex((p) => p.id === userId);
      if (idx !== -1) {
        profiles[idx].role = role;
        saveMockProfiles(profiles);
        // If current user, update session as well
        if (user && user.id === userId) {
          const updatedUser = { ...user, role };
          localStorage.setItem("forge_flow_session", JSON.stringify(updatedUser));
          setUser(updatedUser);
        }
        return { error: null };
      }
      return { error: new Error("User profile not found") };
    }
  };

  const updateUserProfile = async (fields: Partial<Profile>) => {
    if (!user) return { error: new Error("Not authenticated") };

    if (isRealSupabase) {
      try {
        // 1. Update public.profiles table with select() to verify row was actually updated
        const { data: updatedData, error: updateErr } = await supabase
          .from("profiles")
          .update(fields)
          .eq("id", user.id)
          .select();

        if (updateErr || !updatedData || updatedData.length === 0) {
          // If update didn't affect any row, perform upsert to insert the missing profile record
          const { data: upsertData, error: upsertErr } = await supabase
            .from("profiles")
            .upsert(
              {
                id: user.id,
                email: user.email,
                role: user.role,
                customer_name: user.customer_name,
                full_name: fields.full_name ?? user.full_name,
                contact_phone: fields.contact_phone ?? user.contact_phone,
                ...fields,
              },
              { onConflict: "id" }
            )
            .select();

          if (upsertErr) {
            throw new Error(`Supabase Database Error: ${upsertErr.message}`);
          }
          if (!upsertData || upsertData.length === 0) {
            throw new Error("Failed to write profile record to Supabase database. Please check table RLS policies.");
          }
        }

        // 2. Update Supabase Auth user_metadata so the Name shows in Supabase Auth dashboard
        const authMetaData: Record<string, any> = { ...fields };
        if (fields.full_name) {
          authMetaData.full_name = fields.full_name;
          authMetaData.name = fields.full_name;
        }
        const { error: authUpdateErr } = await supabase.auth.updateUser({
          data: authMetaData,
        });
        if (authUpdateErr) {
          console.warn("Supabase auth user_metadata update notice:", authUpdateErr.message);
        }

        // 3. If customer, update matching customer record in customers table
        if (user.customer_name && (fields.full_name || fields.contact_phone)) {
          const custUpdate: Record<string, any> = {};
          if (fields.full_name) custUpdate.contact_person = fields.full_name;
          if (fields.contact_phone) custUpdate.contact_phone = fields.contact_phone;

          try {
            await supabase
              .from("customers")
              .update(custUpdate)
              .eq("name", user.customer_name);
          } catch (custErr) {
            console.warn("Customer record sync warning:", custErr);
          }
        }

        const freshProfile = await fetchProfile(user.id);
        const updatedUser = freshProfile ?? { ...user, ...fields };
        setUser(updatedUser);
        return { error: null };
      } catch (e: any) {
        return { error: new Error(e?.message || "Failed to update profile") };
      }
    } else {
      const profiles = getMockProfiles();
      const idx = profiles.findIndex((p) => p.id === user.id);
      const updatedUser = { ...user, ...fields };
      if (idx !== -1) {
        profiles[idx] = { ...profiles[idx], ...fields };
      } else {
        profiles.push(updatedUser);
      }
      saveMockProfiles(profiles);
      localStorage.setItem("forge_flow_session", JSON.stringify(updatedUser));
      setUser(updatedUser);
      return { error: null };
    }
  };

  const refreshUser = async () => {
    if (isRealSupabase && user) {
      const profile = await fetchProfile(user.id);
      if (profile) setUser(profile);
    } else if (user) {
      const profiles = getMockProfiles();
      const fresh = profiles.find((p) => p.id === user.id) || user;
      setUser(fresh);
      localStorage.setItem("forge_flow_session", JSON.stringify(fresh));
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, authError, signIn, signUp, signOut, updateUserRole, updateUserProfile, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

const defaultAuthContext: AuthContextType = {
  user: null,
  loading: false,
  authError: null,
  signIn: async () => ({ error: new Error("Auth service initializing...") }),
  signUp: async () => ({ error: new Error("Auth service initializing...") }),
  signOut: async () => {},
  updateUserRole: async () => ({ error: new Error("Auth service initializing...") }),
  updateUserProfile: async () => ({ error: new Error("Auth service initializing...") }),
  refreshUser: async () => {},
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    return defaultAuthContext;
  }
  return context;
}
