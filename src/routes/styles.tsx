import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useState, useMemo } from 'react';
import { AppShell } from '../components/AppShell';
import { supabase, isRealSupabase } from '../lib/supabase';
import { usePermission } from '../hooks/usePermission';
import { 
  Scissors, Plus, Search, CheckCircle2, AlertTriangle, AlertCircle,
  Ruler, FileSpreadsheet, ArrowRight, Layers, Tag, ChevronRight, X 
} from 'lucide-react';

export const Route = createFileRoute('/styles')({
  head: () => ({
    meta: [
      { title: 'Style & Product Master · Forge & Fabric PLM' },
      { name: 'description', content: 'Central Product Master for apparel styles, size ranges, and BOM statuses.' },
    ],
  }),
  component: StylesMasterPage,
});

interface StyleItem {
  id: string;
  style_code: string;
  style_name: string;
  category: string;
  size_range_id: string;
  size_range_name?: string;
  has_bom?: boolean;
  description?: string;
}

interface SizeRangeOption {
  id: string;
  name: string;
  sizes: string[];
}

const MOCK_STYLES: StyleItem[] = [
  {
    id: 'st-1',
    style_code: '501-RAW-SEL',
    style_name: 'Vintage 5-Pocket Selvedge Jeans',
    category: 'Denim',
    size_range_id: 'sr-1',
    size_range_name: 'Adult Denim Numeric',
    has_bom: true,
    description: '14oz Raw Selvedge denim 5-pocket classic straight leg fit.',
  },
  {
    id: 'st-2',
    style_code: 'TSHIRT-KNIT-BASIC',
    style_name: 'Heavyweight Heavy Cotton Tee',
    category: 'Knitwear',
    size_range_id: 'sr-2',
    size_range_name: 'Alpha Apparel Standard',
    has_bom: true,
    description: '220 GSM combed jersey crewneck t-shirt.',
  },
  {
    id: 'st-3',
    style_code: 'CARPENTER-DNM-02',
    style_name: 'Relaxed Fit Carpenter Pant',
    category: 'Denim',
    size_range_id: 'sr-1',
    size_range_name: 'Adult Denim Numeric',
    has_bom: false, // Red Warning for Missing BOM!
    description: '12oz Canvas carpenter pants with hammer loop.',
  },
];

