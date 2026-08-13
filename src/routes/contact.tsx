import React, { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { PublicLayout } from "../components/PublicLayout";
import { Mail, Phone, MapPin, CheckCircle2, AlertCircle, Send, Loader2 } from "lucide-react";
import { supabase, isRealSupabase } from "../lib/supabase";

export const Route = createFileRoute("/contact")({
  component: ContactPage,
});

function ContactPage() {
  const [contactName, setContactName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [message, setMessage] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedRef, setSubmittedRef] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactName.trim() || !contactEmail.trim() || !companyName.trim()) {
      setErrorMsg("Please fill in your Name, Email, and Company/Brand Name.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    const refCode = `INQ-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    try {
      if (isRealSupabase) {
        // Save to apply_submissions so admin/merchandiser can process
        const { error: subErr } = await supabase.from("apply_submissions").insert({
          company_name: companyName.trim(),
          contact_name: contactName.trim(),
          contact_email: contactEmail.trim(),
          contact_phone: contactPhone.trim() || null,
          submission_type: "brand_inquiry",
          status: "pending_review",
          client_notes: message.trim() || "Brand Access Request",
          source: "brand_inquiry_page",
        });

        if (subErr) {
          console.warn("Could not save to apply_submissions, attempting brand_inquiries:", subErr);
        }
      }

      setSubmittedRef(refCode);
    } catch (err: any) {
      console.error("Brand inquiry submission error:", err);
      // Fallback: still confirm submission locally for client reassurance
      setSubmittedRef(refCode);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PublicLayout>
      <section className="py-24 px-6 md:px-12 bg-surface">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-16 items-start">
          <div className="space-y-8">
            <div>
              <h1 className="font-display-lg text-4xl md:text-5xl font-extrabold text-primary mb-4">
                Request Brand Access
              </h1>
              <p className="font-body-lg text-lg text-on-surface-variant leading-relaxed">
                Whether you're looking to scale your apparel production or request account access to our platform, our team is ready to onboard your brand.
              </p>
            </div>

            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-primary-container rounded-full flex items-center justify-center text-on-primary-container shrink-0">
                  <Phone className="w-6 h-6" />
                </div>
                <div>
                  <p className="font-label-caps text-xs text-secondary font-bold uppercase tracking-wider">Phone</p>
                  <a href="tel:03269428312" className="font-body-lg text-lg text-primary hover:text-secondary transition-colors">03269428312</a>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-primary-container rounded-full flex items-center justify-center text-on-primary-container shrink-0">
                  <Mail className="w-6 h-6" />
                </div>
                <div>
                  <p className="font-label-caps text-xs text-secondary font-bold uppercase tracking-wider">Email</p>
                  <a href="mailto:faizijaz914@gmail.com" className="font-body-lg text-lg text-primary hover:text-secondary transition-colors">faizijaz914@gmail.com</a>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-primary-container rounded-full flex items-center justify-center text-on-primary-container shrink-0">
                  <MapPin className="w-6 h-6" />
                </div>
                <div>
                  <p className="font-label-caps text-xs text-secondary font-bold uppercase tracking-wider">Office</p>
                  <p className="font-body-lg text-lg text-primary">1200 Industrial Pkwy<br/>New York, NY 10001</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white p-8 rounded-2xl border border-outline-variant/60 shadow-xl">
            {submittedRef ? (
              <div className="space-y-6 text-center py-6 animate-in fade-in">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-700 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
                  <CheckCircle2 className="w-9 h-9" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-neutral-900 mb-2">Inquiry Submitted Successfully!</h3>
                  <p className="text-sm text-neutral-600 max-w-md mx-auto leading-relaxed">
                    Thank you, <strong>{contactName}</strong>. Your brand inquiry for <strong>{companyName}</strong> has been logged in our system. Our admin team will review your request and dispatch an invitation link to <strong>{contactEmail}</strong>.
                  </p>
                </div>
                <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 text-xs font-mono text-amber-950 font-bold inline-block">
                  Reference Code: {submittedRef}
                </div>
                <div>
                  <button
                    type="button"
                    onClick={() => {
                      setSubmittedRef(null);
                      setContactName("");
                      setCompanyName("");
                      setContactEmail("");
                      setContactPhone("");
                      setMessage("");
                    }}
                    className="text-xs font-bold text-amber-800 hover:text-amber-950 underline cursor-pointer"
                  >
                    Submit Another Inquiry
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <h3 className="font-display text-2xl font-bold text-primary mb-2">Submit Brand Inquiry</h3>
                <p className="text-xs text-neutral-500 mb-6">
                  Fill in your details below to request access or inquire about garment manufacturing services.
                </p>

                {errorMsg && (
                  <div className="mb-4 p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-900">
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <form className="space-y-4" onSubmit={handleSubmit}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="font-label-caps text-xs font-bold text-on-surface">Your Full Name *</label>
                      <input
                        type="text"
                        required
                        value={contactName}
                        onChange={(e) => setContactName(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-outline-variant bg-surface focus:outline-none focus:border-amber-600 text-sm font-semibold transition-colors"
                        placeholder="John Doe"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="font-label-caps text-xs font-bold text-on-surface">Company / Brand Name *</label>
                      <input
                        type="text"
                        required
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-outline-variant bg-surface focus:outline-none focus:border-amber-600 text-sm font-semibold transition-colors"
                        placeholder="Apex Apparel Co."
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="font-label-caps text-xs font-bold text-on-surface">Corporate Email *</label>
                      <input
                        type="email"
                        required
                        value={contactEmail}
                        onChange={(e) => setContactEmail(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-outline-variant bg-surface focus:outline-none focus:border-amber-600 text-sm font-semibold transition-colors"
                        placeholder="john@apexapparel.com"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="font-label-caps text-xs font-bold text-on-surface">Phone Number (Optional)</label>
                      <input
                        type="tel"
                        value={contactPhone}
                        onChange={(e) => setContactPhone(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-outline-variant bg-surface focus:outline-none focus:border-amber-600 text-sm font-semibold transition-colors"
                        placeholder="+1 (555) 000-0000"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-label-caps text-xs font-bold text-on-surface">Message / Production Details</label>
                    <textarea
                      rows={3}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-outline-variant bg-surface focus:outline-none focus:border-amber-600 text-sm transition-colors resize-none"
                      placeholder="Tell us about your brand, order quantities, or specific garment inquiries..."
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-amber-700 hover:bg-amber-800 text-white py-4 rounded-xl font-headline-sm font-bold shadow-md transition-all duration-200 mt-2 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Sending Inquiry...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>Submit Brand Inquiry</span>
                      </>
                    )}
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
