import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://myednlgltvpszzcjfrta.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15ZWRubGdsdHZwc3p6Y2pmcnRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxMDE0MjYsImV4cCI6MjA5OTY3NzQyNn0.VyUyVjXQ1WQpbjISoUsSi2byfeojjXpb50bxWPFQpsk";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const SEED_MAPPINGS = [
  {
    customer_name: "Weissmade",
    brand_name: "Weissmade",
    po_number: "PO-WM-2026-101",
    customer_sku: "WM-RAW-SLM-01",
    factory_code: "FF-DEN-SLIM-SLV",
    style_name: "Japanese Selvedge Slim Jean",
    colorway: "Indigo Rinse"
  },
  {
    customer_name: "Weissmade",
    brand_name: "Weissmade",
    po_number: "PO-WM-2026-102",
    customer_sku: "WM-JKT-TYP3",
    factory_code: "FF-JKT-TRK-HVY",
    style_name: "Heavyweight Type III Trucker",
    colorway: "Vintage Blue"
  },
  {
    customer_name: "Fear of God",
    brand_name: "Fear of God Essentials",
    po_number: "PO-FOG-2026-081",
    customer_sku: "FOG-ESS-DNM-26",
    factory_code: "FF-DEN-RLX-VNT",
    style_name: "Relaxed Vintage Wash Denim Jeans",
    colorway: "Vintage Blue"
  },
  {
    customer_name: "Fear of God",
    brand_name: "Fear of God Essentials",
    po_number: "PO-FOG-2026-082",
    customer_sku: "FOG-OVR-SHRT-02",
    factory_code: "FF-TOP-OVR-OZN",
    style_name: "Oversized Denim Overshirt",
    colorway: "Stone Wash"
  },
  {
    customer_name: "Servade",
    brand_name: "Servade",
    po_number: "PO-SRV-2026-501",
    customer_sku: "SRV-5PKT-STR",
    factory_code: "FF-DEN-STR-CLS",
    style_name: "5-Pocket Classic Straight Leg",
    colorway: "Mid Blue"
  },
  {
    customer_name: "Servade",
    brand_name: "Servade",
    po_number: "PO-SRV-2026-502",
    customer_sku: "SRV-CHN-ECRU",
    factory_code: "FF-BTM-CHN-TWL",
    style_name: "Garment Dyed Twill Chino",
    colorway: "Ecru"
  },
  {
    customer_name: "UmairCO",
    brand_name: "UmairCO",
    po_number: "PO-UM-2026-301",
    customer_sku: "UM-STR-BLK-01",
    factory_code: "FF-DEN-STR-PRF",
    style_name: "Performance Stretch Comfort Jean",
    colorway: "Jet Black"
  },
  {
    customer_name: "UmairCO",
    brand_name: "UmairCO",
    po_number: "PO-UM-2026-302",
    customer_sku: "UM-CRG-TAC-02",
    factory_code: "FF-BTM-CRG-OZN",
    style_name: "Tactical Denim Multi-Pocket Cargo",
    colorway: "Stone Wash"
  }
];

async function testSkuMappingsSync() {
  console.log("Testing SKU Mappings table sync...");
  const { data, error } = await supabase.from("sku_mappings").select("*");
  if (error) {
    console.error("Error reading sku_mappings:", error.message);
  } else {
    console.log(`Found ${data.length} existing SKU mappings in table.`);
    console.log(data);
  }
}

testSkuMappingsSync();
