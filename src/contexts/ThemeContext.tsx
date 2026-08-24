import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, isRealSupabase } from '../lib/supabase';

export interface TenantBranding {
  company_name: string;
  logo_url?: string;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  support_email: string;
  support_phone: string;
  // REQ-04 / REQ-09: operational limits, configurable here so Admin Settings
  // is the single place staff edit both branding and floor-governance rules.
  sample_min_turnaround_days: number;
  sample_max_quantity: number;
  daily_capacity_units: number;
  laundry_buffer_days: number;
  // Rush priority: the real rate multiplier and lead-time reduction, admin-
  // configurable here instead of hardcoded in ReviewSummary.tsx.
  rush_multiplier: number;
  rush_lead_time_reduction_days: number;
}

const DEFAULT_BRANDING: TenantBranding = {
  company_name: 'Forge & Fabric Industries, Inc.',
  logo_url: undefined,
  primary_color: '#1e3a8a', // Deep Blue
  secondary_color: '#0f172a', // Dark Slate
  accent_color: '#d97706', // Amber
  support_email: 'support@forgefabric.com',
  support_phone: '+1 (800) 555-DENIM',
  sample_min_turnaround_days: 3,
  sample_max_quantity: 100,
  daily_capacity_units: 144_000,
  laundry_buffer_days: 2,
  rush_multiplier: 2.0,
  rush_lead_time_reduction_days: 7,
};

interface ThemeContextType {
  branding: TenantBranding;
  updateBranding: (newBranding: Partial<TenantBranding>) => Promise<void>;
  isLoading: boolean;
}

const ThemeContext = createContext<ThemeContextType>({
  branding: DEFAULT_BRANDING,
  updateBranding: async () => {},
  isLoading: false,
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [branding, setBranding] = useState<TenantBranding>(DEFAULT_BRANDING);
  const [isLoading, setIsLoading] = useState(true);

  // Apply custom CSS variables to :root
  const applyThemeCssVars = (config: TenantBranding) => {
    const root = document.documentElement;
    root.style.setProperty('--color-primary', config.primary_color);
    root.style.setProperty('--color-secondary', config.secondary_color);
    root.style.setProperty('--color-accent', config.accent_color);
  };

  useEffect(() => {
    const fetchTenantConfig = async () => {
      setIsLoading(true);
      try {
        if (isRealSupabase) {
          const { data, error } = await supabase
            .from('tenant_config')
            .select('*')
            .limit(1)
            .maybeSingle();

          if (!error && data) {
            const config: TenantBranding = {
              company_name: data.company_name || DEFAULT_BRANDING.company_name,
              logo_url: data.logo_url || undefined,
              primary_color: data.primary_color || DEFAULT_BRANDING.primary_color,
              secondary_color: data.secondary_color || DEFAULT_BRANDING.secondary_color,
              accent_color: data.accent_color || DEFAULT_BRANDING.accent_color,
              support_email: data.support_email || DEFAULT_BRANDING.support_email,
              support_phone: data.support_phone || DEFAULT_BRANDING.support_phone,
              sample_min_turnaround_days: Number(data.sample_min_turnaround_days) || DEFAULT_BRANDING.sample_min_turnaround_days,
              sample_max_quantity: Number(data.sample_max_quantity) || DEFAULT_BRANDING.sample_max_quantity,
              daily_capacity_units: Number(data.daily_capacity_units) || DEFAULT_BRANDING.daily_capacity_units,
              laundry_buffer_days: data.laundry_buffer_days ?? DEFAULT_BRANDING.laundry_buffer_days,
              rush_multiplier: Number(data.rush_multiplier) || DEFAULT_BRANDING.rush_multiplier,
              rush_lead_time_reduction_days: data.rush_lead_time_reduction_days ?? DEFAULT_BRANDING.rush_lead_time_reduction_days,
            };
            setBranding(config);
            applyThemeCssVars(config);
          } else {
            applyThemeCssVars(DEFAULT_BRANDING);
          }
        } else {
          applyThemeCssVars(DEFAULT_BRANDING);
        }
      } catch (e) {
        console.error('Failed to load tenant branding:', e);
        applyThemeCssVars(DEFAULT_BRANDING);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTenantConfig();
  }, []);

  const updateBranding = async (newBranding: Partial<TenantBranding>) => {
    const updated = { ...branding, ...newBranding };
    setBranding(updated);
    applyThemeCssVars(updated);

    if (isRealSupabase) {
      const { data: existing } = await supabase.from('tenant_config').select('id').limit(1).maybeSingle();
      if (existing) {
        await supabase.from('tenant_config').update(newBranding).eq('id', existing.id);
      } else {
        await supabase.from('tenant_config').insert(newBranding);
      }
    }
  };

  return (
    <ThemeContext.Provider value={{ branding, updateBranding, isLoading }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