function StylesMasterPage() {
  const canManage = usePermission('product_master', 'update');
  const [styles, setStyles] = useState<StyleItem[]>([]);
  const [sizeRanges, setSizeRanges] = useState<SizeRangeOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [styleCode, setStyleCode] = useState('');
  const [styleName, setStyleName] = useState('');
  const [category, setCategory] = useState('Denim');
  const [sizeRangeId, setSizeRangeId] = useState('');
  const [description, setDescription] = useState('');
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      if (isRealSupabase) {
        // Fetch styles joined with size ranges and boms
        const { data: stData, error: stErr } = await supabase
          .from('styles')
          .select(`
            id, style_code, style_name, category, size_range_id, description,
            size_ranges(id, name),
            boms(id)
          `)
          .order('style_code');

        if (!stErr && stData) {
          const mapped = stData.map((s: any) => ({
            id: s.id,
            style_code: s.style_code,
            style_name: s.style_name,
            category: s.category,
            size_range_id: s.size_range_id,
            size_range_name: s.size_ranges?.name,
            has_bom: s.boms && s.boms.length > 0,
            description: s.description,
          }));
          setStyles(mapped);
        }

        // Fetch size ranges
        const { data: srData } = await supabase.from('size_ranges').select('id, name, sizes').order('name');
        if (srData) setSizeRanges(srData as any);
      } else {
        setStyles(MOCK_STYLES);
        setSizeRanges([
          { id: 'sr-1', name: 'Adult Denim Numeric', sizes: ['28', '30', '32', '34', '36'] },
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
    loadData();
  }, []);

  const filteredStyles = useMemo(() => {
    return styles.filter((s) => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch = !q || s.style_code.toLowerCase().includes(q) || s.style_name.toLowerCase().includes(q);
      const matchCat = categoryFilter === 'all' || s.category === categoryFilter;
      return matchSearch && matchCat;
    });
  }, [styles, searchQuery, categoryFilter]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!styleCode.trim() || !styleName.trim()) {
      setFormError('Style Code and Style Name are required.');
      return;
    }
    if (!sizeRangeId) {
      setFormError('Please assign a valid Size Range.');
      return;
    }

    setIsSubmitting(true);

    try {
      if (isRealSupabase) {
        const { error } = await supabase.from('styles').insert({
          style_code: styleCode.trim().toUpperCase(),
          style_name: styleName.trim(),
          category: category,
          size_range_id: sizeRangeId,
          description: description.trim() || null,
        });

        if (error) throw error;
      } else {
        const selectedSr = sizeRanges.find((sr) => sr.id === sizeRangeId);
        const newSt: StyleItem = {
          id: `st-${Date.now()}`,
          style_code: styleCode.trim().toUpperCase(),
          style_name: styleName.trim(),
          category: category,
          size_range_id: sizeRangeId,
          size_range_name: selectedSr?.name,
          has_bom: false,
          description: description.trim(),
        };
        setStyles([newSt, ...styles]);
      }

      setShowCreateModal(false);
      setStyleCode('');
      setStyleName('');
      setDescription('');
      loadData();
    } catch (err: any) {
      setFormError(err.message || 'Failed to create style master entry.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-foreground flex items-center gap-3">
              <Scissors className="h-7 w-7 text-primary" /> Style &amp; Product Master
            </h1>
            <p className="text-xs md:text-sm text-muted-foreground mt-1">
              Manage garment styles, assigned size scales, and BOM recipe completeness.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to={"/size-ranges" as any}
              className="bg-muted hover:bg-muted/80 text-foreground font-bold px-3.5 py-2.5 rounded-xl text-xs flex items-center gap-2 border shadow-xs"
            >
              <Ruler className="h-4 w-4" /> Size Ranges
            </Link>

            {canManage && (
              <button
                onClick={() => {
                  if (sizeRanges.length > 0 && !sizeRangeId) setSizeRangeId(sizeRanges[0].id);
                  setShowCreateModal(true);
                }}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-sm transition-all"
              >
                <Plus className="h-4 w-4" /> Create New Style
              </button>
            )}
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row items-center gap-3 bg-muted/30 p-3 rounded-2xl border">
          <div className="relative flex-1 w-full">
            <Search className="h-4 w-4 absolute left-3 top-2.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search style code, style name, category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-background border rounded-lg text-sm"
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-background border rounded-lg px-3 py-1.5 text-xs font-bold text-foreground w-full sm:w-auto"
          >
            <option value="all">All Categories</option>
            <option value="Denim">Denim</option>
            <option value="Knitwear">Knitwear</option>
            <option value="Outerwear">Outerwear</option>
            <option value="Woven Shirt">Woven Shirt</option>
            <option value="Activewear">Activewear</option>
          </select>
        </div>

        {/* Styles Table */}
        <div className="bg-card border rounded-2xl overflow-hidden shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/40 border-b">
              <tr>
                <th className="px-5 py-3 font-bold text-muted-foreground uppercase text-xs">Style Code &amp; Name</th>
                <th className="px-5 py-3 font-bold text-muted-foreground uppercase text-xs">Category</th>
                <th className="px-5 py-3 font-bold text-muted-foreground uppercase text-xs">Assigned Size Scale</th>
                <th className="px-5 py-3 font-bold text-muted-foreground uppercase text-xs">BOM Recipe Status</th>
                <th className="px-5 py-3 font-bold text-muted-foreground uppercase text-xs text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-muted-foreground">
                    <div className="h-5 w-5 border-2 border-primary border-t-transparent animate-spin rounded-full mx-auto mb-2" />
                    Loading styles...
                  </td>
                </tr>
              ) : filteredStyles.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-muted-foreground">
                    No styles found matching current filters.
                  </td>
                </tr>
              ) : (
                filteredStyles.map((st) => (
                  <tr key={st.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-4">
                      <div className="font-extrabold text-foreground font-mono">{st.style_code}</div>
                      <div className="text-xs text-muted-foreground font-medium">{st.style_name}</div>
                    </td>

                    <td className="px-5 py-4">
                      <span className="px-2.5 py-1 rounded-full bg-muted border text-[11px] font-bold text-foreground">
                        {st.category}
                      </span>
                    </td>

                    <td className="px-5 py-4 text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Ruler className="h-3.5 w-3.5 text-primary shrink-0" />
                      {st.size_range_name || 'Numeric Denim'}
                    </td>

                    <td className="px-5 py-4">
                      {st.has_bom ? (
                        <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 w-max">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> BOM Approved
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full bg-red-50 text-red-800 border border-red-200 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 w-max">
                          <AlertCircle className="h-3.5 w-3.5 text-red-600" /> Missing BOM
                        </span>
                      )}
                    </td>

                    <td className="px-5 py-4 text-right">
                      <Link
                        to={"/styles/$styleId" as any}
                        params={{ styleId: st.id } as any}
                        className="px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary font-bold text-xs rounded-xl transition-all inline-flex items-center gap-1"
                      >
                        <span>Manage &amp; SKUs</span>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* CREATE STYLE MODAL */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-card border rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl space-y-6">
              <div className="flex items-center justify-between border-b pb-4">
                <div>
                  <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
                    <Scissors className="h-5 w-5 text-primary" /> Create Style Master
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Define parent garment style code and assign a size scale.
                  </p>
                </div>
                <button onClick={() => setShowCreateModal(false)} className="p-1 rounded-lg hover:bg-muted">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 font-bold flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <form onSubmit={handleCreateSubmit} className="space-y-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                    Style Code <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 501-RAW-SEL"
                    value={styleCode}
                    onChange={(e) => setStyleCode(e.target.value.toUpperCase())}
                    className="w-full p-2.5 border rounded-xl bg-background text-sm font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                    Style Description / Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Vintage 5-Pocket Selvedge Denim"
                    value={styleName}
                    onChange={(e) => setStyleName(e.target.value)}
                    className="w-full p-2.5 border rounded-xl bg-background text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                      Garment Category
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full p-2.5 border rounded-xl bg-background text-sm font-semibold"
                    >
                      <option value="Denim">Denim</option>
                      <option value="Knitwear">Knitwear</option>
                      <option value="Outerwear">Outerwear</option>
                      <option value="Woven Shirt">Woven Shirt</option>
                      <option value="Activewear">Activewear</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                      Assigned Size Range <span className="text-red-500">*</span>
                    </label>
                    <select
                      required
                      value={sizeRangeId}
                      onChange={(e) => setSizeRangeId(e.target.value)}
                      className="w-full p-2.5 border rounded-xl bg-background text-sm font-semibold"
                    >
                      {sizeRanges.map((sr) => (
                        <option key={sr.id} value={sr.id}>
                          {sr.name} ({sr.sizes.join(', ')})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                    Description &amp; Tech Notes
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Fabric weight, fit description, stitching details..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full p-2.5 border rounded-xl bg-background text-sm"
                  />
                </div>

                <div className="pt-4 border-t flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2.5 border rounded-xl text-sm font-bold hover:bg-muted"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2.5 bg-primary text-primary-foreground font-bold rounded-xl text-sm hover:bg-primary/90 disabled:opacity-50"
                  >
                    Save Style Master
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
