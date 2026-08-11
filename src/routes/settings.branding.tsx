import { createFileRoute } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { AppShell } from '../components/AppShell';
import { useTheme, type TenantBranding } from '../contexts/ThemeContext';
import { usePermission } from '../hooks/usePermission';
import { 
  Palette, Upload, Save, CheckCircle2, AlertCircle, RefreshCw, Building2, Mail, Phone, Eye, ShieldCheck 
} from 'lucide-react';

export const Route = createFileRoute('/settings/branding')({
  head: () => ({
    meta: [
      { title: 'Tenant Branding & Theme Settings · Forge & Fabric PLM' },
      { name: 'description', content: 'Configure tenant white-label branding, custom theme colors, logo, and client portal templates.' },
    ],
  }),
  component: TenantBrandingSettingsPage,
});

function TenantBrandingSettingsPage() {
  const canManage = usePermission("admin", "update");
  const { branding, updateBranding } = useTheme();

  const [companyName, setCompanyName] = useState(branding.company_name);
  const [logoUrl, setLogoUrl] = useState(branding.logo_url || '');
  const [primaryColor, setPrimaryColor] = useState(branding.primary_color);
  const [secondaryColor, setSecondaryColor] = useState(branding.secondary_color);
  const [accentColor, setAccentColor] = useState(branding.accent_color);
  const [supportEmail, setSupportEmail] = useState(branding.support_email);
  const [supportPhone, setSupportPhone] = useState(branding.support_phone);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    setCompanyName(branding.company_name);
    setLogoUrl(branding.logo_url || '');
    setPrimaryColor(branding.primary_color);
    setSecondaryColor(branding.secondary_color);
    setAccentColor(branding.accent_color);
    setSupportEmail(branding.support_email);
    setSupportPhone(branding.support_phone);
  }, [branding]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setStatusMsg(null);

    try {
      await updateBranding({
        company_name: companyName.trim(),
        logo_url: logoUrl.trim() || undefined,
        primary_color: primaryColor,
        secondary_color: secondaryColor,
        accent_color: accentColor,
        support_email: supportEmail.trim(),
        support_phone: supportPhone.trim(),
      });

      setStatusMsg({ type: 'success', text: 'Tenant branding & theme configuration saved successfully!' });
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to save branding settings.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetToDefault = () => {
    setPrimaryColor('#1e3a8a');
    setSecondaryColor('#0f172a');
    setAccentColor('#d97706');
  };

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-foreground flex items-center gap-3">
            <Palette className="h-7 w-7 text-primary" /> Tenant White-Label &amp; Branding Settings
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-1">
            Configure enterprise brand identity, client portal theme colors, logo header, and support contact details.
          </p>
        </div>

        {/* Status Notification */}
        {statusMsg && (
          <div className={`p-4 rounded-xl text-xs font-bold flex items-center gap-2 border ${
            statusMsg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-800 border-red-200'
          }`}>
            {statusMsg.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            <span>{statusMsg.text}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Form Controls */}
          <div className="lg:col-span-2 bg-card border rounded-3xl p-6 md:p-8 shadow-sm space-y-6">
            <form onSubmit={handleSave} className="space-y-4">
              
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                  Tenant Organization Legal Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full p-2.5 border rounded-xl bg-background text-sm font-bold"
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                  Brand Logo Image URL (PNG/SVG)
                </label>
                <input
                  type="url"
                  placeholder="https://example.com/logo.svg"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  className="w-full p-2.5 border rounded-xl bg-background text-sm font-mono"
                />
              </div>

              {/* Color Pickers */}
              <div className="pt-3 border-t space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Theme Color Palette (Hex Codes)
                  </span>
                  <button
                    type="button"
                    onClick={resetToDefault}
                    className="text-xs text-primary font-bold hover:underline"
                  >
                    Reset Defaults
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-muted-foreground block mb-1">Primary Color</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={primaryColor}
                        onChange={(e) => setPrimaryColor(e.target.value)}
                        className="h-9 w-9 rounded-lg border cursor-pointer"
                      />
                      <input
                        type="text"
                        value={primaryColor}
                        onChange={(e) => setPrimaryColor(e.target.value)}
                        className="w-full p-1.5 border rounded-lg bg-background text-xs font-mono font-bold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-muted-foreground block mb-1">Secondary Dark</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={secondaryColor}
                        onChange={(e) => setSecondaryColor(e.target.value)}
                        className="h-9 w-9 rounded-lg border cursor-pointer"
                      />
                      <input
                        type="text"
                        value={secondaryColor}
                        onChange={(e) => setSecondaryColor(e.target.value)}
                        className="w-full p-1.5 border rounded-lg bg-background text-xs font-mono font-bold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-muted-foreground block mb-1">Accent Gold</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={accentColor}
                        onChange={(e) => setAccentColor(e.target.value)}
                        className="h-9 w-9 rounded-lg border cursor-pointer"
                      />
                      <input
                        type="text"
                        value={accentColor}
                        onChange={(e) => setAccentColor(e.target.value)}
                        className="w-full p-1.5 border rounded-lg bg-background text-xs font-mono font-bold"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Support Contact Info */}
              <div className="pt-3 border-t grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                    Support Email
                  </label>
                  <input
                    type="email"
                    value={supportEmail}
                    onChange={(e) => setSupportEmail(e.target.value)}
                    className="w-full p-2.5 border rounded-xl bg-background text-sm font-semibold"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                    Support Phone
                  </label>
                  <input
                    type="text"
                    value={supportPhone}
                    onChange={(e) => setSupportPhone(e.target.value)}
                    className="w-full p-2.5 border rounded-xl bg-background text-sm font-semibold"
                  />
                </div>
              </div>

              <div className="pt-4 border-t flex justify-end">
                <button
                  type="submit"
                  disabled={isSubmitting || !canManage}
                  className="px-6 py-3 bg-primary text-primary-foreground font-extrabold rounded-2xl text-xs shadow-md hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
                >
                  {isSubmitting && <RefreshCw className="h-4 w-4 animate-spin" />}
                  <Save className="h-4 w-4" /> Save &amp; Apply Tenant Theme
                </button>
              </div>

            </form>
          </div>

          {/* LIVE THEME PREVIEW CARD */}
          <div className="space-y-4">
            <div className="bg-card border-2 border-border rounded-3xl p-6 shadow-sm space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2 border-b pb-3">
                <Eye className="h-4 w-4 text-primary" /> Live Client Portal Preview
              </h3>

              {/* Simulated Navigation Bar */}
              <div style={{ backgroundColor: secondaryColor }} className="p-3 rounded-2xl text-white flex items-center justify-between shadow-xs">
                <div className="flex items-center gap-2">
                  {logoUrl ? (
                    <img src={logoUrl} alt="Logo" className="h-6 w-auto object-contain" />
                  ) : (
                    <Building2 className="h-5 w-5" />
                  )}
                  <span className="font-bold text-xs font-mono">{companyName}</span>
                </div>
                <span style={{ backgroundColor: primaryColor }} className="text-[10px] font-bold px-2 py-0.5 rounded">
                  PORTAL
                </span>
              </div>

              {/* Simulated Content Buttons */}
              <div className="space-y-2 pt-2">
                <button style={{ backgroundColor: primaryColor }} className="w-full py-2.5 rounded-xl text-white font-bold text-xs shadow-sm">
                  Primary Action Button
                </button>

                <button style={{ backgroundColor: accentColor }} className="w-full py-2.5 rounded-xl text-white font-bold text-xs shadow-sm">
                  Accent Action Button
                </button>

                <div className="p-3 border rounded-xl text-xs space-y-1">
                  <div className="font-bold text-foreground">Support Contact Details:</div>
                  <div className="text-muted-foreground flex items-center gap-1.5">
                    <Mail className="h-3 w-3" /> {supportEmail}
                  </div>
                  <div className="text-muted-foreground flex items-center gap-1.5">
                    <Phone className="h-3 w-3" /> {supportPhone}
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>

      </div>
    </AppShell>
  );
}
