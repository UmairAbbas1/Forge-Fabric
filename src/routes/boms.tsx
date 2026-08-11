import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { AppShell } from '../components/AppShell';
import { supabase, isRealSupabase } from '../lib/supabase';
import { usePermission } from '../hooks/usePermission';
import { 
  FileSpreadsheet, Plus, Trash2, Save, CheckCircle2, AlertTriangle, 
  Layers, DollarSign, Calculator, ChevronRight, Scissors, ArrowRight, X 
} from 'lucide-react';

export const Route = createFileRoute('/boms')({
  head: () => ({
    meta: [
      { title: 'Bill of Materials (BOM) Recipes · Forge & Fabric PLM' },
      { name: 'description', content: 'Manage style BOM recipes, fabric consumption, trim allowances, and costing.' },
    ],
  }),
  component: BomsMasterPage,
});

interface BomItem {
  id: string;
  style_id: string;
  style_code?: string;
  style_name?: string;
  colorway: string;
  item_id: string;
  item_name?: string;
  category?: string;
  consumption_qty: number;
  unit_of_measure: string;
  waste_allowance_pct: number;
  unit_cost_est?: number;
}

interface StyleOption {
  id: string;
  style_code: string;
  style_name: string;
}

interface InventoryItemOption {
  id: string;
  item_code: string;
  item_name: string;
  category: string;
  unit_of_measure: string;
  unit_cost?: number;
}

