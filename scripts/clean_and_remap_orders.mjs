import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://myednlgltvpszzcjfrta.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15ZWRubGdsdHZwc3p6Y2pmcnRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxMDE0MjYsImV4cCI6MjA5OTY3NzQyNn0.VyUyVjXQ1WQpbjISoUsSi2byfeojjXpb50bxWPFQpsk";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const UNPROFESSIONAL_NAMES = [
  "MEOW Meow",
  "Meow",
  "IWMSWSWS",
  "Test Brand",
  "AHMEDSOL",
  "AhmedSolutions",
  "Ahmed12",
  "ahmed",
  "ALnasser",
  "Neelam",
  "BillaAI",
  "BillaCompany",
  "BillaHouse",
  "HappyAI",
  "Panda",
  "TestingCompany",
  "TestingCO",
  "mycompany",
  "Bigcompany",
  "Smallcompany",
  "midcompany",
  "low company"
];

async function cleanAndRemapOrders() {
  console.log("Remapping and cleaning orders with unprofessional customer names...");

  // 1. Remap MEOW, IWMSWSWS, Test Brand to Weissmade & Fear of God & Servade
  for (const name of UNPROFESSIONAL_NAMES) {
    const { data: orders } = await supabase.from("orders").select("order_id").eq("customer_name", name);
    if (orders && orders.length > 0) {
      console.log(`Found ${orders.length} orders for '${name}' - remapping or deleting...`);
      for (const ord of orders) {
        // Remap to Weissmade or Fear of God or Servade
        const targetBrand = (ord.order_id.charCodeAt(ord.order_id.length - 1) % 2 === 0) ? "Fear of God" : "Weissmade";
        await supabase.from("orders").update({ customer_name: targetBrand }).eq("order_id", ord.order_id);
        console.log(`Remapped order ${ord.order_id} -> ${targetBrand}`);
      }
    }
  }

  // 2. Ensure Fear of God has active production orders
  const { data: fogOrders } = await supabase.from("orders").select("order_id").eq("customer_name", "Fear of God");
  if (!fogOrders || fogOrders.length === 0) {
    await supabase.from("orders").insert([
      {
        order_id: "FF-2026-FOG-01",
        customer_name: "Fear of God",
        po_number: "PO-FOG-2026-0081",
        tech_pack_ref: "TP-FOG-ESSENTIALS",
        size_breakdown: "28-38",
        status: "In Production",
        current_stage: 6,
        qty: 1500,
        notes: "Heavyweight Selvedge Denim Run for Fear of God Fall Collection",
        style_no: "FOG-DNM-01",
        style_description: "Relaxed Vintage Wash Denim Jeans",
        color: "Vintage Blue",
        material_status: "Approved"
      },
      {
        order_id: "FF-2026-FOG-02",
        customer_name: "Fear of God",
        po_number: "PO-FOG-2026-0082",
        tech_pack_ref: "TP-FOG-OVERSHIRT",
        size_breakdown: "S-XXL",
        status: "In Production",
        current_stage: 8,
        qty: 800,
        notes: "Denim Trucker Jacket Enzyme Stone Wash",
        style_no: "FOG-JKT-04",
        style_description: "Oversized Denim Trucker Jacket",
        color: "Stone Wash",
        material_status: "Approved"
      }
    ]);
    console.log("Inserted sample orders for Fear of God!");
  }

  // 3. Ensure Weissmade has active production orders
  const { data: weissOrders } = await supabase.from("orders").select("order_id").eq("customer_name", "Weissmade");
  if (!weissOrders || weissOrders.length < 2) {
    await supabase.from("orders").insert([
      {
        order_id: "FF-2026-WM-01",
        customer_name: "Weissmade",
        po_number: "PO-WM-2026-104",
        tech_pack_ref: "TP-WM-SLIM-01",
        size_breakdown: "30-40",
        status: "In Production",
        current_stage: 4,
        qty: 2400,
        notes: "Weissmade Signature Japanese Denim Fit",
        style_no: "WM-DNM-002",
        style_description: "Raw Indigo Selvedge Slim Jean",
        color: "Indigo Rinse",
        material_status: "Approved"
      }
    ]);
    console.log("Inserted sample order for Weissmade!");
  }

  // Final check of distinct names
  const { data: finalOrders } = await supabase.from("orders").select("customer_name");
  const finalMap = {};
  finalOrders?.forEach(o => {
    finalMap[o.customer_name] = (finalMap[o.customer_name] || 0) + 1;
  });

  console.log("\n=== FINAL PRISTINE BRANDS IN ORDERS TABLE ===");
  console.log(finalMap);
}

cleanAndRemapOrders();
