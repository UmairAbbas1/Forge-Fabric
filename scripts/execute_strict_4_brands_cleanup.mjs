import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://myednlgltvpszzcjfrta.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15ZWRubGdsdHZwc3p6Y2pmcnRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxMDE0MjYsImV4cCI6MjA5OTY3NzQyNn0.VyUyVjXQ1WQpbjISoUsSi2byfeojjXpb50bxWPFQpsk";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const ALLOWED_BRAND_NAMES = ["Weissmade", "Fear of God", "Servade", "UmairCO", "UmairAI", "Umair"];
const ALLOWED_CUSTOMER_EMAILS = [
  "weissmade@forgefabric.com",
  "fearofgod@forgefabric.com",
  "ahmad234@gmail.com",
  "umair.abbas@cybersoftna.com"
];

function dateDaysAgo(d) {
  const dt = new Date();
  dt.setDate(dt.getDate() - d);
  return dt.toISOString().slice(0, 10);
}

async function cleanupToStrictFourBrands() {
  console.log("==================================================================");
  console.log("ENFORCING STRICT 4-BRAND RULE ACROSS FORGE & FABRIC INDUSTRIES MES");
  console.log("Brands: Weissmade, Fear of God, Servade, UmairCO");
  console.log("==================================================================");

  // 1. PURGE ALL ORDERS NOT IN THE 4 BRANDS
  const { data: allOrders } = await supabase.from("orders").select("order_id, customer_name");
  if (allOrders) {
    for (const o of allOrders) {
      if (!ALLOWED_BRAND_NAMES.includes(o.customer_name)) {
        await supabase.from("orders").delete().eq("order_id", o.order_id);
      }
    }
  }

  // Clear existing orders for the 4 brands to re-seed exactly 2 pristine realistic orders each
  for (const brand of ALLOWED_BRAND_NAMES) {
    await supabase.from("orders").delete().eq("customer_name", brand);
  }

  // 2. SEED EXACTLY 2 REALISTIC HIGH-GRADE ORDERS PER BRAND
  const PRISTINE_ORDERS = [
    // --- WEISSMADE ---
    {
      order_id: "FF-2026-WM-01",
      customer_name: "Weissmade",
      po_number: "PO-WM-2026-101",
      tech_pack_ref: "TP-WM-SELVEDGE-01",
      size_breakdown: "28-38",
      status: "In Production",
      created_date: dateDaysAgo(14),
      current_stage: 4,
      qty: 2400,
      notes: "Japanese 13.5oz Raw Indigo Selvedge Slim Denim Jeans",
      style_no: "WM-SELVEDGE-01",
      style_description: "Raw Indigo Selvedge Slim Jean",
      color: "Indigo Rinse",
      material_status: "Approved",
      delivered_qty: 0,
      open_balance: 2400,
      delivery_status: "In Production"
    },
    {
      order_id: "FF-2026-WM-02",
      customer_name: "Weissmade",
      po_number: "PO-WM-2026-102",
      tech_pack_ref: "TP-WM-JKT-03",
      size_breakdown: "S-XXL",
      status: "In Production",
      created_date: dateDaysAgo(25),
      current_stage: 8,
      qty: 1200,
      notes: "Heavyweight 14oz Denim Type III Trucker Jacket",
      style_no: "WM-JKT-03",
      style_description: "Heavyweight Type III Trucker Jacket",
      color: "Vintage Blue",
      material_status: "Approved",
      delivered_qty: 0,
      open_balance: 1200,
      delivery_status: "In Production"
    },

    // --- FEAR OF GOD ---
    {
      order_id: "FF-2026-FOG-01",
      customer_name: "Fear of God",
      po_number: "PO-FOG-2026-081",
      tech_pack_ref: "TP-FOG-ESS-DNM",
      size_breakdown: "28-38",
      status: "In Production",
      created_date: dateDaysAgo(10),
      current_stage: 6,
      qty: 1800,
      notes: "Relaxed Vintage Wash Denim Jeans with Custom Riri Hardware",
      style_no: "FOG-ESS-DNM",
      style_description: "Relaxed Vintage Wash Denim Jeans",
      color: "Vintage Blue",
      material_status: "Approved",
      delivered_qty: 0,
      open_balance: 1800,
      delivery_status: "In Production"
    },
    {
      order_id: "FF-2026-FOG-02",
      customer_name: "Fear of God",
      po_number: "PO-FOG-2026-082",
      tech_pack_ref: "TP-FOG-ESS-JKT",
      size_breakdown: "S-XXL",
      status: "In Production",
      created_date: dateDaysAgo(30),
      current_stage: 10,
      qty: 950,
      notes: "Oversized Denim Overshirt with Laser Whiskers & Ozone Wash",
      style_no: "FOG-ESS-JKT",
      style_description: "Oversized Denim Overshirt",
      color: "Stone Wash",
      material_status: "Approved",
      delivered_qty: 0,
      open_balance: 950,
      delivery_status: "In Production"
    },

    // --- SERVADE ---
    {
      order_id: "FF-2026-SRV-01",
      customer_name: "Servade",
      po_number: "PO-SRV-2026-501",
      tech_pack_ref: "TP-SRV-INDIGO-01",
      size_breakdown: "30-40",
      status: "In Production",
      created_date: dateDaysAgo(18),
      current_stage: 7,
      qty: 3000,
      notes: "5-Pocket Classic Straight Leg Denim in 12oz Turkish Ring-Spun",
      style_no: "SRV-INDIGO-01",
      style_description: "5-Pocket Classic Straight Leg Jean",
      color: "Mid Blue",
      material_status: "Approved",
      delivered_qty: 0,
      open_balance: 3000,
      delivery_status: "In Production"
    },
    {
      order_id: "FF-2026-SRV-02",
      customer_name: "Servade",
      po_number: "PO-SRV-2026-502",
      tech_pack_ref: "TP-SRV-CHINO-02",
      size_breakdown: "30-40",
      status: "In Production",
      created_date: dateDaysAgo(40),
      current_stage: 12,
      qty: 1500,
      notes: "Garment Dyed Cotton Twill Chino Pant with Enzyme Softener",
      style_no: "SRV-CHINO-02",
      style_description: "Garment Dyed Twill Chino Pant",
      color: "Ecru",
      material_status: "Approved",
      delivered_qty: 0,
      open_balance: 1500,
      delivery_status: "Ready to Ship"
    },

    // --- UMAIRCO ---
    {
      order_id: "FF-2026-UM-01",
      customer_name: "UmairCO",
      po_number: "PO-UM-2026-301",
      tech_pack_ref: "TP-UM-STRETCH-01",
      size_breakdown: "28-38",
      status: "In Production",
      created_date: dateDaysAgo(8),
      current_stage: 5,
      qty: 2000,
      notes: "Performance Stretch Comfort Denim Jean with Lycra DualFX",
      style_no: "UM-STRETCH-01",
      style_description: "Performance Stretch Comfort Denim Jean",
      color: "Jet Black",
      material_status: "Approved",
      delivered_qty: 0,
      open_balance: 2000,
      delivery_status: "In Production"
    },
    {
      order_id: "FF-2026-UM-02",
      customer_name: "UmairCO",
      po_number: "PO-UM-2026-302",
      tech_pack_ref: "TP-UM-CARGO-02",
      size_breakdown: "S-XXL",
      status: "In Production",
      created_date: dateDaysAgo(22),
      current_stage: 9,
      qty: 1000,
      notes: "Tactical Denim Multi-Pocket Cargo Pant with Enzyme Stone Wash",
      style_no: "UM-CARGO-02",
      style_description: "Tactical Denim Multi-Pocket Cargo",
      color: "Stone Wash",
      material_status: "Approved",
      delivered_qty: 0,
      open_balance: 1000,
      delivery_status: "In Production"
    }
  ];

  const { error: insErr } = await supabase.from("orders").insert(PRISTINE_ORDERS);
  if (insErr) {
    console.error("Error inserting pristine orders:", insErr.message);
  } else {
    console.log("✅ Successfully seeded exactly 2 pristine orders for Weissmade, Fear of God, Servade, and UmairCO!");
  }

  // 3. PURGE ALL APPLY SUBMISSIONS EXCEPT THE 4 BRANDS
  const { data: allSubs } = await supabase.from("apply_submissions").select("id, company_name, contact_email, apply_reference_code");
  if (allSubs) {
    for (const sub of allSubs) {
      const isAllowedCompany = ALLOWED_BRAND_NAMES.some(b => sub.company_name?.toLowerCase().includes(b.toLowerCase()));
      const isAllowedEmail = ALLOWED_CUSTOMER_EMAILS.some(e => sub.contact_email?.toLowerCase() === e.toLowerCase());

      if (!isAllowedCompany && !isAllowedEmail) {
        console.log(`Deleting unrelated submission ${sub.apply_reference_code} (${sub.company_name})...`);
        await supabase.from("apply_activity_logs").delete().eq("submission_id", sub.id);
        await supabase.from("apply_documents").delete().eq("submission_id", sub.id);
        await supabase.from("apply_materials").delete().eq("submission_id", sub.id);
        await supabase.from("apply_measurements").delete().eq("submission_id", sub.id);
        await supabase.from("apply_line_items").delete().eq("submission_id", sub.id);
        await supabase.from("apply_submissions").delete().eq("id", sub.id);
      }
    }
  }

  // Ensure 1 clean converted submission exists for Fear of God & UmairCO if missing
  const { data: checkFogSub } = await supabase.from("apply_submissions").select("id").eq("company_name", "Fear of God");
  if (!checkFogSub || checkFogSub.length === 0) {
    await supabase.from("apply_submissions").insert({
      id: "a3b07384-d113-4f9e-bc43-261622384a99",
      apply_reference_code: "APP-2026-FOG-01",
      company_name: "Fear of God",
      brand_name: "Fear of God Essentials",
      contact_name: "Fear of God Brand Representative",
      contact_email: "fearofgod@forgefabric.com",
      status: "converted",
      submission_type: "new_order",
      product_type: "Denim Trucker & Jeans",
      source: "apply_portal",
      estimated_quantity: 2750,
      notes: "Custom Japanese Selvedge Run with Vintage Enzyme Wash"
    });
  }

  // 4. PURGE UNRELATED CUSTOMER PROFILES
  const { data: allProfs } = await supabase.from("profiles").select("id, email, role, customer_name");
  if (allProfs) {
    for (const p of allProfs) {
      if (p.role === "customer") {
        const isAllowed = ALLOWED_CUSTOMER_EMAILS.includes(p.email?.toLowerCase()) || 
                          ALLOWED_BRAND_NAMES.includes(p.customer_name);
        if (!isAllowed) {
          console.log(`Deleting extra customer profile ${p.email} (${p.customer_name})...`);
          await supabase.from("profiles").delete().eq("id", p.id);
        }
      }
    }
  }

  // Verify final counts
  const { data: finalOrders } = await supabase.from("orders").select("order_id, customer_name, status, qty");
  const { data: finalSubs } = await supabase.from("apply_submissions").select("apply_reference_code, company_name, contact_email, status");
  const { data: finalProfs } = await supabase.from("profiles").select("email, role, customer_name");

  console.log("\n==================================================================");
  console.log("FINAL PRISTINE DATABASE AUDIT");
  console.log("==================================================================");
  console.log("📦 ORDERS (Total:", finalOrders?.length, "):");
  console.log(finalOrders);
  console.log("\n📑 SUBMISSIONS (Total:", finalSubs?.length, "):");
  console.log(finalSubs);
  console.log("\n👥 PROFILES (Total:", finalProfs?.length, "):");
  console.log(finalProfs);
}

cleanupToStrictFourBrands();
