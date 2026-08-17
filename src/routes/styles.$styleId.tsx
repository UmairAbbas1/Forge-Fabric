import { createFileRoute, Link, useParams } from '@tanstack/react-router';
import { useEffect, useState, useMemo } from 'react';
import { AppShell } from '../components/AppShell';
import { supabase, isRealSupabase } from '../lib/supabase';
import { usePermission } from '../hooks/usePermission';
import { 
  Scissors, Ruler, Plus, CheckCircle2, AlertTriangle, 
  Grid, Save, ArrowLeft, Layers, Tag, X, Check, FileSpreadsheet, Sparkles, RefreshCw
} from 'lucide-react';

export const Route = createFileRoute('/styles/$styleId')({
  head: () => ({
    meta: [
      { title: 'Style Details & SKU Generator · Forge & Fabric Industries, Inc. PLM' },
      { name: 'description', content: 'Manage style colorways, size scale assignments, and bulk SKU generation.' },
    ],
  }),
  component: StyleDetailPage,
});

interface StyleDetail {
  id: string;
  style_code: string;
  style_name: string;
  category: string;
  size_range_id: string;
  size_range_name?: string;
  sizes: string[];
  description?: string;
}

interface SkuRecord {
  id: string;
  style_id: string;
  colorway: string;
  size_code: string;
  sku_code: string;
  barcode_ean?: string;
}

interface SizeRangeOption {
  id: string;
  name: string;
  sizes: string[];
}

