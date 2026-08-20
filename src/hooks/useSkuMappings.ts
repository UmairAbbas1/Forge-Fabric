import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase, isRealSupabase } from '../lib/supabase';
import { useAuth } from './useAuth';

export interface SkuMappingItem {
  id: string;
  customer_name: string;
  brand_name?: string;
  po_number: string;
  customer_sku: string;
  factory_code: string;
  style_name?: string;
  colorway?: string;
  notes?: string;
  created_at?: string;
}

export interface CustomerPoOption {
  po_number: string;
  style_no?: string;
  style_description?: string;
  color?: string;
  qty?: number;
}

const LOCAL_STORAGE_KEY = 'ff_sku_mappings_store_v1';

export const MASTER_INITIAL_SKU_MAPPINGS: SkuMappingItem[] = [
  // WiesMade Mappings
  {
    id: "sku-wm-01",
    customer_name: "WiesMade",
    brand_name: "WiesMade",
    po_number: "PO-WM-2026-101",
    customer_sku: "WM-RAW-SLM-01",
    factory_code: "FF-DEN-SLIM-SLV",
    style_name: "Japanese Selvedge Slim Jean",
    colorway: "Indigo Rinse",
    notes: "Primary core run for 13.5oz cone selvedge",
    created_at: new Date(Date.now() - 14 * 86400000).toISOString()
  },
  {
    id: "sku-wm-02",
    customer_name: "WiesMade",
    brand_name: "WiesMade",
    po_number: "PO-WM-2026-102",
    customer_sku: "WM-JKT-TYP3",
    factory_code: "FF-JKT-TRK-HVY",
    style_name: "Heavyweight Type III Trucker",
    colorway: "Vintage Blue",
    notes: "14oz rigid denim trucker jacket",
    created_at: new Date(Date.now() - 25 * 86400000).toISOString()
  },

  // Fear of God Mappings
  {
    id: "sku-fog-01",
    customer_name: "Fear of God",
    brand_name: "Fear of God Essentials",
    po_number: "PO-FOG-2026-081",
    customer_sku: "FOG-ESS-DNM-26",
    factory_code: "FF-DEN-RLX-VNT",
    style_name: "Relaxed Vintage Wash Denim Jeans",
    colorway: "Vintage Blue",
    notes: "Enzyme stone washed with custom hardware",
    created_at: new Date(Date.now() - 10 * 86400000).toISOString()
  },
  {
    id: "sku-fog-02",
    customer_name: "Fear of God",
    brand_name: "Fear of God Essentials",
    po_number: "PO-FOG-2026-082",
    customer_sku: "FOG-OVR-SHRT-02",
    factory_code: "FF-TOP-OVR-OZN",
    style_name: "Oversized Denim Overshirt",
    colorway: "Stone Wash",
    notes: "Laser whiskers and ozone dry finishing",
    created_at: new Date(Date.now() - 30 * 86400000).toISOString()
  },

  // Servade Mappings
  {
    id: "sku-srv-01",
    customer_name: "Servade",
    brand_name: "Servade",
    po_number: "PO-SRV-2026-501",
    customer_sku: "SRV-5PKT-STR",
    factory_code: "FF-DEN-STR-CLS",
    style_name: "5-Pocket Classic Straight Leg",
    colorway: "Mid Blue",
    notes: "Turkish ring-spun 12oz denim",
    created_at: new Date(Date.now() - 18 * 86400000).toISOString()
  },
  {
    id: "sku-srv-02",
    customer_name: "Servade",
    brand_name: "Servade",
    po_number: "PO-SRV-2026-502",
    customer_sku: "SRV-CHN-ECRU",
    factory_code: "FF-BTM-CHN-TWL",
    style_name: "Garment Dyed Twill Chino",
    colorway: "Ecru",
    notes: "Enzyme softener wash with felled seams",
    created_at: new Date(Date.now() - 40 * 86400000).toISOString()
  },

  // UmairCO Mappings
  {
    id: "sku-um-01",
    customer_name: "UmairCO",
    brand_name: "UmairCO",
    po_number: "PO-UM-2026-301",
    customer_sku: "UM-STR-BLK-01",
    factory_code: "FF-DEN-STR-PRF",
    style_name: "Performance Stretch Comfort Jean",
    colorway: "Jet Black",
    notes: "DualFX Lycra high-recovery denim",
    created_at: new Date(Date.now() - 8 * 86400000).toISOString()
  },
  {
    id: "sku-um-02",
    customer_name: "UmairCO",
    brand_name: "UmairCO",
    po_number: "PO-UM-2026-302",
    customer_sku: "UM-CRG-TAC-02",
    factory_code: "FF-BTM-CRG-OZN",
    style_name: "Tactical Denim Multi-Pocket Cargo",
    colorway: "Stone Wash",
    notes: "Heavy enzyme stone wash with reinforced knees",
    created_at: new Date(Date.now() - 22 * 86400000).toISOString()
  }
];

