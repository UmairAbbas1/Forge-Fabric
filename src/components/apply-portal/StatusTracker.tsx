import React, { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useTrackStatus, useRespondToPriceQuote } from '../../hooks/useApplySubmission';
import {
  Search,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  RefreshCw,
  Building2,
  Layers,
  Scissors,
  Paperclip,
  HelpCircle,
  ExternalLink,
  ShieldCheck,
  Calculator,
  ThumbsUp,
  ThumbsDown,
} from 'lucide-react';

interface StatusTrackerProps {
  initialReferenceCode?: string;
  initialEmail?: string;
}

export const StatusTracker: React.FC<StatusTrackerProps> = ({
  initialReferenceCode = '',
  initialEmail = '',
}) => {
  const [referenceCode, setReferenceCode] = useState(initialReferenceCode);
  const [email, setEmail] = useState(initialEmail);
  const [submittedQuery, setSubmittedQuery] = useState<{ ref: string; mail: string } | null>(
    initialReferenceCode && initialEmail ? { ref: initialReferenceCode, mail: initialEmail } : null
  );

  const [activeTab, setActiveTab] = useState<'overview' | 'revisions'>('overview');

  const { data: submission, isLoading, isError, error, refetch } = useTrackStatus(
    submittedQuery?.ref || '',
    submittedQuery?.mail || ''
  );

  const respondToQuote = useRespondToPriceQuote(submittedQuery?.ref || '', submittedQuery?.mail || '');
  const [quoteActionError, setQuoteActionError] = useState('');

  const handleQuoteResponse = async (quoteId: string, response: 'Accepted' | 'Rejected') => {
    setQuoteActionError('');
    try {
      await respondToQuote.mutateAsync({ quoteId, response });
    } catch (err) {
      setQuoteActionError(err instanceof Error ? err.message : 'Failed to record your response.');
    }
  };

  const handleLookup = (e: React.FormEvent) => {
    e.preventDefault();
    if (referenceCode.trim() && email.trim()) {
      setSubmittedQuery({
        ref: referenceCode.trim().toUpperCase(),
        mail: email.trim(),
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
      case 'converted':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Approved &amp; Scheduled</span>
          </span>
        );
      case 'under_review':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
            <Clock className="w-3.5 h-3.5 text-amber-700" />
            <span>Under Merchandiser Review</span>
          </span>
        );
      case 'needs_info':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-300">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Action Required (Information Needed)</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-sky-100 text-sky-800 border border-sky-300">
            <Clock className="w-3.5 h-3.5" />
            <span>Intake Pending Review</span>
          </span>
        );
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 md:py-12">
      
      {/* Lookup Header & Form */}
      <div className="bg-white border border-neutral-200/90 rounded-3xl p-6 md:p-8 shadow-xs mb-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700">
            <Search className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-neutral-900">
              Live Order Intake Tracker
            </h2>
            <p className="text-xs text-neutral-500">
              Enter your Reference Code and Contact Email to inspect real-time progress.
            </p>
          </div>
        </div>

        <form onSubmit={handleLookup} className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          <div className="sm:col-span-6">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-600 mb-1">
              Application Reference Code
            </label>
            <input
              type="text"
              required
              placeholder="e.g. APP-2026-8842"
              value={referenceCode}
              onChange={(e) => setReferenceCode(e.target.value.toUpperCase())}
              className="w-full h-11 px-3.5 rounded-xl border border-neutral-300 font-mono text-xs uppercase font-bold focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="sm:col-span-4">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-600 mb-1">
              Contact Email
            </label>
            <input
              type="email"
              required
              placeholder="contact@brand.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-11 px-3.5 rounded-xl border border-neutral-300 text-xs focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="sm:col-span-2 flex items-end">
            <button
              type="submit"
              className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Track</span>
            </button>
          </div>
        </form>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="p-12 text-center bg-white rounded-3xl border border-neutral-200 shadow-xs">
          <RefreshCw className="w-8 h-8 text-amber-700 animate-spin mx-auto mb-3" />
          <p className="text-xs font-bold text-neutral-800">Querying live manufacturing database...</p>
        </div>
      )}

      {/* Error State */}
      {isError && (
        <div className="p-8 bg-white rounded-3xl border border-red-200 shadow-xs text-center">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
          <h3 className="font-bold text-sm text-neutral-900 mb-1">Submission Not Found</h3>
          <p className="text-xs text-neutral-500 max-w-md mx-auto mb-4">
            {error instanceof Error ? error.message : 'Please ensure both your Reference Code and Contact Email match the submission.'}
          </p>
        </div>
      )}

      {/* Active Submission Data Display */}
      {submission && (
        <div className="space-y-6 animate-in fade-in">
          
          {/* Main Status Header Card */}
          <div className="bg-white border border-neutral-200/90 rounded-3xl p-6 md:p-8 shadow-xs">
            <div className="flex flex-wrap justify-between items-start gap-4 pb-6 border-b border-neutral-100">
              <div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-neutral-500 block mb-1">
                  ORDER REFERENCE: {submission.apply_reference_code}
                </span>
                <h3 className="text-2xl font-bold text-neutral-900">
                  {submission.company_name} {submission.brand_name ? `(${submission.brand_name})` : ''}
                </h3>
                <p className="text-xs text-neutral-500 mt-1">
                  Submitted on {new Date(submission.submitted_at || submission.created_at).toLocaleDateString(undefined, { dateStyle: 'long' })}
                </p>
              </div>

              <div>
                {getStatusBadge(submission.status)}
              </div>
            </div>

            {/* Sub-tabs: Overview vs Update Requests */}
            <div className="flex gap-2 pt-6 pb-2 border-b border-neutral-100">
              <button
                type="button"
                onClick={() => setActiveTab('overview')}
                className={`pb-2 px-3 text-xs font-bold border-b-2 cursor-pointer transition-all ${
                  activeTab === 'overview'
                    ? 'border-amber-700 text-amber-900'
                    : 'border-transparent text-neutral-500 hover:text-neutral-900'
                }`}
              >
                Intake Specifications
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('revisions')}
                className={`pb-2 px-3 text-xs font-bold border-b-2 cursor-pointer transition-all ${
                  activeTab === 'revisions'
                    ? 'border-amber-700 text-amber-900'
                    : 'border-transparent text-neutral-500 hover:text-neutral-900'
                }`}
              >
                Update Requests &amp; Revisions ({submission.update_requests?.length || 0})
              </button>
            </div>

            {/* Tab 1: Overview */}
            {activeTab === 'overview' && (
              <div className="pt-6 space-y-6">

                {/* REQ-07: Price Quote Digital Acceptance */}
                {(submission as any).price_quotes?.some((q: any) => q.status === 'Sent_To_Customer') && (
                  <div className="p-5 rounded-2xl bg-purple-50/70 border border-purple-200">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-purple-900 mb-3 flex items-center gap-2">
                      <Calculator className="w-4 h-4 text-purple-700" />
                      <span>Official Price Quote — Action Required</span>
                    </h4>
                    {quoteActionError && (
                      <div className="mb-3 p-2.5 bg-red-100 border border-red-200 rounded-lg text-[11px] font-bold text-red-800">
                        {quoteActionError}
                      </div>
                    )}
                    {(submission as any).price_quotes
                      .filter((q: any) => q.status === 'Sent_To_Customer')
                      .map((q: any) => (
                        <div key={q.id} className="bg-white p-4 rounded-xl border border-purple-200 space-y-2 text-xs">
                          <div className="flex justify-between items-center">
                            <span className="font-mono font-bold text-purple-800">{q.quote_number}</span>
                            <span className="font-bold text-neutral-900">{q.style_name}</span>
                          </div>
                          <div className="flex justify-between text-neutral-600">
                            <span>{q.quantity} pcs @ ${Number(q.final_unit_price).toFixed(2)}/pc</span>
                            <span className="font-black text-emerald-700 text-sm">
                              ${Number(q.total_contract_value).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                          <div className="flex gap-2 pt-2">
                            <button
                              type="button"
                              disabled={respondToQuote.isPending}
                              onClick={() => handleQuoteResponse(q.id, 'Accepted')}
                              className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg flex items-center justify-center gap-1.5 disabled:opacity-50"
                            >
                              <ThumbsUp className="w-3.5 h-3.5" /> Accept Quote
                            </button>
                            <button
                              type="button"
                              disabled={respondToQuote.isPending}
                              onClick={() => handleQuoteResponse(q.id, 'Rejected')}
                              className="flex-1 py-2 bg-white border border-red-300 text-red-700 font-bold rounded-lg hover:bg-red-50 flex items-center justify-center gap-1.5 disabled:opacity-50"
                            >
                              <ThumbsDown className="w-3.5 h-3.5" /> Reject
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                )}

                {/* Notes from Merchandiser */}
                {submission.internal_notes && (
                  <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 text-xs text-amber-950">
                    <p className="font-bold mb-1 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-amber-700" />
                      <span>Merchandiser Review Update:</span>
                    </p>
                    <p className="leading-relaxed">{submission.internal_notes}</p>
                  </div>
                )}

                {/* Cut Sheets Attached */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-700 mb-3 flex items-center gap-2">
                    <Scissors className="w-4 h-4 text-amber-700" />
                    <span>Cut Tickets &amp; Size Matrices</span>
                  </h4>
                  
                  <div className="space-y-2">
                    {submission.apply_cut_sheets?.map((cs: any) => (
                      <div key={cs.id} className="bg-neutral-50 p-4 rounded-xl border border-neutral-200 flex justify-between items-center text-xs">
                        <div>
                          <span className="font-bold text-neutral-900">{cs.sheet_name}</span>
                          <p className="text-[11px] text-neutral-500 font-mono mt-0.5">
                            SKU: {cs.style_number} · Colorway: {cs.colorway}
                          </p>
                        </div>
                        <span className="font-mono font-bold text-amber-900">
                          {cs.sheet_data?.grand_total || 'Standard'} units
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Technical Documents Attached */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-700 mb-3 flex items-center gap-2">
                    <Paperclip className="w-4 h-4 text-amber-700" />
                    <span>Technical Vault Documents</span>
                  </h4>

                  <div className="space-y-2">
                    {submission.apply_documents?.map((doc: any) => (
                      <div key={doc.id} className="bg-neutral-50 p-3 rounded-xl border border-neutral-200 flex justify-between items-center text-xs">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-neutral-500" />
                          <span className="font-bold text-neutral-900">{doc.file_name}</span>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900">
                          {doc.category}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            )}

            {/* Tab 2: Update Requests & Revisions */}
            {activeTab === 'revisions' && (
              <div className="pt-6 space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-700">
                    Change Request History
                  </h4>
                  <Link
                    to="/apply/update"
                    className="h-8 px-3 rounded-lg bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Submit New Update</span>
                  </Link>
                </div>

                {submission.update_requests && submission.update_requests.length > 0 ? (
                  <div className="space-y-3">
                    {submission.update_requests.map((req: any) => (
                      <div key={req.id} className="bg-neutral-50 p-4 rounded-xl border border-neutral-200 space-y-2 text-xs">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-neutral-900">{req.subject}</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-neutral-200 text-neutral-800 uppercase">
                            {req.status}
                          </span>
                        </div>
                        <p className="text-neutral-600 leading-relaxed">{req.description}</p>
                        <span className="text-[10px] text-neutral-400 font-mono block">
                          Type: {req.request_type} · Priority: {req.priority} · Submitted: {new Date(req.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center bg-neutral-50 rounded-2xl border border-dashed border-neutral-300">
                    <p className="text-xs font-bold text-neutral-700">No Revision Requests Submitted</p>
                    <p className="text-[11px] text-neutral-500 mt-1">
                      If you need to update sizing, wash formulation, or tech packs, click Submit New Update.
                    </p>
                  </div>
                )}
              </div>
            )}

          </div>

        </div>
      )}

    </div>
  );
};
