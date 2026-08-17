import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { AppShell } from '../components/AppShell';
import { supabase, isRealSupabase } from '../lib/supabase';
import { usePermission } from '../hooks/usePermission';
import { 
  Ruler, Plus, Trash2, Edit2, Check, X, Tag, MoveRight, Layers, AlertCircle, CheckCircle2 
} from 'lucide-react';

export const Route = createFileRoute('/size-ranges')({
  head: () => ({
    meta: [
      { title: 'Size Range Master · Forge & Fabric Industries, Inc. PLM' },
      { name: 'description', content: 'Configure generic garment size ranges and grading scales.' },
    ],
  }),
  component: SizeRangesMasterPage,
});

interface SizeRange {
  id: string;
  name: string;
  description?: string;
  sizes: string[];
  created_at?: string;
}

const SEEDED_MOCK_SIZE_RANGES: SizeRange[] = [
  {
    id: 'sr-1',
    name: 'Adult Denim Numeric',
    description: 'Standard adult denim waist sizes in inches',
    sizes: ['28', '29', '30', '31', '32', '33', '34', '36', '38', '40'],
  },
  {
    id: 'sr-2',
    name: 'Alpha Apparel Standard',
    description: 'Standard unisex alpha sizes for knits and tops',
    sizes: ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'],
  },
  {
    id: 'sr-3',
    name: 'Kids Toddler Age',
    description: 'Toddler and young kids sizing scale',
    sizes: ['2T', '3T', '4T', '5T', '6', '7', '8'],
  },
];