function StyleDetailPage() {
  const { styleId } = useParams({ from: '/styles/$styleId' });
  const canManage = usePermission('product_master', 'update');

  const [style, setStyle] = useState<StyleDetail | null>(null);
  const [skus, setSkus] = useState<SkuRecord[]>([]);
  const [sizeRanges, setSizeRanges] = useState<SizeRangeOption[]>([]);
  const [colorways, setColorways] = useState<string[]>(['Raw Indigo', 'Vintage Wash']);
  const [newColorwayInput, setNewColorwayInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // SKU Generator Modal State
  const [showGeneratorModal, setShowGeneratorModal] = useState(false);
  const [generatedSkus, setGeneratedSkus] = useState<{ sku_code: string; colorway: string; size_code: string; selected: boolean }[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const loadStyleData = async () => {
    setIsLoading(true);
    try {
      if (isRealSupabase) {
        // Fetch style record
        const { data: stData, error: stErr } = await supabase
          .from('styles')
          .select('*, size_ranges(id, name, sizes)')
          .eq('id', styleId)
          .single();

        if (!stErr && stData) {
          setStyle({
            id: stData.id,
            style_code: stData.style_code,
            style_name: stData.style_name,
            category: stData.category,
            size_range_id: stData.size_range_id,
            size_range_name: stData.size_ranges?.name,
            sizes: stData.size_ranges?.sizes || ['28', '30', '32', '34', '36'],
            description: stData.description,
          });
        }

        // Fetch SKUs for style
        const { data: skuData } = await supabase
          .from('skus')
          .select('*')
          .eq('style_id', styleId)
          .order('sku_code');

        if (skuData) {
          setSkus(skuData as SkuRecord[]);
          const distinctColors = Array.from(new Set(skuData.map((s: any) => s.colorway)));
          if (distinctColors.length > 0) setColorways(distinctColors as string[]);
        }

        // Fetch size ranges
        const { data: srData } = await supabase.from('size_ranges').select('id, name, sizes').order('name');
        if (srData) setSizeRanges(srData as any);
      } else {
        // Mock fallback
        setStyle({
          id: styleId || 'st-1',
          style_code: '501-RAW-SEL',
          style_name: 'Vintage 5-Pocket Selvedge Jeans',
          category: 'Denim',
          size_range_id: 'sr-1',
          size_range_name: 'Adult Denim Numeric',
          sizes: ['28', '29', '30', '31', '32', '33', '34', '36', '38', '40'],
          description: '14oz Raw Selvedge denim 5-pocket classic straight leg fit.',
        });
        setSkus([
          { id: 'sku-1', style_id: styleId, colorway: 'Raw Indigo', size_code: '30', sku_code: '501-RAW-SEL-RAWINDIGO-30' },
          { id: 'sku-2', style_id: styleId, colorway: 'Raw Indigo', size_code: '32', sku_code: '501-RAW-SEL-RAWINDIGO-32' },
          { id: 'sku-3', style_id: styleId, colorway: 'Vintage Wash', size_code: '32', sku_code: '501-RAW-SEL-VINTAGEWASH-32' },
        ]);
        setSizeRanges([
          { id: 'sr-1', name: 'Adult Denim Numeric', sizes: ['28', '29', '30', '31', '32', '33', '34', '36', '38', '40'] },
          { id: 'sr-2', name: 'Alpha Apparel Standard', sizes: ['XS', 'S', 'M', 'L', 'XL'] },
        ]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStyleData();
  }, [styleId]);

  // Add Colorway
  const handleAddColorway = () => {
    const clean = newColorwayInput.trim();
    if (!clean) return;
    if (!colorways.includes(clean)) {
      setColorways([...colorways, clean]);
    }
    setNewColorwayInput('');
  };

  // Remove Colorway
  const handleRemoveColorway = (cw: string) => {
    setColorways(colorways.filter((c) => c !== cw));
  };

  // Change Size Range Assignment
  const handleSizeRangeChange = async (newSrId: string) => {
    if (!style) return;
    const selectedSr = sizeRanges.find((sr) => sr.id === newSrId);
    if (!selectedSr) return;

    try {
      if (isRealSupabase) {
        const { error } = await supabase
          .from('styles')
          .update({ size_range_id: newSrId })
          .eq('id', style.id);
        if (error) throw error;
      }

      setStyle({
        ...style,
        size_range_id: newSrId,
        size_range_name: selectedSr.name,
        sizes: selectedSr.sizes,
      });

      setStatusMsg({ type: 'success', text: `Size range re-assigned to "${selectedSr.name}".` });
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to update size range.' });
    }
  };

  // Open SKU Generator Preview Grid
  const handleOpenGenerator = () => {
    if (!style) return;
    const generated: { sku_code: string; colorway: string; size_code: string; selected: boolean }[] = [];

    const cleanStyleCode = style.style_code.trim().toUpperCase();

    colorways.forEach((cw) => {
      const cleanColor = cw.replace(/\s+/g, '').toUpperCase();
      style.sizes.forEach((sz) => {
        const code = `${cleanStyleCode}-${cleanColor}-${sz}`;
        const alreadyExists = skus.some((s) => s.sku_code === code);
        if (!alreadyExists) {
          generated.push({
            sku_code: code,
            colorway: cw,
            size_code: sz,
            selected: true, // Selected by default
          });
        }
      });
    });

    setGeneratedSkus(generated);
    setShowGeneratorModal(true);
  };

  // Toggle SKU selection in generator preview grid
  const toggleSkuSelection = (skuCode: string) => {
    setGeneratedSkus(prev => prev.map(s => s.sku_code === skuCode ? { ...s, selected: !s.selected } : s));
  };

  // Confirm and Bulk Create SKUs
  const handleConfirmBulkSkuInsert = async () => {
    if (!style) return;
    const toInsert = generatedSkus.filter((s) => s.selected);
    if (toInsert.length === 0) {
      setShowGeneratorModal(false);
      return;
    }

    setIsGenerating(true);

    try {
      if (isRealSupabase) {
        const payload = toInsert.map((s) => ({
          style_id: style.id,
          colorway: s.colorway,
          size_code: s.size_code,
          sku_code: s.sku_code,
        }));

        const { error } = await supabase.from('skus').insert(payload);
        if (error) throw error;
      } else {
        const mockNew = toInsert.map((s, idx) => ({
          id: `sku-gen-${Date.now()}-${idx}`,
          style_id: style.id,
          colorway: s.colorway,
          size_code: s.size_code,
          sku_code: s.sku_code,
        }));
        setSkus([...skus, ...mockNew]);
      }

      setStatusMsg({ type: 'success', text: `Successfully generated ${toInsert.length} new SKU variants!` });
      setShowGeneratorModal(false);
      loadStyleData();
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to bulk generate SKUs.' });
    } finally {
      setIsGenerating(false);
    }
  };

  if (isLoading || !style) {
    return (
      <AppShell>
        <div className="py-20 text-center text-muted-foreground">
          <div className="h-6 w-6 border-2 border-primary border-t-transparent animate-spin rounded-full mx-auto mb-2" />
          Loading style specification details...
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Navigation Breadcrumb & Back */}
        <div className="flex items-center justify-between">
          <Link
            to={"/styles" as any}
            className="text-xs font-bold text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Style Master List
          </Link>

          <Link
            to={"/boms" as any}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-4 py-2 rounded-xl text-xs flex items-center gap-2 shadow-sm transition-all"
          >
            <FileSpreadsheet className="h-4 w-4" /> Manage Style BOM Recipe
          </Link>
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

        {/* Header Specification Box */}
        <div className="bg-card border-2 border-border rounded-3xl p-6 md:p-8 shadow-sm space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6">
            <div>
              <div className="flex items-center gap-3">
                <span className="text-xl md:text-2xl font-black font-mono text-primary">{style.style_code}</span>
                <span className="px-3 py-1 bg-muted rounded-full text-xs font-bold uppercase tracking-wider text-foreground">
                  {style.category}
                </span>
              </div>
              <h1 className="text-xl md:text-2xl font-bold text-foreground mt-1">{style.style_name}</h1>
            </div>

            {/* Size Range Assignment */}
            <div className="bg-muted/40 p-3.5 rounded-2xl border space-y-1">
              <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <Ruler className="h-3.5 w-3.5 text-primary" /> Assigned Size Range Scale
              </label>
              <select
                disabled={!canManage}
                value={style.size_range_id}
                onChange={(e) => handleSizeRangeChange(e.target.value)}
                className="bg-background border rounded-xl px-3 py-1.5 text-xs font-bold text-foreground w-full"
              >
                {sizeRanges.map((sr) => (
                  <option key={sr.id} value={sr.id}>
                    {sr.name} ({sr.sizes.join(', ')})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Colorways Management */}
          <div className="space-y-3">
            <label className="text-xs font-black uppercase tracking-wider text-muted-foreground block">
              Active Style Colorways ({colorways.length})
            </label>
            <div className="flex flex-wrap items-center gap-2">
              {colorways.map((cw) => (
                <span key={cw} className="px-3 py-1.5 rounded-xl bg-primary/10 border border-primary/20 text-primary font-bold text-xs flex items-center gap-1.5">
                  <Tag className="h-3 w-3" /> {cw}
                  {canManage && (
                    <button onClick={() => handleRemoveColorway(cw)} className="hover:text-red-600">
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </span>
              ))}

              {canManage && (
                <div className="flex items-center gap-1.5 ml-2">
                  <input
                    type="text"
                    placeholder="Add colorway (e.g. Black)..."
                    value={newColorwayInput}
                    onChange={(e) => setNewColorwayInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddColorway())}
                    className="p-1.5 border rounded-xl text-xs bg-background"
                  />
                  <button
                    type="button"
                    onClick={handleAddColorway}
                    className="p-1.5 bg-muted hover:bg-muted/80 rounded-xl text-xs font-bold"
                  >
                    Add
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Size Scale Preview Chips */}
          <div className="space-y-2 pt-2 border-t">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
              Active Size Scale Columns ({style.sizes.length})
            </label>
            <div className="flex flex-wrap gap-1.5">
              {style.sizes.map((sz) => (
                <span key={sz} className="px-2.5 py-1 bg-muted text-foreground font-mono font-bold text-xs rounded-lg border">
                  {sz}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* SKUs GENERATED SECTION */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-extrabold text-foreground flex items-center gap-2">
                <Grid className="h-5 w-5 text-primary" /> Generated SKU Variants ({skus.length})
              </h3>
              <p className="text-xs text-muted-foreground">
                Stock Keeping Units derived from Style + Colorway + Size combinations.
              </p>
            </div>

            {canManage && (
              <button
                onClick={handleOpenGenerator}
                className="bg-primary text-primary-foreground font-extrabold px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-sm hover:bg-primary/90 transition-all"
              >
                <Sparkles className="h-4 w-4" /> Bulk SKU Generator
              </button>
            )}
          </div>

          <div className="bg-card border rounded-2xl overflow-hidden shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/40 border-b">
                <tr>
                  <th className="px-5 py-3 font-bold text-muted-foreground uppercase text-xs">SKU Code</th>
                  <th className="px-5 py-3 font-bold text-muted-foreground uppercase text-xs">Colorway</th>
                  <th className="px-5 py-3 font-bold text-muted-foreground uppercase text-xs">Size Code</th>
                  <th className="px-5 py-3 font-bold text-muted-foreground uppercase text-xs text-right">EAN / Barcode</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50 font-mono text-xs">
                {skus.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-muted-foreground">
                      No SKUs generated yet. Click "Bulk SKU Generator" above to generate variants.
                    </td>
                  </tr>
                ) : (
                  skus.map((s) => (
                    <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-3.5 font-bold text-primary">{s.sku_code}</td>
                      <td className="px-5 py-3.5 text-foreground">{s.colorway}</td>
                      <td className="px-5 py-3.5 font-bold text-foreground">{s.size_code}</td>
                      <td className="px-5 py-3.5 text-right text-muted-foreground">{s.barcode_ean || 'Auto EAN-13'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* BULK SKU GENERATOR PREVIEW MODAL */}
        {showGeneratorModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-card border rounded-3xl p-6 md:p-8 max-w-2xl w-full shadow-2xl space-y-6 max-h-[90vh] flex flex-col">
              
              <div className="flex items-center justify-between border-b pb-4 shrink-0">
                <div>
                  <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" /> Bulk SKU Variant Generator
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Preview generated SKUs ({style.style_code} $\times$ {colorways.length} Colorways $\times$ {style.sizes.length} Sizes). Deselect any unneeded variants.
                  </p>
                </div>
                <button onClick={() => setShowGeneratorModal(false)} className="p-1 rounded-lg hover:bg-muted">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {generatedSkus.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm">
                  All SKU combinations for the selected Colorways and Sizes already exist in the database!
                </div>
              ) : (
                <div className="overflow-y-auto flex-1 border rounded-2xl p-4 bg-muted/20 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-muted-foreground border-b pb-2">
                    <span>Generated SKU Code ({generatedSkus.filter(s => s.selected).length} selected)</span>
                    <span>Action</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {generatedSkus.map((s) => (
                      <div
                        key={s.sku_code}
                        onClick={() => toggleSkuSelection(s.sku_code)}
                        className={`p-2.5 rounded-xl border text-xs font-mono font-bold flex items-center justify-between cursor-pointer transition-all ${
                          s.selected
                            ? 'bg-primary/10 border-primary text-primary'
                            : 'bg-background border-border text-muted-foreground opacity-60'
                        }`}
                      >
                        <span>{s.sku_code}</span>
                        <input
                          type="checkbox"
                          checked={s.selected}
                          onChange={() => {}} // Handled by div click
                          className="h-4 w-4 text-primary rounded"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-4 border-t flex items-center justify-between shrink-0">
                <span className="text-xs text-muted-foreground font-semibold">
                  {generatedSkus.filter((s) => s.selected).length} variants ready for insert
                </span>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setShowGeneratorModal(false)}
                    className="px-4 py-2 border rounded-xl text-sm font-bold hover:bg-muted"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isGenerating || generatedSkus.filter((s) => s.selected).length === 0}
                    onClick={handleConfirmBulkSkuInsert}
                    className="px-5 py-2 bg-primary text-primary-foreground font-bold rounded-xl text-sm hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
                  >
                    {isGenerating && <RefreshCw className="h-4 w-4 animate-spin" />}
                    Confirm &amp; Insert SKUs
                  </button>
                </div>
              </div>

            </div>
          </div>
        )}

      </div>
    </AppShell>
  );
}
