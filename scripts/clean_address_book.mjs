import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://myednlgltvpszzcjfrta.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15ZWRubGdsdHZwc3p6Y2pmcnRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxMDE0MjYsImV4cCI6MjA5OTY3NzQyNn0.VyUyVjXQ1WQpbjISoUsSi2byfeojjXpb50bxWPFQpsk";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function cleanAddressBook() {
  console.log("Cleaning and deduplicating address_book in Supabase...");

  const { data: allRows, error: fetchErr } = await supabase.from("address_book").select("*");
  if (fetchErr) {
    console.error("Fetch error:", fetchErr.message);
    return;
  }

  console.log(`Current total rows: ${allRows.length}`);

  // Track unique keys
  const seen = new Set();
  const idsToDelete = [];

  for (const row of allRows) {
    const label = (row.address_label || "").trim().toLowerCase();
    const full = (row.full_address || row.street_1 || "").trim().toLowerCase();
    const key = `${label}|${full}`;

    // Delete unassigned repeated HQ Receiving Dock rows
    if (label === "hq receiving dock" || row.customer_name === null || row.customer_name === "null") {
      idsToDelete.push(row.id);
      continue;
    }

    if (seen.has(key)) {
      idsToDelete.push(row.id);
    } else {
      seen.add(key);
    }
  }

  console.log(`Identified ${idsToDelete.length} duplicate/redundant rows to delete.`);

  for (const id of idsToDelete) {
    const { error: delErr } = await supabase.from("address_book").delete().eq("id", id);
    if (delErr) {
      console.warn(`Failed to delete id ${id}:`, delErr.message);
    }
  }

  // Ensure standard master addresses exist
  const standardAddresses = [
    {
      customer_name: "Servade",
      address_label: "Servade Logistics Distribution Center",
      street_1: "45 Distribution Way",
      address_line1: "45 Distribution Way",
      city: "Elizabeth",
      state: "NJ",
      postal_code: "07201",
      country: "United States",
      full_address: "45 Distribution Way, Elizabeth, NJ 07201",
      address_type: "Shipping"
    },
    {
      customer_name: "Levi Strauss & Co.",
      address_label: "Levi Strauss & Co. Main DC #42",
      street_1: "1150 Industry Way",
      address_line1: "1150 Industry Way",
      city: "Commerce",
      state: "CA",
      postal_code: "90040",
      country: "United States",
      full_address: "1150 Industry Way, Commerce, CA 90040",
      address_type: "Shipping"
    },
    {
      customer_name: "Nudie Jeans",
      address_label: "Nudie Jeans Nordic Logistics Hub",
      street_1: "Port of Goteborg Terminal 4",
      address_line1: "Port of Goteborg Terminal 4",
      city: "Goteborg",
      state: "Vastra Gotaland",
      postal_code: "411 03",
      country: "Sweden",
      full_address: "Port of Goteborg Terminal 4, 411 03 Goteborg, Sweden",
      address_type: "Shipping"
    },
    {
      customer_name: "Zara Denim",
      address_label: "Zara Denim Logistics Platform",
      street_1: "Poligono Industrial Sabon 12",
      address_line1: "Poligono Industrial Sabon 12",
      city: "Arteixo",
      state: "A Coruna",
      postal_code: "15142",
      country: "Spain",
      full_address: "Poligono Industrial Sabon 12, 15142 Arteixo, Spain",
      address_type: "Shipping"
    },
    {
      customer_name: "Uniqlo",
      address_label: "Uniqlo Americas Central Warehouse",
      street_1: "8500 Logistics Blvd",
      address_line1: "8500 Logistics Blvd",
      city: "Dallas",
      state: "TX",
      postal_code: "75261",
      country: "United States",
      full_address: "8500 Logistics Blvd, Dallas, TX 75261",
      address_type: "Shipping"
    },
    {
      customer_name: "Weissmade",
      address_label: "Weissmade Logistics & Distribution Center",
      street_1: "742 Evergreen Terrace",
      address_line1: "742 Evergreen Terrace",
      city: "San Francisco",
      state: "CA",
      postal_code: "94107",
      country: "United States",
      full_address: "742 Evergreen Terrace, San Francisco, CA 94107",
      address_type: "Shipping"
    },
    {
      customer_name: "Fear of God",
      address_label: "Fear of God Master Logistics Terminal",
      street_1: "900 N Michigan Ave",
      address_line1: "900 N Michigan Ave",
      city: "Chicago",
      state: "IL",
      postal_code: "60611",
      country: "United States",
      full_address: "900 N Michigan Ave, Suite 1400, Chicago, IL 60611",
      address_type: "Shipping"
    }
  ];

  for (const addr of standardAddresses) {
    const { data: exists } = await supabase
      .from("address_book")
      .select("id")
      .eq("customer_name", addr.customer_name);

    if (!exists || exists.length === 0) {
      await supabase.from("address_book").insert(addr);
      console.log(`Inserted master hub for: ${addr.customer_name}`);
    }
  }

  // Final verification
  const { data: finalRows } = await supabase.from("address_book").select("*");
  console.log(`\nAddress book cleanup complete! Clean total rows: ${finalRows?.length}`);
  finalRows?.forEach((r, i) => {
    console.log(`[${i + 1}] ${r.customer_name} -> ${r.address_label} (${r.full_address})`);
  });
}

cleanAddressBook();
