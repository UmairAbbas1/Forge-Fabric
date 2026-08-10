import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "../components/AppShell";
import { Link2, Plus, ArrowRight, Tag } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/sku-mapping")({
  component: SkuMapping,
});

// Mock Initial Mappings
const INITIAL_MAPPINGS = [
  { id: 1, customer: "Levi Strauss & Co.", cust_sku: "501-RAW-SEL", factory_code: "VINTAGE-5POCKET-RAW", style: "Vintage 5-Pocket", color: "Raw Indigo" },
  { id: 2, customer: "Zara Denim", cust_sku: "Z-DNM-902", factory_code: "CARPENTER-DNM", style: "Carpenter Denim", color: "Light Wash" }
];

function SkuMapping() {
  const [mappings, setMappings] = useState(INITIAL_MAPPINGS);
  const [isAdding, setIsAdding] = useState(false);
  const [newMap, setNewMap] = useState({ customer: "", cust_sku: "", factory_code: "", style: "", color: "" });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    setMappings([...mappings, { id: Date.now(), ...newMap }]);
    setIsAdding(false);
    setNewMap({ customer: "", cust_sku: "", factory_code: "", style: "", color: "" });
  };

  return (
    <AppShell activePath="/sku-mapping">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-display font-black tracking-tight text-foreground flex items-center gap-3">
              <Link2 className="h-8 w-8 text-primary" />
              Customer SKU Mapping (A.4)
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Link external customer product numbers to our internal factory codes for automated routing.
            </p>
          </div>
          <button 
            onClick={() => setIsAdding(true)}
            className="px-4 py-2 bg-primary text-primary-foreground font-bold text-sm rounded-lg hover:bg-primary/90 flex items-center gap-2 transition-all shadow-sm"
          >
            <Plus className="h-4 w-4" /> Map New SKU
          </button>
        </div>

        {isAdding && (
          <div className="bg-muted/30 border rounded-2xl p-6">
            <h3 className="font-bold mb-4 flex items-center gap-2"><Tag className="h-4 w-4 text-primary" /> New Mapping</h3>
            <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Customer</label>
                <input required type="text" value={newMap.customer} onChange={e => setNewMap({...newMap, customer: e.target.value})} className="mt-1 w-full p-2 border rounded-lg text-sm" placeholder="e.g. Levi's" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Customer SKU</label>
                <input required type="text" value={newMap.cust_sku} onChange={e => setNewMap({...newMap, cust_sku: e.target.value})} className="mt-1 w-full p-2 border rounded-lg text-sm font-mono" placeholder="501-RAW" />
              </div>
              <div className="flex items-end justify-center pb-2 hidden md:flex text-muted-foreground">
                <ArrowRight className="h-5 w-5" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Factory Code</label>
                <input required type="text" value={newMap.factory_code} onChange={e => setNewMap({...newMap, factory_code: e.target.value})} className="mt-1 w-full p-2 border border-primary/50 bg-primary/5 rounded-lg text-sm font-mono font-bold text-primary" placeholder="VINTAGE-5POCKET" />
              </div>
              <div className="flex items-end gap-2">
                <button type="button" onClick={() => setIsAdding(false)} className="px-4 py-2 border bg-background rounded-lg text-sm font-bold w-full hover:bg-muted">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-foreground text-background rounded-lg text-sm font-bold w-full hover:bg-foreground/90">Save</button>
              </div>
            </form>
          </div>
        )}

        {/* Table */}
        <div className="bg-card border rounded-2xl overflow-hidden shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/40 border-b">
              <tr>
                <th className="px-5 py-3 font-bold text-muted-foreground uppercase tracking-wider text-xs">Customer</th>
                <th className="px-5 py-3 font-bold text-muted-foreground uppercase tracking-wider text-xs">Customer SKU</th>
                <th className="px-5 py-3 font-bold text-muted-foreground uppercase tracking-wider text-xs text-center">Mapping</th>
                <th className="px-5 py-3 font-bold text-primary uppercase tracking-wider text-xs">Factory Code</th>
                <th className="px-5 py-3 font-bold text-muted-foreground uppercase tracking-wider text-xs">Style / Color</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {mappings.map((m) => (
                <tr key={m.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-5 py-4 font-bold">{m.customer}</td>
                  <td className="px-5 py-4 font-mono">{m.cust_sku}</td>
                  <td className="px-5 py-4 text-center text-muted-foreground"><ArrowRight className="h-4 w-4 inline-block" /></td>
                  <td className="px-5 py-4 font-mono font-bold text-primary">{m.factory_code}</td>
                  <td className="px-5 py-4 text-xs">
                    <span className="font-semibold block">{m.style}</span>
                    <span className="text-muted-foreground">{m.color}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>
    </AppShell>
  );
}
