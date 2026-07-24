import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { AppShell, SectionCard } from "../components/AppShell";
import { useAppData } from "../hooks/useAppData";
import { supabase, isRealSupabase } from "../lib/supabase";
import {
  User, Building, Bell, Monitor, Lock, Save,
  CheckCircle, XCircle, Shield
} from "lucide-react";

export const Route = createFileRoute("/account")({
  component: AccountPage,
});

function AccountPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { customers, updateCustomer, updateProfileSettings } = useAppData();

  const [activeTab, setActiveTab] = useState<"profile" | "company" | "notifications" | "display" | "security">("profile");

  const [statusMsg, setStatusMsg] = useState("");
  const [isSuccess, setIsSuccess] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Profile Form State
  const [fullName, setFullName] = useState(user?.full_name || "");
  const [phone, setPhone] = useState(user?.contact_phone || "");

  // Company Form State (Customer Only)
  const userCustomer = customers.find(c => c.name === user?.customer_name);
  const [billingAddress, setBillingAddress] = useState(userCustomer?.billing_address || "");
  const [shippingAddress, setShippingAddress] = useState(userCustomer?.shipping_address || "");

  // Notification Preferences State
  const [notifPrefs, setNotifPrefs] = useState<Record<string, boolean>>(user?.notification_prefs || {});

  // Display Preferences State
  const [theme, setTheme] = useState(user?.display_theme || "light");
  const [dashboardView, setDashboardView] = useState(user?.dashboard_view || "default");

  // Security
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    if (!loading && !user) {
      navigate({ to: "/login" });
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      setFullName(user.full_name || "");
      setPhone(user.contact_phone || "");
      setNotifPrefs(user.notification_prefs || {});
      setTheme(user.display_theme || "light");
      setDashboardView(user.dashboard_view || "default");
    }
  }, [user]);

  useEffect(() => {
    if (userCustomer) {
      setBillingAddress(userCustomer.billing_address || "");
      setShippingAddress(userCustomer.shipping_address || "");
    }
  }, [userCustomer]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-6 w-6 border-2 border-primary border-t-transparent animate-spin rounded-full mx-auto" />
      </div>
    );
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setStatusMsg("");
    try {
      await updateProfileSettings({ full_name: fullName, contact_phone: phone });
      setIsSuccess(true);
      setStatusMsg("Personal profile updated successfully.");
    } catch (err: any) {
      setIsSuccess(false);
      setStatusMsg(err.message || "Failed to save profile.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userCustomer) return;
    setIsSaving(true);
    setStatusMsg("");
    try {
      await updateCustomer(userCustomer.id, { billing_address: billingAddress, shipping_address: shippingAddress });
      setIsSuccess(true);
      setStatusMsg("Company information updated successfully.");
    } catch (err: any) {
      setIsSuccess(false);
      setStatusMsg(err.message || "Failed to save company info.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveNotifications = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setStatusMsg("");
    try {
      await updateProfileSettings({ notification_prefs: notifPrefs });
      setIsSuccess(true);
      setStatusMsg("Notification preferences updated successfully.");
    } catch (err: any) {
      setIsSuccess(false);
      setStatusMsg(err.message || "Failed to save notifications.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveDisplay = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setStatusMsg("");
    try {
      await updateProfileSettings({ display_theme: theme as any, dashboard_view: dashboardView as any });
      setIsSuccess(true);
      setStatusMsg("Display preferences updated successfully.");
    } catch (err: any) {
      setIsSuccess(false);
      setStatusMsg(err.message || "Failed to save display prefs.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setIsSuccess(false);
      setStatusMsg("Passwords do not match.");
      return;
    }
    if (newPassword.length < 6) {
      setIsSuccess(false);
      setStatusMsg("Password must be at least 6 characters.");
      return;
    }
    setIsSaving(true);
    setStatusMsg("");
    try {
      if (isRealSupabase) {
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) throw error;
      }
      setIsSuccess(true);
      setStatusMsg("Password updated successfully.");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setIsSuccess(false);
      setStatusMsg(err.message || "Failed to update password.");
    } finally {
      setIsSaving(false);
    }
  };

  const isCustomer = user.role === "customer";

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto space-y-6">
        
        {statusMsg && (
          <div className={`p-4 rounded-md flex items-start gap-3 border ${
            isSuccess ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-800"
          }`}>
            {isSuccess ? <CheckCircle className="h-5 w-5 shrink-0 mt-0.5" /> : <XCircle className="h-5 w-5 shrink-0 mt-0.5" />}
            <div className="text-sm font-medium">{statusMsg}</div>
          </div>
        )}

        <div className="flex gap-6 flex-col md:flex-row">
          
          {/* Sidebar Navigation */}
          <div className="md:w-64 shrink-0 flex flex-col gap-1">
            <button
              onClick={() => setActiveTab("profile")}
              className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                activeTab === "profile" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"
              }`}
            >
              <User className="h-4 w-4" /> Personal Profile
            </button>
            
            {isCustomer && (
              <button
                onClick={() => setActiveTab("company")}
                className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                  activeTab === "company" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"
                }`}
              >
                <Building className="h-4 w-4" /> Company Details
              </button>
            )}

            <button
              onClick={() => setActiveTab("notifications")}
              className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                activeTab === "notifications" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"
              }`}
            >
              <Bell className="h-4 w-4" /> Notifications
            </button>

            {!isCustomer && (
              <button
                onClick={() => setActiveTab("display")}
                className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                  activeTab === "display" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"
                }`}
              >
                <Monitor className="h-4 w-4" /> Display Settings
              </button>
            )}

            <button
              onClick={() => setActiveTab("security")}
              className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                activeTab === "security" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"
              }`}
            >
              <Lock className="h-4 w-4" /> Security
            </button>
          </div>

          {/* Main Content Area */}
          <div className="flex-1">
            
            {activeTab === "profile" && (
              <SectionCard title="Personal Profile" description="Manage your personal contact information.">
                <form onSubmit={handleSaveProfile} className="space-y-4 mt-4">
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1">Email Address</label>
                    <input
                      type="text"
                      disabled
                      value={user.email}
                      className="w-full bg-muted/50 border border-border rounded-md px-3 py-2 text-sm text-muted-foreground cursor-not-allowed"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Email cannot be changed.</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1">Full Name</label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Jane Doe"
                      className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-shadow"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1">Contact Phone</label>
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="e.g. +1 555-0199"
                      className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-shadow"
                    />
                  </div>
                  <div className="pt-4 border-t border-border">
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-2"
                    >
                      <Save className="h-4 w-4" /> {isSaving ? "Saving..." : "Save Profile"}
                    </button>
                  </div>
                </form>
              </SectionCard>
            )}

            {activeTab === "company" && isCustomer && (
              <SectionCard title="Company Details" description="Manage your brand's billing and shipping locations.">
                <form onSubmit={handleSaveCompany} className="space-y-4 mt-4">
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1">Brand / Company Name</label>
                    <input
                      type="text"
                      disabled
                      value={user.customer_name || ""}
                      className="w-full bg-muted/50 border border-border rounded-md px-3 py-2 text-sm text-muted-foreground cursor-not-allowed"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Contact an admin to change your company name.</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1">Billing Address</label>
                    <textarea
                      value={billingAddress}
                      onChange={(e) => setBillingAddress(e.target.value)}
                      placeholder="Enter billing address..."
                      rows={3}
                      className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-shadow resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1">Shipping Address</label>
                    <textarea
                      value={shippingAddress}
                      onChange={(e) => setShippingAddress(e.target.value)}
                      placeholder="Enter default shipping address..."
                      rows={3}
                      className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-shadow resize-none"
                    />
                  </div>
                  <div className="pt-4 border-t border-border">
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-2"
                    >
                      <Save className="h-4 w-4" /> {isSaving ? "Saving..." : "Save Company"}
                    </button>
                  </div>
                </form>
              </SectionCard>
            )}

            {activeTab === "notifications" && (
              <SectionCard title="Notification Preferences" description="Choose what events you want to be notified about.">
                <form onSubmit={handleSaveNotifications} className="space-y-4 mt-4">
                  
                  {isCustomer ? (
                    <>
                      <label className="flex items-start gap-3 p-3 border border-border rounded-lg hover:bg-muted/30 cursor-pointer transition-colors">
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={notifPrefs["stage_sewing"] || false}
                          onChange={(e) => setNotifPrefs({ ...notifPrefs, stage_sewing: e.target.checked })}
                        />
                        <div>
                          <div className="text-sm font-medium">Order enters Sewing Stage</div>
                          <div className="text-xs text-muted-foreground">Get an alert when your order leaves cutting and begins assembly.</div>
                        </div>
                      </label>
                      <label className="flex items-start gap-3 p-3 border border-border rounded-lg hover:bg-muted/30 cursor-pointer transition-colors">
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={notifPrefs["stage_qc"] || false}
                          onChange={(e) => setNotifPrefs({ ...notifPrefs, stage_qc: e.target.checked })}
                        />
                        <div>
                          <div className="text-sm font-medium">Order enters QC Checkpoints</div>
                          <div className="text-xs text-muted-foreground">Get notified when garments are being inspected.</div>
                        </div>
                      </label>
                      <label className="flex items-start gap-3 p-3 border border-border rounded-lg hover:bg-muted/30 cursor-pointer transition-colors">
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={notifPrefs["stage_shipped"] || false}
                          onChange={(e) => setNotifPrefs({ ...notifPrefs, stage_shipped: e.target.checked })}
                        />
                        <div>
                          <div className="text-sm font-medium">Order Dispatched</div>
                          <div className="text-xs text-muted-foreground">Get tracking information when cartons are shipped.</div>
                        </div>
                      </label>
                    </>
                  ) : (
                    <>
                      <label className="flex items-start gap-3 p-3 border border-border rounded-lg hover:bg-muted/30 cursor-pointer transition-colors">
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={notifPrefs["alert_qc"] || false}
                          onChange={(e) => setNotifPrefs({ ...notifPrefs, alert_qc: e.target.checked })}
                        />
                        <div>
                          <div className="text-sm font-medium">QC & Inspection Alerts</div>
                          <div className="text-xs text-muted-foreground">Receive alerts for AQL failures and rework assignments.</div>
                        </div>
                      </label>
                      <label className="flex items-start gap-3 p-3 border border-border rounded-lg hover:bg-muted/30 cursor-pointer transition-colors">
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={notifPrefs["alert_materials"] || false}
                          onChange={(e) => setNotifPrefs({ ...notifPrefs, alert_materials: e.target.checked })}
                        />
                        <div>
                          <div className="text-sm font-medium">Material Shortages</div>
                          <div className="text-xs text-muted-foreground">Get notified when an order is blocked by missing materials.</div>
                        </div>
                      </label>
                      <label className="flex items-start gap-3 p-3 border border-border rounded-lg hover:bg-muted/30 cursor-pointer transition-colors">
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={notifPrefs["alert_shipping"] || false}
                          onChange={(e) => setNotifPrefs({ ...notifPrefs, alert_shipping: e.target.checked })}
                        />
                        <div>
                          <div className="text-sm font-medium">Logistics & Dispatch</div>
                          <div className="text-xs text-muted-foreground">Receive alerts for completed production ready to pack.</div>
                        </div>
                      </label>
                    </>
                  )}

                  <div className="pt-4 border-t border-border">
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-2"
                    >
                      <Save className="h-4 w-4" /> {isSaving ? "Saving..." : "Save Preferences"}
                    </button>
                  </div>
                </form>
              </SectionCard>
            )}

            {activeTab === "display" && !isCustomer && (
              <SectionCard title="Display Preferences" description="Customize your interface experience.">
                <form onSubmit={handleSaveDisplay} className="space-y-4 mt-4">
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1">Interface Theme</label>
                    <select
                      value={theme}
                      onChange={(e) => setTheme(e.target.value as "light" | "dark" | "system")}
                      className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                    >
                      <option value="light">Light Mode</option>
                      <option value="dark">Dark Mode</option>
                      <option value="system">System Default</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1">Default Dashboard View</label>
                    <select
                      value={dashboardView}
                      onChange={(e) => setDashboardView(e.target.value as "default" | "pipeline" | "kanban")}
                      className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                    >
                      <option value="default">KPI Overview</option>
                      <option value="pipeline">Production Pipeline</option>
                      <option value="kanban">Kanban Board</option>
                    </select>
                  </div>
                  <div className="pt-4 border-t border-border">
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-2"
                    >
                      <Save className="h-4 w-4" /> {isSaving ? "Saving..." : "Save Display"}
                    </button>
                  </div>
                </form>
              </SectionCard>
            )}

            {activeTab === "security" && (
              <SectionCard title="Security" description="Update your password and secure your account.">
                <form onSubmit={handleUpdatePassword} className="space-y-4 mt-4">
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1">New Password</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-shadow"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1">Confirm New Password</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-shadow"
                    />
                  </div>
                  
                  {!isRealSupabase && (
                    <div className="p-3 bg-blue-50 border border-blue-200 text-blue-800 rounded-md text-xs flex items-start gap-2 mt-2">
                      <Shield className="h-4 w-4 mt-0.5 shrink-0" />
                      <div>You are currently running in mock mode. Password updates won't be saved permanently until connected to Supabase.</div>
                    </div>
                  )}

                  <div className="pt-4 border-t border-border">
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-2"
                    >
                      <Lock className="h-4 w-4" /> {isSaving ? "Updating..." : "Update Password"}
                    </button>
                  </div>
                </form>
              </SectionCard>
            )}

          </div>
        </div>
      </div>
    </AppShell>
  );
}
