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
}

const DEFAULT_BRANDING: TenantBranding = {
  company_name: 'Forge & Fabric',
  logo_url: undefined,
  primary_color: '#1e3a8a', // Deep Blue
  secondary_color: '#0f172a', // Dark Slate
  accent_color: '#d97706', // Amber
  support_email: 'support@forgefabric.com',
  support_phone: '+1 (800) 555-DENIM',
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