function SizeRangesMasterPage() {
  const canManage = usePermission('product_master', 'update');
  const [sizeRanges, setSizeRanges] = useState<SizeRange[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Editor Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [sizes, setSizes] = useState<string[]>([]);
  const [chipInput, setChipInput] = useState('');
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchSizeRanges = async () => {
    setIsLoading(true);
    try {
      if (isRealSupabase) {
        const { data, error } = await supabase
          .from('size_ranges')
          .select('*')
          .order('name');
        if (!error && data) {
          setSizeRanges(data as SizeRange[]);
        }
      } else {
        setSizeRanges(SEEDED_MOCK_SIZE_RANGES);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSizeRanges();
  }, []);

  // Add Size Chip
  const handleAddChip = () => {
    const clean = chipInput.trim().toUpperCase();
    if (!clean) return;
    if (sizes.includes(clean)) {
      setFormError(`Size "${clean}" is already in this size range.`);
      return;
    }
    setSizes([...sizes, clean]);
    setChipInput('');
    setFormError('');
  };

  // Handle KeyDown in Chip Input
  const handleChipKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleAddChip();
    }
  };

  // Remove Chip
  const handleRemoveChip = (sizeToRemove: string) => {
    setSizes(sizes.filter((s) => s !== sizeToRemove));
  };

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingId(null);
    setName('');
    setDescription('');
    setSizes(['S', 'M', 'L', 'XL']);
    setChipInput('');
    setFormError('');
    setShowModal(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (sr: SizeRange) => {
    setEditingId(sr.id);
    setName(sr.name);
    setDescription(sr.description || '');
    setSizes([...sr.sizes]);
    setChipInput('');
    setFormError('');
    setShowModal(true);
  };

  // Save Size Range
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!name.trim()) {
      setFormError('Size range name is required.');
      return;
    }

    if (sizes.length === 0) {
      setFormError('Please add at least one size code to the range.');
      return;
    }

    setIsSubmitting(true);

    try {
      if (isRealSupabase) {
        if (editingId) {
          const { error } = await supabase
            .from('size_ranges')
            .update({
              name: name.trim(),
              description: description.trim() || null,
              sizes: sizes,
              updated_at: new Date().toISOString(),
            })
            .eq('id', editingId);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('size_ranges')
            .insert({
              name: name.trim(),
              description: description.trim() || null,
              sizes: sizes,
            });
          if (error) throw error;
        }
      } else {
        if (editingId) {
          setSizeRanges(prev => prev.map(sr => sr.id === editingId ? { ...sr, name, description, sizes } : sr));
        } else {
          const newSr: SizeRange = {
            id: `sr-${Date.now()}`,
            name: name.trim(),
            description: description.trim(),
            sizes: sizes,
          };
          setSizeRanges(prev => [newSr, ...prev]);
        }
      }

      setStatusMsg({ type: 'success', text: `Size Range "${name}" saved successfully!` });
      setShowModal(false);
      fetchSizeRanges();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save size range.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Size Range
  const handleDelete = async (sr: SizeRange) => {
    if (!window.confirm(`Are you sure you want to delete size range "${sr.name}"?`)) return;

    try {
      if (isRealSupabase) {
        const { error } = await supabase.from('size_ranges').delete().eq('id', sr.id);
        if (error) throw error;
      }
      setSizeRanges(prev => prev.filter(item => item.id !== sr.id));
      setStatusMsg({ type: 'success', text: `Size range "${sr.name}" deleted.` });
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to delete size range.' });
    }
  };

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-foreground flex items-center gap-3">
              <Ruler className="h-7 w-7 text-primary" /> Size Range &amp; Grading Master
            </h1>
            <p className="text-xs md:text-sm text-muted-foreground mt-1">
              Configure generic sizing scales (numeric, alpha, kids, custom) assigned across styles.
            </p>
          </div>

          {canManage && (
            <button
              onClick={handleOpenCreate}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-sm transition-all"
            >
              <Plus className="h-4 w-4" /> Create Size Range
            </button>
          )}
        </div>

        {/* Notification Banner */}
        {statusMsg && (
          <div className={`p-4 rounded-xl text-xs font-bold flex items-center justify-between border ${
            statusMsg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-800 border-red-200'
          }`}>
            <div className="flex items-center gap-2">
              {statusMsg.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
              <span>{statusMsg.text}</span>
            </div>
            <button onClick={() => setStatusMsg(null)}><X className="h-4 w-4" /></button>
          </div>
        )}

        {/* Size Ranges Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {isLoading ? (
            <div className="col-span-full py-16 text-center text-muted-foreground">
              <div className="h-6 w-6 border-2 border-primary border-t-transparent animate-spin rounded-full mx-auto mb-2" />
              Loading size ranges...
            </div>
          ) : sizeRanges.map((sr) => (
            <div key={sr.id} className="bg-card border-2 border-border/80 hover:border-primary/50 rounded-2xl p-6 shadow-sm flex flex-col justify-between space-y-4 transition-all group">
              <div className="space-y-2">
                <div className="flex items-start justify-between">
                  <h3 className="font-extrabold text-foreground text-base group-hover:text-primary transition-colors">
                    {sr.name}
                  </h3>
                  <span className="text-[10px] font-mono font-bold bg-muted px-2 py-0.5 rounded-md text-muted-foreground">
                    {sr.sizes.length} Sizes
                  </span>
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed">
                  {sr.description || 'No description provided.'}
                </p>

                {/* Chips Grid */}
                <div className="pt-3 flex flex-wrap gap-1.5">
                  {sr.sizes.map((sz, idx) => (
                    <span key={idx} className="bg-primary/10 border border-primary/20 text-primary text-xs font-mono font-bold px-2.5 py-1 rounded-lg">
                      {sz}
                    </span>
                  ))}
                </div>
              </div>

              {canManage && (
                <div className="pt-4 border-t flex items-center justify-end gap-2">
                  <button
                    onClick={() => handleOpenEdit(sr)}
                    className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors text-xs font-bold flex items-center gap-1"
                  >
                    <Edit2 className="h-3.5 w-3.5" /> Edit
                  </button>
                  <button
                    onClick={() => handleDelete(sr)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-xs font-bold flex items-center gap-1"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* EDITOR MODAL */}
        {showModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-card border rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl space-y-6">
              
              <div className="flex items-center justify-between border-b pb-4">
                <div>
                  <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
                    <Ruler className="h-5 w-5 text-primary" />
                    {editingId ? 'Edit Size Range' : 'Create New Size Range'}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Define sizing codes for numeric denim, alpha tops, or custom scale sets.
                  </p>
                </div>
                <button onClick={() => setShowModal(false)} className="p-1 rounded-lg hover:bg-muted">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 font-bold flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <form onSubmit={handleSave} className="space-y-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                    Size Range Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Adult Jeans Waist (Inches)"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full p-2.5 border rounded-xl bg-background text-sm"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                    Description
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Sizing scale from 28 inch to 40 inch waist"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full p-2.5 border rounded-xl bg-background text-sm"
                  />
                </div>

                {/* CHIP / TAG INPUT EDITOR */}
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                    Size Codes Array <span className="text-red-500">*</span>
                  </label>
                  <p className="text-[11px] text-muted-foreground mb-2">
                    Type a size code (e.g. "32" or "XL") and press <strong>Enter</strong> or <strong>Comma</strong> to add.
                  </p>

                  <div className="p-3 border-2 border-primary/30 rounded-2xl bg-background space-y-3 min-h-[100px]">
                    <div className="flex flex-wrap gap-2">
                      {sizes.map((sz) => (
                        <span key={sz} className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground font-mono font-bold text-xs px-3 py-1 rounded-xl shadow-xs">
                          {sz}
                          <button
                            type="button"
                            onClick={() => handleRemoveChip(sz)}
                            className="hover:bg-primary-foreground/20 rounded-full p-0.5"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-border/50">
                      <Tag className="h-4 w-4 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder="Add size code (e.g. 34, XL, 4T)..."
                        value={chipInput}
                        onChange={(e) => setChipInput(e.target.value)}
                        onKeyDown={handleChipKeyDown}
                        className="flex-1 bg-transparent text-sm border-none focus:outline-none font-mono"
                      />
                      <button
                        type="button"
                        onClick={handleAddChip}
                        className="px-3 py-1 bg-muted hover:bg-muted/80 text-foreground font-bold text-xs rounded-lg"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2.5 border rounded-xl text-sm font-bold hover:bg-muted"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || sizes.length === 0}
                    className="px-5 py-2.5 bg-primary text-primary-foreground font-bold rounded-xl text-sm hover:bg-primary/90 disabled:opacity-50"
                  >
                    Save Size Range
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