export function useSkuMappings() {
  const { user } = useAuth();
  const isCustomer = user?.role === 'customer';

  const [allMappings, setAllMappings] = useState<SkuMappingItem[]>(() => {
    try {
      const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (cached) return JSON.parse(cached);
    } catch (e) {
      console.warn("Could not read sku mappings cache:", e);
    }
    return MASTER_INITIAL_SKU_MAPPINGS;
  });

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Available customer list & their POs map
  const [customerOptions, setCustomerOptions] = useState<string[]>([
    "WiesMade",
    "Fear of God",
    "Servade",
    "UmairCO"
  ]);

  const [customerPosMap, setCustomerPosMap] = useState<Record<string, CustomerPoOption[]>>({
    WiesMade: [
      { po_number: "PO-WM-2026-101", style_no: "WM-SELVEDGE-01", style_description: "Raw Indigo Selvedge Slim Jean", color: "Indigo Rinse", qty: 2400 },
      { po_number: "PO-WM-2026-102", style_no: "WM-JKT-03", style_description: "Heavyweight Type III Trucker Jacket", color: "Vintage Blue", qty: 1200 }
    ],
    "Fear of God": [
      { po_number: "PO-FOG-2026-081", style_no: "FOG-ESS-DNM", style_description: "Relaxed Vintage Wash Denim Jeans", color: "Vintage Blue", qty: 1800 },
      { po_number: "PO-FOG-2026-082", style_no: "FOG-ESS-JKT", style_description: "Oversized Denim Overshirt", color: "Stone Wash", qty: 950 }
    ],
    Servade: [
      { po_number: "PO-SRV-2026-501", style_no: "SRV-INDIGO-01", style_description: "5-Pocket Classic Straight Leg Jean", color: "Mid Blue", qty: 3000 },
      { po_number: "PO-SRV-2026-502", style_no: "SRV-CHINO-02", style_description: "Garment Dyed Twill Chino Pant", color: "Ecru", qty: 1500 }
    ],
    UmairCO: [
      { po_number: "PO-UM-2026-301", style_no: "UM-STRETCH-01", style_description: "Performance Stretch Comfort Denim Jean", color: "Jet Black", qty: 2000 },
      { po_number: "PO-UM-2026-302", style_no: "UM-CARGO-02", style_description: "Tactical Denim Multi-Pocket Cargo", color: "Stone Wash", qty: 1000 }
    ]
  });

  // Save to localStorage
  const persistMappings = useCallback((items: SkuMappingItem[]) => {
    setAllMappings(items);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
      console.warn("Could not save to localStorage:", e);
    }
  }, []);

  // Fetch Live Mappings & Customer Orders
  const refreshData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      let loadedMappings: SkuMappingItem[] = [];

      if (isRealSupabase) {
        // 1. Fetch Orders from Supabase
        const { data: ordersData } = await supabase
          .from('orders')
          .select('order_id, customer_name, po_number, style_no, style_description, color, qty');

        if (ordersData && ordersData.length > 0) {
          const map: Record<string, CustomerPoOption[]> = {};
          const brandsSet = new Set<string>();

          ordersData.forEach((o: any) => {
            if (o.customer_name) {
              brandsSet.add(o.customer_name);
              if (!map[o.customer_name]) {
                map[o.customer_name] = [];
              }
              if (o.po_number && !map[o.customer_name].some(p => p.po_number === o.po_number)) {
                map[o.customer_name].push({
                  po_number: o.po_number,
                  style_no: o.style_no,
                  style_description: o.style_description,
                  color: o.color,
                  qty: o.qty
                });
              }
            }
          });

          if (brandsSet.size > 0) {
            setCustomerOptions(Array.from(brandsSet).sort());
            setCustomerPosMap(prev => ({ ...prev, ...map }));
          }
        }

        // 2. Fetch SKU Mappings from Supabase table
        const { data: skuData, error: skuError } = await supabase
          .from('sku_mappings')
          .select('*')
          .order('created_at', { ascending: false });

        if (!skuError && skuData && skuData.length > 0) {
          loadedMappings = skuData.map((row: any) => ({
            id: row.id,
            customer_name: row.customer_name || row.brand_name || 'Customer Brand',
            brand_name: row.brand_name || row.customer_name,
            po_number: row.po_number || 'PO-GENERAL',
            customer_sku: row.customer_sku,
            factory_code: row.factory_code,
            style_name: row.style_name,
            colorway: row.colorway,
            notes: row.notes,
            created_at: row.created_at
          }));
        }

        // 3. Dynamic Real-Time Auto-Synthesis from live orders
        if (ordersData && ordersData.length > 0) {
          ordersData.forEach((ord: any) => {
            const hasMapping = loadedMappings.some(
              m => m.po_number === ord.po_number && m.customer_name?.toLowerCase() === ord.customer_name?.toLowerCase()
            );
            if (!hasMapping && ord.customer_name && ord.po_number) {
              const custPrefix = ord.customer_name.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 3);
              const custSku = ord.style_no || `SKU-${ord.po_number.replace(/[^a-zA-Z0-9]/g, '').slice(-4)}`;
              const styleTag = custSku.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6);
              loadedMappings.push({
                id: `ord-sku-${ord.po_number}-${ord.order_id || Math.random().toString(36).substr(2, 4)}`,
                customer_name: ord.customer_name,
                brand_name: ord.customer_name,
                po_number: ord.po_number,
                customer_sku: custSku,
                factory_code: `FF-${custPrefix}-${styleTag}`,
                style_name: ord.style_description || ord.style_no || "Live Production Garment",
                colorway: ord.color || "Standard Finish",
                notes: `Auto-linked to live order ${ord.order_id || ord.po_number}`,
                created_at: new Date().toISOString()
              });
            }
          });
        }
      }

      if (loadedMappings.length === 0) {
        loadedMappings = MASTER_INITIAL_SKU_MAPPINGS;
      }

      persistMappings(loadedMappings);
    } catch (err: any) {
      console.warn("Falling back to cached SKU mappings:", err);
    } finally {
      setIsLoading(false);
    }
  }, [persistMappings]);

  // Initial Load
  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Realtime Supabase Channel Subscription
  useEffect(() => {
    if (!isRealSupabase) return;

    const channel = supabase
      .channel('realtime_sku_and_orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sku_mappings' }, () => {
        refreshData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        refreshData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refreshData]);

  // Create New SKU Mapping
  const createSkuMapping = async (input: {
    customer_name: string;
    brand_name?: string;
    po_number: string;
    customer_sku: string;
    factory_code: string;
    style_name?: string;
    colorway?: string;
    notes?: string;
  }) => {
    const newItem: SkuMappingItem = {
      id: `sku-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      customer_name: input.customer_name.trim(),
      brand_name: input.brand_name?.trim() || input.customer_name.trim(),
      po_number: input.po_number.trim(),
      customer_sku: input.customer_sku.trim().toUpperCase(),
      factory_code: input.factory_code.trim().toUpperCase(),
      style_name: input.style_name?.trim(),
      colorway: input.colorway?.trim(),
      notes: input.notes?.trim(),
      created_at: new Date().toISOString()
    };

    // Update local state immediately
    const updated = [newItem, ...allMappings];
    persistMappings(updated);

    // Sync to Supabase
    if (isRealSupabase) {
      try {
        await supabase.from('sku_mappings').insert({
          id: newItem.id.startsWith('sku-') ? undefined : newItem.id,
          customer_name: newItem.customer_name,
          brand_name: newItem.brand_name,
          po_number: newItem.po_number,
          customer_sku: newItem.customer_sku,
          factory_code: newItem.factory_code,
          style_name: newItem.style_name,
          colorway: newItem.colorway,
          notes: newItem.notes
        });
      } catch (err) {
        console.warn("Supabase insert synced locally:", err);
      }
    }

    return newItem;
  };

  // Delete SKU Mapping
  const deleteSkuMapping = async (id: string) => {
    const updated = allMappings.filter(m => m.id !== id);
    persistMappings(updated);

    if (isRealSupabase) {
      try {
        await supabase.from('sku_mappings').delete().eq('id', id);
      } catch (err) {
        console.warn("Could not delete from Supabase table:", err);
      }
    }
  };

  // MULTI-TENANT ISOLATION:
  // If user is a customer, only show their brand's SKU mappings
  const visibleMappings = useMemo(() => {
    if (!user) return allMappings;
    if (user.role === 'customer') {
      const userBrand = (user.customer_name || user.full_name || user.email?.split('@')[0] || '').toLowerCase();
      return allMappings.filter(m => {
        const cust = m.customer_name.toLowerCase();
        const brand = (m.brand_name || '').toLowerCase();
        return cust.includes(userBrand) || userBrand.includes(cust) || brand.includes(userBrand) || userBrand.includes(brand);
      });
    }
    return allMappings;
  }, [allMappings, user]);

  return {
    mappings: visibleMappings,
    allMappings,
    isLoading,
    error,
    customerOptions,
    customerPosMap,
    createSkuMapping,
    deleteSkuMapping,
    refreshData
  };
}
