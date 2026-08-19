import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { 
  ApplySubmission, 
  ApplyCutSheet, 
  ApplyDocument, 
  UpdateRequest,
  SubmissionPayload,
  UpdateRequestPayload 
} from '../lib/types';
import type { ApplyWizardState } from '../contexts/ApplyWizardContext';

// Client-side rate limiting tracker for status lookups (max 5 failed attempts per hour)
const RATE_LIMIT_KEY = 'forge_status_lookup_attempts';

interface RateLimitRecord {
  failedAttempts: number;
  resetTime: number;
}

const checkRateLimit = (): { allowed: boolean; remainingAttempts: number; retryAfterMin: number } => {
  if (typeof window === 'undefined') return { allowed: true, remainingAttempts: 5, retryAfterMin: 0 };
  const raw = localStorage.getItem(RATE_LIMIT_KEY);
  const now = Date.now();
  if (!raw) return { allowed: true, remainingAttempts: 5, retryAfterMin: 0 };

  try {
    const record: RateLimitRecord = JSON.parse(raw);
    if (now > record.resetTime) {
      localStorage.removeItem(RATE_LIMIT_KEY);
      return { allowed: true, remainingAttempts: 5, retryAfterMin: 0 };
    }
    if (record.failedAttempts >= 5) {
      const remainingMin = Math.ceil((record.resetTime - now) / (60 * 1000));
      return { allowed: false, remainingAttempts: 0, retryAfterMin: remainingMin };
    }
    return { allowed: true, remainingAttempts: 5 - record.failedAttempts, retryAfterMin: 0 };
  } catch {
    return { allowed: true, remainingAttempts: 5, retryAfterMin: 0 };
  }
};

const recordFailedAttempt = () => {
  if (typeof window === 'undefined') return;
  const now = Date.now();
  const raw = localStorage.getItem(RATE_LIMIT_KEY);
  let record: RateLimitRecord = { failedAttempts: 1, resetTime: now + 60 * 60 * 1000 };
  if (raw) {
    try {
      const existing = JSON.parse(raw);
      if (now <= existing.resetTime) {
        record = { failedAttempts: existing.failedAttempts + 1, resetTime: existing.resetTime };
      }
    } catch {
      // ignore
    }
  }
  localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(record));
};

/**
 * Client-Side Image Compression using HTML5 Canvas
 * Resizes high-res phone photos to max 2048px and compresses to 80% JPEG
 */
export async function compressImageFile(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.type.includes('svg')) {
    return file;
  }

  return new Promise((resolve) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => {
      img.src = e.target?.result as string;
    };

    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(file);
        return;
      }

      let { width, height } = img;
      const MAX_DIM = 2048;

      if (width > MAX_DIM || height > MAX_DIM) {
        if (width > height) {
          height = Math.round((height * MAX_DIM) / width);
          width = MAX_DIM;
        } else {
          width = Math.round((width * MAX_DIM) / height);
          height = MAX_DIM;
        }
      }

      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob && blob.size < file.size) {
            const compressedFile = new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          } else {
            resolve(file); // Keep original if compression wasn't smaller
          }
        },
        'image/jpeg',
        0.82
      );
    };

    img.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}

/**
 * Upload document directly to Supabase Storage Bucket `apply-documents`
 */
export async function uploadDocumentToStorage(file: File, submissionRef: string, category: string): Promise<string> {
  if (!supabase) {
    // Return mock path for offline mode
    return `apply-documents/${submissionRef}/${Date.now()}_${file.name}`;
  }

  // Compress if image
  const processedFile = await compressImageFile(file);
  const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const path = `${submissionRef}/${Date.now()}_${cleanFileName}`;

  const { data, error } = await supabase.storage
    .from('apply-documents')
    .upload(path, processedFile, {
      cacheControl: '3600',
      upsert: true,
    });

  if (error) {
    console.warn('Supabase storage upload error:', error.message);
    // Fallback path
    return `apply-documents/${path}`;
  }

  return data.path;
}

