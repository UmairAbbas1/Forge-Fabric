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
import { persistCompanyAndAddress } from '../lib/applyPortalCompanySync';
import { useAuth } from './useAuth';
import { getWashDefaultFor } from '../lib/wash-compatibility-matrix';

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
  const { user } = useAuth();

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

      // Category-appropriate wash-type default: a style block that selected
      // Washing & Laundry but was submitted with no explicit wash_type gets
      // backfilled from the fabric/product category's real default (never a
      // single value shared across every category — that's exactly the
      // hardcoded-"Raw / Rigid" bug this whole feature replaced), and is
      // flagged wash_type_is_default so every downstream surface can tell
      // it apart from a real customer choice. This is the one place in the
      // whole submission path a missing wash_type can still slip through
      // (the wizard's own select is required, but nothing else in this
      // multi-step flow hard-blocks on it), so it's centralized here rather
      // than duplicated per-surface.
      const defaultedStyleBlocks = (wizardState.styleBlocks || []).map((block) => {
        const services = (block as any).selected_services as string[] | undefined;
        const needsWash = Array.isArray(services) && services.includes('washing_laundry');
        if (needsWash && !block.wash_type) {
          return {
            ...block,
            wash_type: getWashDefaultFor(block.fabric_type, block.product_type),
            wash_type_is_default: true,
          };
        }
        return block;
      });

      // REQ-14: union of every style block's resolved selected_stages — what
      // this submission actually requested, in internal stage numbers.
      // Stays undefined (not defaulted to all 13) when no block captured a
      // service selection, so the DB column can distinguish "unknown" from
      // "explicitly requested everything."
      const requestedStagesSet = new Set<number>();
      for (const block of defaultedStyleBlocks || []) {
        const blockStages = (block as any).selected_stages;
        if (Array.isArray(blockStages)) {
          for (const s of blockStages) requestedStagesSet.add(s);
        }
      }
      const requestedStages = requestedStagesSet.size > 0 ? Array.from(requestedStagesSet).sort((a, b) => a - b) : undefined;

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
      const isSample = wizardState.companyInfo.order_type === 'sample_request';
      const sampleMainStyle = defaultedStyleBlocks?.[0];

      const payload: SubmissionPayload = {
        company_name: wizardState.companyInfo.company_name,
        contact_name: wizardState.companyInfo.contact_name,
        contact_email: wizardState.companyInfo.contact_email,
        contact_phone: wizardState.companyInfo.contact_phone,
        brand_name: wizardState.companyInfo.brand_name,
        website: wizardState.companyInfo.website,
        submission_type: isSample ? 'sample_request' : 'new_order',
        priority: wizardState.workOrder.priority || 'Normal',
        complexity_tier: wizardState.workOrder.priority === 'Rush' ? wizardState.workOrder.complexity_tier : undefined,
        rush_multiplier: wizardState.workOrder.priority === 'Rush' ? wizardState.workOrder.rush_multiplier : undefined,
        duplicated_from_order_id: wizardState.duplicatedFromOrderId || null,
        // client_notes still mentions it for human readability — priority/
        // complexity_tier/rush_multiplier above are the real structured columns
        // the rest of the system (submissions inbox, ConversionModal pre-fill) reads.
        client_notes: isSample
          ? [
              `Sample Type: ${wizardState.sampleDetails.sample_type} · Sourcing: ${wizardState.sampleDetails.fabric_trim_source} · Turnaround: ${wizardState.sampleDetails.turnaround_date || 'N/A'}`,
              wizardState.sampleDetails.client_reference_sku ? `Client Reference SKU: ${wizardState.sampleDetails.client_reference_sku}` : '',
              wizardState.sampleDetails.special_instructions || '',
              wizardState.companyInfo.shipping_street ? `Shipping Address: ${wizardState.companyInfo.shipping_street}, ${wizardState.companyInfo.shipping_city || ''} ${wizardState.companyInfo.shipping_state || ''} ${wizardState.companyInfo.shipping_zip || ''} ${wizardState.companyInfo.shipping_country || ''}` : '',
            ].filter(Boolean).join('\n')
          : [
              `Order Type: ${wizardState.workOrder.order_type} · Priority: ${wizardState.workOrder.priority || 'Normal'}${wizardState.workOrder.priority === 'Rush' ? ` (${wizardState.workOrder.complexity_tier ? `${wizardState.workOrder.complexity_tier} Tier` : 'Tier not selected'}${wizardState.workOrder.rush_multiplier ? ` · ${wizardState.workOrder.rush_multiplier}x Multiplier` : ''})` : ''} · Wash: ${wizardState.workOrder.wash_type} · Duration: ${wizardState.blanketPo.contract_duration}`,
              wizardState.companyInfo.existing_order_reference ? `PO Ref: ${wizardState.companyInfo.existing_order_reference}` : '',
              wizardState.companyInfo.billing_street ? `Billing Address: ${wizardState.companyInfo.billing_street}, ${wizardState.companyInfo.billing_city || ''} ${wizardState.companyInfo.billing_state || ''} ${wizardState.companyInfo.billing_zip || ''} ${wizardState.companyInfo.billing_country || ''}` : '',
              wizardState.companyInfo.shipping_street ? `Shipping Address: ${wizardState.companyInfo.shipping_street}, ${wizardState.companyInfo.shipping_city || ''} ${wizardState.companyInfo.shipping_state || ''} ${wizardState.companyInfo.shipping_zip || ''} ${wizardState.companyInfo.shipping_country || ''}` : '',
            ].filter(Boolean).join('\n'),
        // apply_submissions.fabric_type is overloaded for sample rows —
        // SampleRequestsDashboard.tsx reads it as the fabric/trim sourcing
        // (Factory Sourced / Brand Sourced), not the garment fabric family;
        // that lives on style_blocks[0].fabric_type instead. Preserving the
        // exact convention the dashboard already expects.
        product_type: isSample ? `${wizardState.sampleDetails.sample_type} Sample` : defaultedStyleBlocks?.[0]?.product_type,
        fabric_type: isSample ? wizardState.sampleDetails.fabric_trim_source : defaultedStyleBlocks?.[0]?.fabric_type,
        style_blocks: defaultedStyleBlocks || [],
        trim_components: defaultedStyleBlocks?.[0]?.trims_bom || [],
        requested_stages: requestedStages,
        cut_sheets: [
          {
            sheet_name: `${isSample ? sampleMainStyle?.style_name || 'Sample' : wizardState.workOrder.style_name} Cut Ticket`,
            sheet_type: wizardState.cutSheetType,
            style_number: isSample ? (wizardState.sampleDetails.client_reference_sku || sampleMainStyle?.style_name) : wizardState.workOrder.style_number,
            colorway: isSample ? sampleMainStyle?.colorway : wizardState.workOrder.colorway,
            cut_number: wizardState.cutSheetData.cut_number || `CUT-${Date.now().toString().slice(-6)}`,
            cut_date: isSample ? (wizardState.sampleDetails.turnaround_date || wizardState.blanketPo.expected_start_date) : wizardState.blanketPo.expected_start_date,
            cutter_name: wizardState.cutSheetData.cutter_name || 'Production Floor',
            wash_type: isSample ? undefined : wizardState.workOrder.wash_type,
            sheet_data: {
              ...wizardState.cutSheetData.sheet_data,
              fabrics: wizardState.sizeMatrix.fabrics,
              grand_total: wizardState.sizeMatrix.grand_total,
              style_name: isSample ? sampleMainStyle?.style_name : wizardState.workOrder.style_name,
            },
          },
        ],
        documents: uploadedDocs,
      };

      // 4. Direct DB Insert
      // The deployed `submit-application` edge function predates style_blocks/
      // requested_stages support and silently drops both fields on insert
      // (confirmed by direct testing — it returns success with a real
      // reference_code, so the app never even noticed and never fell back).
      // Every submission through it lost the customer's actual style, size,
      // colorway, wash, and stage-selection data. Going straight to the same
      // insert this file already used as its fallback avoids depending on
      // that stale deployment; the notification_logs entry below replaces
      // the one piece of real behavior the edge function still provided.
      if (supabase) {
        const mainStyle = defaultedStyleBlocks?.[0] || {
          product_type: 'Denim/Bottoms',
          fabric_type: 'Woven',
          trims_bom: [],
        };

        const resolvedSubmissionType = payload.submission_type || wizardState.companyInfo.order_type || 'new_order';

        // Internal Order Intake (/apply-intake, submitted by staff on a
        // customer's behalf) needs the customer to review and approve
        // before this becomes an active order — but only when there's a
        // real customer account to route that review to, and a real PO
        // reference already on file (required before conversion can ever
        // happen — see submit-customer-review-decision). Anonymous/customer
        // self-submissions (the public /apply/new flow, and /apply-intake
        // when a logged-in customer submits their own order) are completely
        // unaffected — they fall straight through to the unchanged default
        // 'pending_review' staff queue below, exactly as before.
        let resolvedStatus = 'pending_review';
        let resolvedSource = 'apply_portal';
        let customerReviewEmail: string | null = null;
        const isInternalStaffAuthor = Boolean(user?.role && user.role !== 'customer');
        if (isInternalStaffAuthor && wizardState.companyInfo.company_id && wizardState.companyInfo.existing_order_reference?.trim()) {
          try {
            const { data: customerProfile } = await supabase
              .from('profiles')
              .select('email')
              .eq('company_id', wizardState.companyInfo.company_id)
              .eq('role', 'customer')
              .limit(1)
              .maybeSingle();
            if (customerProfile?.email) {
              resolvedStatus = 'pending_customer_review';
              resolvedSource = 'merchandiser_intake';
              customerReviewEmail = customerProfile.email;
            }
          } catch (lookupErr) {
            console.warn('Could not check for a registered customer account, defaulting to standard review queue:', lookupErr);
          }
        }

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
            source: resolvedSource,
            status: resolvedStatus,
            ...(resolvedStatus === 'pending_customer_review' ? { created_by_staff_id: user?.id } : {}),
            client_notes: payload.client_notes,
            priority: payload.priority || 'Normal',
            rush_multiplier: payload.rush_multiplier,
            product_type: payload.product_type,
            fabric_type: payload.fabric_type,
            style_blocks: defaultedStyleBlocks || [],
            trim_components: mainStyle.trims_bom || [],
            requested_stages: requestedStages,
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
            // Lineage for a draft created via "Duplicate This Order" — null
            // for every ordinary application. Traced back to the source
            // order in the submissions inbox and order detail views.
            duplicated_from_order_id: wizardState.duplicatedFromOrderId || null,
            // Sample-only columns that genuinely exist on apply_submissions
            // (confirmed live — estimated_quantity/size_breakdown/
            // turnaround_date/tech_pack_url do NOT exist on this table
            // despite being referenced by the old SampleRequestSubform
            // insert; that write was silently failing on every submission,
            // swallowed by a bare try/catch. Those fields are fully and
            // correctly captured below in the real sample_requests insert,
            // which does have them — no data is lost by not duplicating
            // them here onto columns that were never real.
            ...(isSample ? {
              client_reference_sku: wizardState.sampleDetails.client_reference_sku || null,
              sample_status: 'Sample_Requested',
            } : {}),
          })
          .select()
          .single();

        if (subError) throw subError;

        // Item 3: persist company/contact/shipping address back to the real
        // companies/contacts/address_book tables (shared with the Sample
        // Request flow via persistCompanyAndAddress) so this customer's
        // details auto-prefill on their next order, of either type.
        let finalCompanyId = wizardState.companyInfo.company_id || user?.company_id;
        try {
          const syncResult = await persistCompanyAndAddress(
            wizardState.companyInfo,
            wizardState.companyInfo.shipping_street
              ? {
                  id: wizardState.companyInfo.shipping_address_id,
                  address_type: 'Shipping',
                  recipient_name: wizardState.companyInfo.contact_name,
                  street_1: wizardState.companyInfo.shipping_street,
                  city: wizardState.companyInfo.shipping_city || '',
                  state: wizardState.companyInfo.shipping_state || '',
                  postal_code: wizardState.companyInfo.shipping_zip || '',
                  country: wizardState.companyInfo.shipping_country || '',
                  phone: wizardState.companyInfo.contact_phone,
                }
              : null,
            user?.id,
            finalCompanyId
          );
          if (syncResult.companyId) finalCompanyId = syncResult.companyId;
        } catch (syncErr) {
          console.warn('Could not persist company/address record:', syncErr);
        }

        // Sample Requests inbox (SampleRequestsDashboard.tsx) also reads
        // directly from the dedicated sample_requests table — mirrors the
        // insert SampleRequestSubform.tsx used to do itself before Step 2
        // became part of this shared wizard/submission path.
        if (isSample && finalCompanyId) {
          try {
            const mappedSampleType = ["Fit", "Photo", "Pre-Production", "Counter"].includes(wizardState.sampleDetails.sample_type)
              ? wizardState.sampleDetails.sample_type
              : "Fit";
            await supabase.from('sample_requests').insert({
              company_id: finalCompanyId,
              sample_type: mappedSampleType,
              fabric_trim_source: wizardState.sampleDetails.fabric_trim_source || 'Factory Sourced',
              style_name: sampleMainStyle?.style_name,
              style_description: sampleMainStyle?.style_description || null,
              colorway: sampleMainStyle?.colorway,
              fabric_type: sampleMainStyle?.fabric_type,
              custom_fabric_type: sampleMainStyle?.fabric_type === 'Other' ? sampleMainStyle?.custom_fabric_type : null,
              quantity: sampleMainStyle?.line_total || 1,
              size_breakdown: sampleMainStyle?.size_matrix || {},
              tech_pack_url: wizardState.sampleDetails.tech_pack_url || '',
              turnaround_date: wizardState.sampleDetails.turnaround_date || null,
              special_instructions: wizardState.sampleDetails.special_instructions || '',
              status: 'submitted',
              sample_status: 'Sample_Requested',
              client_reference_sku: wizardState.sampleDetails.client_reference_sku || null,
              reference_photos: wizardState.sampleDetails.reference_photos || [],
            });
          } catch (srErr) {
            console.warn('Could not insert directly to sample_requests table:', srErr);
          }
        }

        // Confirmation notification log — same record submit-application used to write.
        // For an internally-authored submission awaiting customer review,
        // this is a review prompt to the customer instead of a "thank you
        // for your submission" (they didn't submit it — a merchandiser did).
        try {
          if (resolvedStatus === 'pending_customer_review' && customerReviewEmail) {
            await supabase.from('notification_logs').insert({
              recipient_email: customerReviewEmail,
              notification_type: 'customer_review_requested',
              subject: `Action Required: Review Your Order [${subData.apply_reference_code || tempRef}] - ${payload.company_name}`,
              body: `Dear ${payload.contact_name || 'Team'},\n\nYour merchandiser has entered an order on your behalf (reference ${subData.apply_reference_code || tempRef}) and it's ready for your review. Please sign in to your Forge & Fabric dashboard to review the full details and approve or request changes before it moves into production.`,
              related_submission_id: subData.id,
              delivered: true,
            });
          } else {
            await supabase.from('notification_logs').insert({
              recipient_email: payload.contact_email,
              notification_type: 'submission_received',
              subject: `Order Application Received [${subData.apply_reference_code || tempRef}] - ${payload.company_name}`,
              body: `Thank you for your submission. Your reference code is ${subData.apply_reference_code || tempRef}. Our merchandising team will review your order details promptly.`,
              related_submission_id: subData.id,
              delivered: true,
            });
          }
        } catch (notifErr) {
          console.warn('Could not write submission-received notification log:', notifErr);
        }

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
            status: resolvedStatus,
            submission_type: resolvedSubmissionType,
            source: resolvedSource,
            apply_reference_code: subData?.apply_reference_code || tempRef,
            client_notes: payload.client_notes,
            priority: payload.priority || 'Normal',
            rush_multiplier: payload.rush_multiplier,
            submitted_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            service_scope: (payload as any).service_scope,
            starting_stage: (payload as any).starting_stage,
            style_blocks: payload.style_blocks,
            requested_stages: payload.requested_stages,
            product_type: payload.product_type,
            fabric_type: payload.fabric_type,
            estimated_quantity: isSample ? (sampleMainStyle?.line_total || 1) : undefined,
            size_breakdown: isSample ? (sampleMainStyle?.size_matrix || {}) : undefined,
            duplicated_from_order_id: payload.duplicated_from_order_id || null,
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
          pending_customer_review: resolvedStatus === 'pending_customer_review',
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
          priority: payload.priority || 'Normal',
          rush_multiplier: payload.rush_multiplier,
          submitted_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          service_scope: (payload as any).service_scope,
          starting_stage: (payload as any).starting_stage,
          style_blocks: payload.style_blocks,
          requested_stages: payload.requested_stages,
          duplicated_from_order_id: payload.duplicated_from_order_id || null,
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
        // The submit-update-request edge function expects request_subject/
        // request_description but this hook has only ever sent subject/
        // description — every real invocation fails its NOT NULL columns
        // and falls through. Rather than depend on an edge function whose
        // contract has drifted, write directly to update_requests with its
        // real live column names (verified against the schema actually in
        // use — request_subject/request_description, not subject/
        // description; no apply_submission_id column exists at all), the
        // same "replicate directly" pattern already used for reject/
        // approve in useSubmissionDetail.ts.
        const refLabel = payload.po_number || payload.apply_reference_code;

        // Best-effort resolve a real blanket_po_id from the human-readable
        // reference so the ticket is properly linked, not just described in
        // text — falls back to embedding the reference in the subject line
        // when the order hasn't been converted to a blanket PO yet (still
        // just an intake submission), which the table has no column for.
        let blanketPoId = payload.blanket_po_id;
        if (!blanketPoId && !payload.work_order_id && refLabel) {
          try {
            const { data: bpo } = await supabase
              .from('blanket_pos')
              .select('id')
              .or(`po_number.eq.${refLabel},apply_reference_code.eq.${refLabel}`)
              .maybeSingle();
            if (bpo?.id) blanketPoId = bpo.id;
          } catch (e) {
            console.warn('Could not resolve blanket_po_id for update request:', e);
          }
        }

        const subject = refLabel && !blanketPoId
          ? `[${refLabel}] ${payload.subject || 'Order revision request'}`
          : (payload.subject || 'Order revision request');

        const { data, error } = await supabase
          .from('update_requests')
          .insert({
            blanket_po_id: blanketPoId,
            work_order_id: payload.work_order_id,
            requested_by_email: payload.requested_by_email || payload.contact_email,
            request_type: payload.request_type || 'other',
            priority: (payload.priority || 'normal').toLowerCase(),
            request_subject: subject,
            request_description: payload.description || payload.requested_changes || '',
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
      queryClient.invalidateQueries({ queryKey: ['update_requests'] });
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