function BomsMasterPage() {
  const canManage = usePermission('product_master', 'update');
  const [boms, setBoms] = useState<BomItem[]>([]);
  const [styles, setStyles] = useState<StyleOption[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItemOption[]>([]);
  const [selectedStyleId, setSelectedStyleId] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Add Item State
  const [showAddModal, setShowAddModal] = useState(false);
  const [addStyleId, setAddStyleId] = useState('');
  const [addColorway, setAddColorway] = useState('ALL');
  const [addItemId, setAddItemId] = useState('');
  const [addConsumption, setAddConsumption] = useState(1.45);
  const [addUom, setAddUom] = useState('Yards');
  const [addWastePct, setAddWastePct] = useState(5.0);
  const [formError, setFormError] = useState('');

  const loadData = async () => {
    setIsLoading(true);
    try {
      if (isRealSupabase) {
        // Fetch BOMs with joined style and inventory item details
        const { data: bomData, error: bomErr } = await supabase
          .from('boms')
          .select(`
            *,
            styles(id, style_code, style_name),
            inventory_items(id, item_code, item_name, category, unit_of_measure)
          `)
          .order('created_at', { ascending: false });

        if (!bomErr && bomData) {
          const mapped = bomData.map((b: any) => ({
            id: b.id,
            style_id: b.style_id,
            style_code: b.styles?.style_code,
            style_name: b.styles?.style_name,
            colorway: b.colorway || 'ALL',
            item_id: b.item_id,
            item_name: b.inventory_items?.item_name || 'Raw Material',
            category: b.inventory_items?.category || 'Fabric',
            consumption_qty: Number(b.consumption_qty),
            unit_of_measure: b.unit_of_measure || b.inventory_items?.unit_of_measure || 'Yards',
            waste_allowance_pct: Number(b.waste_allowance_pct || 0),
            unit_cost_est: b.category === 'Fabric' ? 4.50 : 0.25, // Costing estimation stub
          }));
          setBoms(mapped);
        }

        // Fetch styles & inventory items for dropdowns
        const { data: stData } = await supabase.from('styles').select('id, style_code, style_name').order('style_code');
        if (stData) setStyles(stData);

        const { data: itemData } = await supabase.from('inventory_items').select('id, item_code, item_name, category, unit_of_measure').order('item_name');
        if (itemData) setInventoryItems(itemData as any);
      } else {
        // Mock fallback
        setStyles([
          { id: 'st-1', style_code: '501-RAW-SEL', style_name: 'Vintage 5-Pocket Selvedge Jeans' },
          { id: 'st-2', style_code: 'TSHIRT-KNIT-BASIC', style_name: 'Heavyweight Heavy Cotton Tee' },
        ]);
        setInventoryItems([
          { id: 'item-1', item_code: 'FAB-SEL-14OZ', item_name: '14oz Raw Selvedge Indigo Denim', category: 'Fabric', unit_of_measure: 'Yards', unit_cost: 6.80 },
          { id: 'item-2', item_code: 'TRM-ZIP-YKK5', item_name: '#5 YKK Brass Zipper 7 inch', category: 'Trim', unit_of_measure: 'Pieces', unit_cost: 0.45 },
          { id: 'item-3', item_code: 'TRM-BTN-COPPER', item_name: 'Copper Rivet & Button Set', category: 'Trim', unit_of_measure: 'Sets', unit_cost: 0.30 },
        ]);
        setBoms([
          { id: 'bom-1', style_id: 'st-1', style_code: '501-RAW-SEL', style_name: 'Vintage 5-Pocket', colorway: 'ALL', item_id: 'item-1', item_name: '14oz Raw Selvedge Indigo Denim', category: 'Fabric', consumption_qty: 1.45, unit_of_measure: 'Yards', waste_allowance_pct: 5.0, unit_cost_est: 6.80 },
          { id: 'bom-2', style_id: 'st-1', style_code: '501-RAW-SEL', style_name: 'Vintage 5-Pocket', colorway: 'ALL', item_id: 'item-2', item_name: '#5 YKK Brass Zipper 7 inch', category: 'Trim', consumption_qty: 1.0, unit_of_measure: 'Pieces', waste_allowance_pct: 2.0, unit_cost_est: 0.45 },
        ]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered BOM entries by selected style
  const filteredBoms = boms.filter((b) => selectedStyleId === 'all' || b.style_id === selectedStyleId);

  // Grouped cost calculation per style
  const styleCostEstimates = styles.map((st) => {
    const stBoms = boms.filter((b) => b.style_id === st.id);
    const totalCost = stBoms.reduce((sum, b) => {
      const grossQty = b.consumption_qty * (1 + b.waste_allowance_pct / 100);
      const estUnitCost = b.unit_cost_est || (b.category === 'Fabric' ? 5.50 : 0.35);
      return sum + (grossQty * estUnitCost);
    }, 0);

    return {
      style_id: st.id,
      style_code: st.style_code,
      style_name: st.style_name,
      boms_count: stBoms.length,
      estimated_cost_per_garment: totalCost,
    };
  });

  const handleAddBomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!addStyleId) {
      setFormError('Please select a target Style.');
      return;
    }
    if (!addItemId) {
      setFormError('Please select an Inventory Material Item.');
      return;
    }
    if (addConsumption <= 0) {
      setFormError('Consumption quantity must be greater than zero.');
      return;
    }

    try {
      if (isRealSupabase) {
        const { error } = await supabase.from('boms').insert({
          style_id: addStyleId,
          colorway: addColorway.trim() || 'ALL',
          item_id: addItemId,
          consumption_qty: addConsumption,
          unit_of_measure: addUom,
          waste_allowance_pct: addWastePct,
        });
        if (error) throw error;
      }

      setStatusMsg({ type: 'success', text: 'BOM recipe material item added successfully!' });
      setShowAddModal(false);
      loadData();
    } catch (err: any) {
      setFormError(err.message || 'Failed to add BOM item.');
    }
  };

  const handleDeleteBom = async (bomId: string) => {
    if (!window.confirm('Are you sure you want to remove this material from the BOM recipe?')) return;

    try {
      if (isRealSupabase) {
        const { error } = await supabase.from('boms').delete().eq('id', bomId);
        if (error) throw error;
      }
      setBoms(prev => prev.filter(b => b.id !== bomId));
      setStatusMsg({ type: 'success', text: 'BOM line item removed.' });
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to delete BOM line item.' });
    }
  };

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-foreground flex items-center gap-3">
              <FileSpreadsheet className="h-7 w-7 text-primary" /> Bill of Materials (BOM) Recipes
            </h1>
            <p className="text-xs md:text-sm text-muted-foreground mt-1">
              Define material consumption rates, waste allowances, and garment unit cost estimations.
            </p>
          </div>

          {canManage && (
            <button
              onClick={() => {
                if (styles.length > 0 && !addStyleId) setAddStyleId(styles[0].id);
                if (inventoryItems.length > 0 && !addItemId) setAddItemId(inventoryItems[0].id);
                setShowAddModal(true);
              }}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-sm transition-all"
            >
              <Plus className="h-4 w-4" /> Add BOM Material Line
            </button>
          )}
        </div>

        {/* Status Notification */}
        {statusMsg && (
          <div className={`p-4 rounded-xl text-xs font-bold flex items-center justify-between border ${
            statusMsg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-800 border-red-200'
          }`}>
            <div className="flex items-center gap-2">
              {statusMsg.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
              <span>{statusMsg.text}</span>
            </div>
            <button onClick={() => setStatusMsg(null)}><X className="h-4 w-4" /></button>
          </div>
        )}

        {/* Costing Estimations Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {styleCostEstimates.map((sc) => (
            <div key={sc.style_id} className="bg-card border-2 border-border p-4 rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono font-extrabold text-xs text-primary">{sc.style_code}</span>
                <span className="text-[10px] font-bold bg-muted px-2 py-0.5 rounded-md">
                  {sc.boms_count} Material Lines
                </span>
              </div>
              <div className="text-sm font-bold text-foreground truncate">{sc.style_name}</div>
              <div className="pt-2 border-t flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground font-semibold flex items-center gap-1">
                  <Calculator className="h-3.5 w-3.5" /> Estimated Unit Material Cost:
                </span>
                <span className="font-mono font-black text-sm text-emerald-600">
                  ${sc.estimated_cost_per_garment.toFixed(2)} / pc
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Filter Bar */}
        <div className="bg-muted/30 p-3 rounded-2xl border flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
              Filter by Style:
            </label>
            <select
              value={selectedStyleId}
              onChange={(e) => setSelectedStyleId(e.target.value)}
              className="bg-background border rounded-xl px-3 py-1.5 text-xs font-bold text-foreground"
            >
              <option value="all">All Styles ({boms.length} BOM lines)</option>
              {styles.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.style_code} — {st.style_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* BOM Items Table */}
        <div className="bg-card border rounded-2xl overflow-hidden shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/40 border-b">
              <tr>
                <th className="px-5 py-3 font-bold text-muted-foreground uppercase text-xs">Style Code</th>
                <th className="px-5 py-3 font-bold text-muted-foreground uppercase text-xs">Colorway Override</th>
                <th className="px-5 py-3 font-bold text-muted-foreground uppercase text-xs">Raw Material Item</th>
                <th className="px-5 py-3 font-bold text-muted-foreground uppercase text-xs text-right">Net Consumption</th>
                <th className="px-5 py-3 font-bold text-muted-foreground uppercase text-xs text-right">Waste %</th>
                <th className="px-5 py-3 font-bold text-muted-foreground uppercase text-xs text-right">Gross Yield / Unit</th>
                <th className="px-5 py-3 font-bold text-muted-foreground uppercase text-xs text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50 text-xs">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted-foreground">
                    <div className="h-5 w-5 border-2 border-primary border-t-transparent animate-spin rounded-full mx-auto mb-2" />
                    Loading BOM recipes...
                  </td>
                </tr>
              ) : filteredBoms.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted-foreground">
                    No BOM material lines defined for this style selection.
                  </td>
                </tr>
              ) : (
                filteredBoms.map((b) => {
                  const grossQty = (b.consumption_qty * (1 + b.waste_allowance_pct / 100)).toFixed(3);
                  return (
                    <tr key={b.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-4 font-mono font-bold text-primary">{b.style_code}</td>
                      <td className="px-5 py-4">
                        <span className="px-2 py-0.5 rounded bg-muted font-mono font-semibold text-[10px]">
                          {b.colorway}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-bold text-foreground">{b.item_name}</div>
                        <div className="text-[10px] text-muted-foreground uppercase font-semibold">{b.category}</div>
                      </td>
                      <td className="px-5 py-4 text-right font-mono font-bold">
                        {b.consumption_qty} {b.unit_of_measure}
                      </td>
                      <td className="px-5 py-4 text-right font-mono text-amber-700 font-bold">
                        +{b.waste_allowance_pct}%
                      </td>
                      <td className="px-5 py-4 text-right font-mono font-black text-emerald-700">
                        {grossQty} {b.unit_of_measure}
                      </td>
                      <td className="px-5 py-4 text-right">
                        {canManage && (
                          <button
                            onClick={() => handleDeleteBom(b.id)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ADD BOM ITEM MODAL */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-card border rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl space-y-6">
              
              <div className="flex items-center justify-between border-b pb-4">
                <div>
                  <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
                    <FileSpreadsheet className="h-5 w-5 text-primary" /> Add Material to BOM Recipe
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Link raw fabric, trims, or thread to a style recipe.
                  </p>
                </div>
                <button onClick={() => setShowAddModal(false)} className="p-1 rounded-lg hover:bg-muted">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 font-bold flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <form onSubmit={handleAddBomSubmit} className="space-y-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                    Target Style <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={addStyleId}
                    onChange={(e) => setAddStyleId(e.target.value)}
                    className="w-full p-2.5 border rounded-xl bg-background text-sm font-semibold"
                  >
                    {styles.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.style_code} — {st.style_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                      Colorway Override
                    </label>
                    <input
                      type="text"
                      placeholder="ALL (or Raw Indigo)"
                      value={addColorway}
                      onChange={(e) => setAddColorway(e.target.value)}
                      className="w-full p-2.5 border rounded-xl bg-background text-sm font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                      Material Category
                    </label>
                    <select
                      value={addUom}
                      onChange={(e) => setAddUom(e.target.value)}
                      className="w-full p-2.5 border rounded-xl bg-background text-sm"
                    >
                      <option value="Yards">Yards (Fabric)</option>
                      <option value="Pieces">Pieces (Zippers/Trims)</option>
                      <option value="Sets">Sets (Buttons/Rivets)</option>
                      <option value="Spools">Spools (Thread)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                    Inventory Material Item <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={addItemId}
                    onChange={(e) => setAddItemId(e.target.value)}
                    className="w-full p-2.5 border rounded-xl bg-background text-sm font-semibold"
                  >
                    {inventoryItems.map((item) => (
                      <option key={item.id} value={item.id}>
                        [{item.category}] {item.item_name} ({item.item_code})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                      Net Consumption / Garment <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      value={addConsumption}
                      onChange={(e) => setAddConsumption(Number(e.target.value))}
                      className="w-full p-2.5 border rounded-xl bg-background text-sm font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                      Waste Allowance %
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={addWastePct}
                      onChange={(e) => setAddWastePct(Number(e.target.value))}
                      className="w-full p-2.5 border rounded-xl bg-background text-sm font-mono"
                    />
                  </div>
                </div>

                <div className="pt-4 border-t flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2.5 border rounded-xl text-sm font-bold hover:bg-muted"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-primary text-primary-foreground font-bold rounded-xl text-sm hover:bg-primary/90"
                  >
                    Add to BOM Recipe
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </AppShell>
  );
}