/**
 * Hook for full multi-step application submission
 */
export function useSubmitApplication() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (wizardState: ApplyWizardState) => {
      // 1. Bot Honeypot Check
      if (wizardState.companyInfo.website_url_hp && wizardState.companyInfo.website_url_hp.trim().length > 0) {
        // Silently simulate success for bots without saving spam
        return {
          success: true,
          reference_code: `APP-${new Date().getFullYear()}-0001`,
          submission_id: 'bot-filtered',
        };
      }

      // Generate reference code preview
      const tempRef = `APP-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

      // 2. Upload Pending Files to Storage
      const uploadedDocs: Array<{
        file_name: string;
        file_path: string;
        file_size_bytes: number;
        file_type: string;
        category: string;
        description?: string;
      }> = [];

      for (const doc of wizardState.documents) {
        if (doc.file) {
          try {
            const storagePath = await uploadDocumentToStorage(doc.file, tempRef, doc.category);
            uploadedDocs.push({
              file_name: doc.file_name,
              file_path: storagePath,
              file_size_bytes: doc.file_size_bytes,
              file_type: doc.file_type,
              category: doc.category,
              description: doc.description,
            });
          } catch (e) {
            console.error('File upload error:', e);
          }
        }
      }

      // 3. Assemble complete payload
      const payload: SubmissionPayload = {
        company_name: wizardState.companyInfo.company_name,
        contact_name: wizardState.companyInfo.contact_name,
        contact_email: wizardState.companyInfo.contact_email,
        contact_phone: wizardState.companyInfo.contact_phone,
        brand_name: wizardState.companyInfo.brand_name,
        website: wizardState.companyInfo.website,
        submission_type: wizardState.companyInfo.order_type === 'sample_request' ? 'sample_request' : 'new_order',
        client_notes: [
          `Order Type: ${wizardState.workOrder.order_type} · Priority: ${wizardState.workOrder.priority || 'Normal'}${wizardState.workOrder.priority === 'Rush' ? ' (Rush Multiplier: 2.0x)' : ''} · Wash: ${wizardState.workOrder.wash_type} · Duration: ${wizardState.blanketPo.contract_duration}`,
          wizardState.companyInfo.existing_order_reference ? `PO Ref: ${wizardState.companyInfo.existing_order_reference}` : '',
          wizardState.companyInfo.billing_street ? `Billing Address: ${wizardState.companyInfo.billing_street}, ${wizardState.companyInfo.billing_city || ''} ${wizardState.companyInfo.billing_state || ''} ${wizardState.companyInfo.billing_zip || ''} ${wizardState.companyInfo.billing_country || ''}` : '',
          wizardState.companyInfo.shipping_street ? `Shipping Address: ${wizardState.companyInfo.shipping_street}, ${wizardState.companyInfo.shipping_city || ''} ${wizardState.companyInfo.shipping_state || ''} ${wizardState.companyInfo.shipping_zip || ''} ${wizardState.companyInfo.shipping_country || ''}` : '',
        ].filter(Boolean).join('\n'),
        cut_sheets: [
          {
            sheet_name: `${wizardState.workOrder.style_name} Cut Ticket`,
            sheet_type: wizardState.cutSheetType,
            style_number: wizardState.workOrder.style_number,
            colorway: wizardState.workOrder.colorway,
            cut_number: wizardState.cutSheetData.cut_number || `CUT-${Date.now().toString().slice(-6)}`,
            cut_date: wizardState.blanketPo.expected_start_date,
            cutter_name: wizardState.cutSheetData.cutter_name || 'Production Floor',
            wash_type: wizardState.workOrder.wash_type,
            sheet_data: {
              ...wizardState.cutSheetData.sheet_data,
              fabrics: wizardState.sizeMatrix.fabrics,
              grand_total: wizardState.sizeMatrix.grand_total,
              style_name: wizardState.workOrder.style_name,
            },
          },
        ],
        documents: uploadedDocs,
      };

      // 4. Invoke Edge Function or REST Fallback
      if (supabase) {
        try {
          const { data, error } = await supabase.functions.invoke('submit-application', {
            body: payload,
          });

          if (!error && data?.reference_code) {
            return data;
          }
        } catch (edgeErr) {
          console.warn('Edge function invoke failed, falling back to direct DB insert:', edgeErr);
        }

        // Direct DB Fallback
        const mainStyle = wizardState.styleBlocks?.[0] || {
          product_type: 'Denim/Bottoms',
          fabric_type: 'Woven',
          trims_bom: [],
        };

        const resolvedSubmissionType = payload.submission_type || wizardState.companyInfo.order_type || 'new_order';

        const { data: subData, error: subError } = await supabase
          .from('apply_submissions')
          .insert({
            company_name: payload.company_name,
            contact_name: payload.contact_name,
            contact_email: payload.contact_email,
            contact_phone: payload.contact_phone,
            brand_name: payload.brand_name,
            website: payload.website,
            submission_type: resolvedSubmissionType,
            source: 'apply_portal',
            status: 'pending_review',
            client_notes: payload.client_notes,
            product_type: mainStyle.product_type,
            fabric_type: mainStyle.fabric_type,
            style_blocks: wizardState.styleBlocks || [],
            trim_components: mainStyle.trims_bom || [],
            billing_street: wizardState.companyInfo.billing_street,
            billing_city: wizardState.companyInfo.billing_city,
            billing_state: wizardState.companyInfo.billing_state,
            billing_zip: wizardState.companyInfo.billing_zip,
            billing_country: wizardState.companyInfo.billing_country,
            shipping_street: wizardState.companyInfo.shipping_street,
            shipping_city: wizardState.companyInfo.shipping_city,
            shipping_state: wizardState.companyInfo.shipping_state,
            shipping_zip: wizardState.companyInfo.shipping_zip,
            shipping_country: wizardState.companyInfo.shipping_country,
            existing_order_reference: wizardState.companyInfo.existing_order_reference,
          })
          .select()
          .single();

        if (subError) throw subError;

        // Insert cut sheet — use 'submission_id' as per apply_cut_sheets schema
        if (payload.cut_sheets?.length) {
          await supabase.from('apply_cut_sheets').insert(
            payload.cut_sheets.map((cs: any) => ({
              submission_id: subData.id,   // correct FK column name
              sheet_type: cs.sheet_type || 'factory_one_production',
              style_no: cs.style_number || cs.style_no || 'N/A',
              cut_no: cs.cut_number || cs.cut_no || cs.cut_no_preview,
              cutter_name: cs.cutter_name,
              wash_dx_cd: cs.wash_type,
              sheet_data: cs.sheet_data || {},
            }))
          );
        }

        // Insert document records — use 'submission_id' as per apply_documents schema
        if (uploadedDocs.length > 0) {
          await supabase.from('apply_documents').insert(
            uploadedDocs.map((doc) => ({
              submission_id: subData.id,   // correct FK column name
              doc_type: doc.category || 'other',
              file_name: doc.file_name,
              file_path: doc.file_path,
              file_size_bytes: doc.file_size_bytes,
              mime_type: doc.file_type,
              description: doc.description,
            }))
          );
        }

        // Cache into local storage so merchandiser inbox displays it instantly
        let newSubRecord: any = null;
        try {
          const cachedStr = typeof window !== "undefined" ? localStorage.getItem("forge_submissions_cache") : null;
          const cached = cachedStr ? JSON.parse(cachedStr) : [];
          newSubRecord = {
            id: subData?.id || `sub-${Date.now()}`,
            company_name: payload.company_name,
            contact_name: payload.contact_name,
            contact_email: payload.contact_email,
            contact_phone: payload.contact_phone,
            brand_name: payload.brand_name,
            website: payload.website,
            status: "pending_review",
            submission_type: resolvedSubmissionType,
            source: "apply_portal",
            apply_reference_code: subData?.apply_reference_code || tempRef,
            client_notes: payload.client_notes,
            submitted_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            service_scope: (payload as any).service_scope,
            starting_stage: (payload as any).starting_stage,
          };
          localStorage.setItem("forge_submissions_cache", JSON.stringify([newSubRecord, ...cached]));
          
          // Dispatch real-time global event so SampleRequestsDashboard and SubmissionsInbox update immediately
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("forge_submission_created", { detail: newSubRecord }));
          }
        } catch (e) {
          console.warn("Could not write submission to localStorage cache", e);
        }

        return {
          success: true,
          submission_id: subData.id,
          reference_code: subData.apply_reference_code || tempRef,
        };
      }

      // Mock Local Fallback
      const newMockId = `sub-${Date.now()}`;
      try {
        const cachedStr = typeof window !== "undefined" ? localStorage.getItem("forge_submissions_cache") : null;
        const cached = cachedStr ? JSON.parse(cachedStr) : [];
        const newSubRecord = {
          id: newMockId,
          company_name: payload.company_name,
          contact_name: payload.contact_name,
          contact_email: payload.contact_email,
          contact_phone: payload.contact_phone,
          brand_name: payload.brand_name,
          website: payload.website,
          status: "pending_review",
          submission_type: payload.submission_type,
          source: "apply_portal",
          apply_reference_code: tempRef,
          client_notes: payload.client_notes,
          submitted_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          service_scope: (payload as any).service_scope,
          starting_stage: (payload as any).starting_stage,
        };
        localStorage.setItem("forge_submissions_cache", JSON.stringify([newSubRecord, ...cached]));
      } catch (e) {
        console.warn("Could not write submission to localStorage cache", e);
      }

      return {
        success: true,
        submission_id: newMockId,
        reference_code: tempRef,
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apply-submissions'] });
      queryClient.invalidateQueries({ queryKey: ['merchandiser_submissions'] });
    },
  });
}

/**
 * Hook for submitting client order update/revision requests
 */
export function useSubmitUpdateRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: UpdateRequestPayload) => {
      if (supabase) {
        try {
          const { data, error } = await supabase.functions.invoke('submit-update-request', {
            body: payload,
          });
          if (!error && data?.request_id) return data;
        } catch (e) {
          console.warn('Edge function invoke failed, using direct insert:', e);
        }

        const { data, error } = await supabase
          .from('update_requests')
          .insert({
            blanket_po_id: payload.blanket_po_id,
            work_order_id: payload.work_order_id,
            apply_submission_id: payload.apply_submission_id,
            requested_by_email: payload.requested_by_email,
            request_type: payload.request_type,
            priority: payload.priority || 'normal',
            subject: payload.subject,
            description: payload.description,
            status: 'submitted',
          })
          .select()
          .single();

        if (error) throw error;
        return { success: true, request_id: data.id, reference_number: data.id.slice(0, 8).toUpperCase() };
      }

      return {
        success: true,
        request_id: `req-${Date.now()}`,
        reference_number: `REQ-${Date.now().toString().slice(-6)}`,
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['update-requests'] });
    },
  });
}

/**
 * Hook for tracking public status with Supabase Realtime live subscriptions
 */
export function useTrackStatus(referenceCode: string, email: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['apply-status', referenceCode, email],
    queryFn: async () => {
      const rateCheck = checkRateLimit();
      if (!rateCheck.allowed) {
        throw new Error(`Too many failed attempts. Please wait ${rateCheck.retryAfterMin} minutes before trying again.`);
      }

      if (!supabase) {
        // Return mock matching data
        return {
          id: 'sub-mock-1',
          company_name: 'Studio Iron & Indigo',
          contact_name: 'Alex Mercer',
          contact_email: email || 'alex@ironindigo.com',
          brand_name: 'Iron & Indigo Denim Co.',
          status: 'under_review' as const,
          submission_type: 'new_order' as const,
          source: 'apply_portal' as const,
          apply_reference_code: referenceCode,
          submitted_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          client_notes: 'Target delivery for Autumn/Winter drop. Sample first.',
          internal_notes: 'Under review by Senior Merchandiser. Capacity scheduled for Bay Area facility.',
          created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          updated_at: new Date().toISOString(),
          apply_cut_sheets: [
            {
              id: 'cs-1',
              sheet_name: 'WSM-M260 Paul 5 Pkt Jean Cut Ticket',
              sheet_type: 'weissmade_size_matrix',
              style_number: 'WDLEG-R-DIN',
              colorway: 'INDIGO',
              cut_number: 'CUT-88402',
              sheet_data: {
                grand_total: 450,
                fabrics: [
                  { fabric_name: 'SALT', color: 'INDIGO', line_total: 265 },
                  { fabric_name: 'RIVER', color: 'DARK WASH', line_total: 185 },
                ],
              },
            },
          ],
          apply_documents: [
            {
              id: 'doc-1',
              file_name: 'Iron_Indigo_Paul_Jean_TechPack_v2.pdf',
              category: 'Tech Pack / Design Spec',
              file_size_bytes: 4200000,
            },
          ],
          update_requests: [] as UpdateRequest[],
        };
      }

      // Server-side lookup via SECURITY DEFINER RPC — the reference-code + email
      // match is enforced in the database (get_submission_status_by_reference),
      // not trusted to client-side query filters, so anon RLS on apply_submissions
      // and its child tables can stay locked down. The RPC returns the
      // submission plus its cut sheets / documents / update requests / price
      // quotes as one nested JSON payload.
      const { data, error: rpcError } = await supabase.rpc('get_submission_status_by_reference', {
        p_reference_code: referenceCode.trim().toUpperCase(),
        p_email: email.trim(),
      });

      if (rpcError || !data) {
        recordFailedAttempt();
        throw new Error('No submission found matching this Reference Code and Contact Email.');
      }

      return data;
    },
    enabled: Boolean(referenceCode && email && referenceCode.length >= 6),
    retry: 0,
  });

  // Supabase Realtime Subscription for Live Status Updates
  useEffect(() => {
    if (!supabase || !referenceCode) return;

    const channel = supabase
      .channel(`status-${referenceCode}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'apply_submissions',
          filter: `apply_reference_code=eq.${referenceCode.trim().toUpperCase()}`,
        },
        (_payload: any) => {
          queryClient.invalidateQueries({ queryKey: ['apply-status', referenceCode, email] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [referenceCode, email, queryClient]);

  return query;
}

/**
 * REQ-07: Customer-side quote accept/reject on the no-login public status
 * page. Ownership is proven by reference code + email (same model as
 * useTrackStatus), not a Supabase Auth session.
 */
export function useRespondToPriceQuote(referenceCode: string, email: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ quoteId, response }: { quoteId: string; response: 'Accepted' | 'Rejected' }) => {
      if (!supabase) throw new Error('Not connected to the live database.');
      const { data, error } = await supabase.rpc('respond_to_price_quote', {
        p_quote_id: quoteId,
        p_reference_code: referenceCode,
        p_email: email,
        p_response: response,
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apply-status', referenceCode, email] });
    },
  });
}

/**
 * Check if a client email already has pending submissions (Step 1 UX)
 */
export function useCheckExistingEmail() {
  const [isChecking, setIsChecking] = useState(false);

  const checkEmail = async (email: string): Promise<ApplySubmission | null> => {
    if (!email || !email.includes('@') || !supabase) return null;
    setIsChecking(true);
    try {
      const { data } = await supabase
        .from('apply_submissions')
        .select('id, apply_reference_code, status, company_name, submitted_at')
        .ilike('contact_email', email.trim())
        .in('status', ['pending_review', 'under_review', 'needs_info'])
        .order('submitted_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      return data as ApplySubmission | null;
    } catch {
      return null;
    } finally {
      setIsChecking(false);
    }
  };

  return { checkEmail, isChecking };
}
