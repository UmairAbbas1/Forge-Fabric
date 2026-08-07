import React, { useState } from 'react';
import { useSubmitUpdateRequest } from '../../hooks/useApplySubmission';
import { ReferenceCodeInput } from './ReferenceCodeInput';
import { 
  RefreshCw, 
  Send, 
  Paperclip, 
  CheckCircle2, 
  AlertCircle, 
  ShieldCheck, 
  HelpCircle,
  Clock 
} from 'lucide-react';

export const UpdateRequestForm: React.FC = () => {
  const [referenceCode, setReferenceCode] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [requestType, setRequestType] = useState('spec_change');
  const [priority, setPriority] = useState('Normal');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [submittedId, setSubmittedId] = useState<string | null>(null);

  const updateMutation = useSubmitUpdateRequest();

  const handleFileAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles((prev) => [...prev, ...Array.from(e.target.files || [])]);
    }
  };

  const handleFileRemove = (index: number) => {
    setFiles((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Honeypot check
    if (honeypot.trim()) {
      return;
    }

    try {
      const res = await updateMutation.mutateAsync({
        apply_reference_code: referenceCode.startsWith('APP') ? referenceCode : undefined,
        po_number: referenceCode.startsWith('PO') ? referenceCode : undefined,
        request_type: requestType,
        subject,
        description,
        priority,
        requested_by_name: contactName,
        requested_by_email: contactEmail,
        attached_files: files,
      });

      if (res?.request_id) {
        setSubmittedId(res.request_id);
      }
    } catch (err: any) {
      alert(`Update Request Error: ${err.message || 'Please try again.'}`);
    }
  };

  if (submittedId) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="bg-white border border-neutral-200/90 rounded-3xl p-8 md:p-12 shadow-xs text-center">
          <div className="h-16 w-16 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-neutral-900 tracking-tight">
            Update Request Dispatched
          </h2>
          <p className="text-xs text-neutral-500 max-w-md mx-auto mt-2">
            Your revision request has been logged and assigned to the production floor supervisor for review.
          </p>

          <div className="my-6 p-4 bg-neutral-50 rounded-xl border border-neutral-200 inline-block font-mono text-xs">
            <span className="text-neutral-500 block text-[10px] uppercase font-bold">Request Ticket ID</span>
            <span className="font-bold text-neutral-900 text-sm">{submittedId}</span>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={() => {
                setSubmittedId(null);
                setSubject('');
                setDescription('');
                setFiles([]);
              }}
              className="h-11 px-6 rounded-xl bg-amber-700 hover:bg-amber-800 text-white font-bold text-xs cursor-pointer"
            >
              Submit Another Update
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 md:py-12">
      <div className="bg-white border border-neutral-200/90 rounded-3xl p-6 md:p-10 shadow-xs">
        
        {/* Header */}
        <div className="border-b border-neutral-100 pb-6 mb-8 flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700">
            <RefreshCw className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl md:text-2xl font-bold tracking-tight text-neutral-900">
              Request Order Revision / Spec Update
            </h2>
            <p className="text-xs text-neutral-500">
              Submit change requests for active Blanket POs, Work Orders, or submitted intake applications.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* Honeypot Field */}
          <div className="hidden" aria-hidden="true">
            <input
              type="text"
              name="company_website_url"
              tabIndex={-1}
              autoComplete="off"
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
            />
          </div>

          {/* Reference Number */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1.5">
                Application Code or PO Number *
              </label>
              <ReferenceCodeInput
                value={referenceCode}
                onChange={setReferenceCode}
                placeholder="APP-2026-XXXX or PO-2026-XXXX"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1.5">
                Revision Type *
              </label>
              <select
                value={requestType}
                onChange={(e) => setRequestType(e.target.value)}
                className="w-full h-11 px-3 rounded-xl border border-neutral-300 bg-white text-xs font-semibold text-neutral-800 focus:ring-2 focus:ring-amber-500 shadow-2xs"
              >
                <option value="spec_change">Garment Spec / Wash Recipe Change</option>
                <option value="quantity_change">Size Breakdown / Quantity Adjustment</option>
                <option value="date_change">Target Delivery Date Reschedule</option>
                <option value="document_update">New Tech Pack / Artwork Revision</option>
                <option value="cancel">Order Cancellation Request</option>
                <option value="other">Other General Revision</option>
              </select>
            </div>
          </div>

          {/* Contact Details */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1.5">
                Your Full Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Jane Doe"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl border border-neutral-300 text-xs font-semibold focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1.5">
                Contact Business Email *
              </label>
              <input
                type="email"
                required
                placeholder="jane@brand.com"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl border border-neutral-300 text-xs focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1.5">
                Urgency / Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full h-11 px-3 rounded-xl border border-neutral-300 bg-white text-xs font-semibold text-neutral-800 focus:ring-2 focus:ring-amber-500"
              >
                <option value="Low">Low (Informational)</option>
                <option value="Normal">Normal (Standard Review)</option>
                <option value="High">High (Pre-Cut Adjustments)</option>
                <option value="Urgent">Urgent (Floor Stop / Priority)</option>
              </select>
            </div>
          </div>

          {/* Subject & Description */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1.5">
              Subject Summary *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Revised size 32 ratio + Updated pocket rivet placement"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full h-11 px-3.5 rounded-xl border border-neutral-300 text-xs font-semibold focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1.5">
              Detailed Description of Revision *
            </label>
            <textarea
              required
              rows={4}
              placeholder="Provide exact instructions, delta quantities, new measurement tolerances, or reasoning..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-3.5 rounded-xl border border-neutral-300 text-xs leading-relaxed focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {/* File Attachments */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1.5">
              Attach Revised Documents or Photos
            </label>
            <div className="flex items-center gap-3">
              <label className="h-10 px-4 rounded-xl border border-dashed border-neutral-400 hover:border-amber-700 bg-neutral-50 hover:bg-white text-neutral-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all">
                <Paperclip className="w-3.5 h-3.5 text-neutral-500" />
                <span>Choose Files</span>
                <input type="file" multiple onChange={handleFileAdd} className="hidden" />
              </label>
              <span className="text-[11px] text-neutral-500">
                {files.length} file(s) attached
              </span>
            </div>

            {files.length > 0 && (
              <div className="mt-3 space-y-1.5">
                {files.map((f, i) => (
                  <div key={i} className="flex justify-between items-center bg-neutral-50 p-2 rounded-lg border border-neutral-200 text-xs">
                    <span className="font-mono text-neutral-800 truncate max-w-xs">{f.name}</span>
                    <button
                      type="button"
                      onClick={() => handleFileRemove(i)}
                      className="text-red-600 hover:text-red-800 text-xs font-bold cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Submit Action */}
          <div className="pt-6 border-t border-neutral-100 flex justify-end">
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="h-12 px-8 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md flex items-center gap-2 cursor-pointer transition-all active:scale-98 disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              <span>{updateMutation.isPending ? 'Sending Update...' : 'Submit Revision Request'}</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
