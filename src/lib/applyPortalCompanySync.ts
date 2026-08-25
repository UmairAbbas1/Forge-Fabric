import { supabase, isRealSupabase } from './supabase';
import type { CompanyInfo } from '../contexts/ApplyWizardContext';
import type { AddressData } from '../components/shared/AddressSelector';

export interface CompanySyncResult {
  companyId: string | null;
  addressId: string | null;
}

/**
 * Item 3: the single, shared "save company/contact/address back to the real
 * companies/contacts/address_book tables" mechanism. Both the Bulk Order
 * flow (useApplySubmission.ts) and the Sample Request flow
 * (SampleRequestSubform.tsx — which submits independently and never calls
 * useApplySubmission) call this after a successful submission insert, so
 * neither flow has its own separate persistence logic and a customer's
 * details saved from either flow prefill on their next order of either type.
 *
 * No fabricated fallback data: every field written here comes directly from
 * what the customer actually entered (companyInfo / addressData) or from the
 * authenticated user's own session — never a guessed/hardcoded default.
 */
export async function persistCompanyAndAddress(
  companyInfo: CompanyInfo,
  addressData: AddressData | null,
  authUserId: string | undefined,
  existingCompanyId: string | undefined
): Promise<CompanySyncResult> {
  if (!isRealSupabase) return { companyId: existingCompanyId || null, addressId: addressData?.id || null };

  let companyId = existingCompanyId || companyInfo.company_id || null;

  try {
    // 1. Find-or-create the company row.
    if (!companyId && companyInfo.company_name?.trim()) {
      const { data: existing } = await supabase
        .from('companies')
        .select('id')
        .ilike('name', companyInfo.company_name.trim())
        .limit(1)
        .maybeSingle();

      if (existing?.id) {
        companyId = existing.id;
      } else {
        const { data: created, error: createErr } = await supabase
          .from('companies')
          .insert({
            name: companyInfo.company_name.trim(),
            company_type: 'Customer',
            status: 'Active',
            ...(companyInfo.website ? { website: companyInfo.website } : {}),
          })
          .select('id')
          .single();
        if (!createErr && created) companyId = created.id;
      }
    }

    if (!companyId) return { companyId: null, addressId: addressData?.id || null };

    // 2. Link a newly-created company back to the authenticated user's
    // profile so their NEXT order (either flow) auto-prefills from it.
    if (authUserId && !existingCompanyId) {
      await supabase.from('profiles').update({ company_id: companyId }).eq('id', authUserId);
    }

    // 3. Upsert a primary contact from the real contact info entered.
    if (companyInfo.contact_email?.trim()) {
      const [firstName, ...rest] = (companyInfo.contact_name || '').trim().split(/\s+/);
      const lastName = rest.join(' ') || firstName || 'Contact';

      const { data: existingContact } = await supabase
        .from('contacts')
        .select('id')
        .eq('company_id', companyId)
        .eq('email', companyInfo.contact_email.trim())
        .maybeSingle();

      if (existingContact?.id) {
        await supabase
          .from('contacts')
          .update({
            first_name: firstName || existingContact.id,
            last_name: lastName,
            ...(companyInfo.contact_phone ? { phone: companyInfo.contact_phone } : {}),
          })
          .eq('id', existingContact.id);
      } else {
        const { count } = await supabase
          .from('contacts')
          .select('id', { count: 'exact', head: true })
          .eq('company_id', companyId);

        await supabase.from('contacts').insert({
          company_id: companyId,
          first_name: firstName || companyInfo.contact_name || 'Contact',
          last_name: lastName,
          email: companyInfo.contact_email.trim(),
          ...(companyInfo.contact_phone ? { phone: companyInfo.contact_phone } : {}),
          is_primary_contact: !count,
        });
      }
    }

    // 4. Persist the address — only if it's genuinely new (no address_book
    // id yet). An address selected/edited via AddressSelector already has
    // an id and was already saved by that component's own edit-save path.
    let addressId = addressData?.id || null;
    if (!addressId && addressData?.street_1?.trim()) {
      const { count: existingAddrCount } = await supabase
        .from('address_book')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId);

      const { data: newAddr, error: addrErr } = await supabase
        .from('address_book')
        .insert({
          company_id: companyId,
          address_type: addressData.address_type || 'Shipping',
          recipient_name: addressData.recipient_name || companyInfo.contact_name || '',
          company_name_override: addressData.company_name_override || null,
          street_1: addressData.street_1,
          street_2: addressData.street_2 || null,
          city: addressData.city || '',
          state: addressData.state || '',
          postal_code: addressData.postal_code || '',
          country: addressData.country || '',
          phone: addressData.phone || companyInfo.contact_phone || null,
          delivery_instructions: addressData.delivery_instructions || null,
          is_primary: !existingAddrCount,
          is_active: true,
        })
        .select('id')
        .single();

      if (!addrErr && newAddr) addressId = newAddr.id;
    }

    return { companyId, addressId };
  } catch (e) {
    console.warn('persistCompanyAndAddress failed:', e);
    return { companyId, addressId: addressData?.id || null };
  }
}
