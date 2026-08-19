import { useEffect, useMemo, useState } from "react";
import { supabase, isRealSupabase } from "../../lib/supabase";
import { usePermission } from "../../hooks/usePermission";
import { FileText, UploadCloud, Download, History, AlertTriangle, CheckCircle2, X } from "lucide-react";

interface TechPackVaultProps {
  styleCode: string;
}

interface VaultRecord {
  id: string;
  company_id?: string;
  customer_name: string;
  style_code: string;
  version_number: number;
  file_name: string;
  file_url: string;
  file_size_bytes?: number;
  is_active: boolean;
  change_notes?: string;
  created_at: string;
}

interface CompanyOption {
  id: string;
  name: string;
}

/**
 * REQ-05: Centralized Tech Pack Storage & Document Vault.
 * storage://tech-packs/{company_id}/{style_code}/v{version}/{filename}
 */
export function TechPackVault({ styleCode }: TechPackVaultProps) {
  const canManage = usePermission("product_master", "update");
  const [records, setRecords] = useState<VaultRecord[]>([]);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [changeNotes, setChangeNotes] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const load = async () => {
    setIsLoading(true);
    try {
      if (isRealSupabase) {
        const [{ data: vaultData }, { data: compData }] = await Promise.all([
          supabase.from("tech_pack_vault").select("*").eq("style_code", styleCode).order("version_number", { ascending: false }),
          supabase.from("companies").select("id, name").eq("company_type", "Customer").order("name"),
        ]);
        setRecords((vaultData as VaultRecord[]) || []);
        setCompanies((compData as CompanyOption[]) || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [styleCode]);

  const activeRecord = useMemo(() => records.find((r) => r.is_active), [records]);
  const nextVersion = useMemo(() => (records.length > 0 ? Math.max(...records.map((r) => r.version_number)) + 1 : 1), [records]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (!file) {
      setMsg({ type: "error", text: "Select a tech pack file to upload." });
      return;
    }
    if (!isRealSupabase) {
      setMsg({ type: "error", text: "Not connected to the live database." });
      return;
    }

    setIsUploading(true);
    try {
      const companyFolder = selectedCompanyId || "internal";
      const cleanFileName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
      const path = `${companyFolder}/${styleCode}/v${nextVersion}/${cleanFileName}`;

      const { error: uploadErr } = await supabase.storage.from("tech-packs").upload(path, file, {
        cacheControl: "3600",
        upsert: true,
      });
      if (uploadErr) throw uploadErr;

      // Deactivate prior version, insert new active version
      await supabase.from("tech_pack_vault").update({ is_active: false }).eq("style_code", styleCode).eq("is_active", true);

      const companyName = companies.find((c) => c.id === selectedCompanyId)?.name || "Internal";
      const { error: insertErr } = await supabase.from("tech_pack_vault").insert({
        company_id: selectedCompanyId || null,
        customer_name: companyName,
        style_code: styleCode,
        version_number: nextVersion,
        file_name: file.name,
        file_url: path,
        file_size_bytes: file.size,
        mime_type: file.type || "application/pdf",
        is_active: true,
        change_notes: changeNotes || (nextVersion === 1 ? "Initial tech pack upload" : "Revision"),
      });
      if (insertErr) throw insertErr;

      setMsg({ type: "success", text: `Tech pack v${nextVersion} uploaded and set as the active version.` });
      setFile(null);
      setChangeNotes("");
      load();
    } catch (err: any) {
      setMsg({ type: "error", text: err.message || "Failed to upload tech pack." });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownload = async (record: VaultRecord) => {
    if (!isRealSupabase) return;
    const { data, error } = await supabase.storage.from("tech-packs").createSignedUrl(record.file_url, 300);
    if (!error && data?.signedUrl) {
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } else {
      setMsg({ type: "error", text: "Could not generate a secure download link." });
    }
  };

  return (
    <div className="bg-card border rounded-2xl overflow-hidden shadow-sm">
      <div className="p-4 border-b bg-muted/30 flex items-center justify-between">
        <h3 className="font-extrabold text-foreground text-sm flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" /> Tech Pack Document Vault
        </h3>
        {activeRecord && (
          <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold uppercase">
            Active: v{activeRecord.version_number}
          </span>
        )}
      </div>

      <div className="p-4 space-y-4">
        {msg && (
          <div className={`p-2.5 rounded-xl text-[11px] font-bold flex items-center gap-2 ${msg.type === "success" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-red-50 text-red-800 border border-red-200"}`}>
            {msg.type === "success" ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> : <AlertTriangle className="h-3.5 w-3.5 shrink-0" />}
            <span>{msg.text}</span>
            <button type="button" onClick={() => setMsg(null)} className="ml-auto"><X className="h-3 w-3" /></button>
          </div>
        )}

        {canManage && (
          <form onSubmit={handleUpload} className="p-3.5 bg-muted/20 border rounded-xl space-y-2.5">
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">Brand / Company</label>
                <select
                  value={selectedCompanyId}
                  onChange={(e) => setSelectedCompanyId(e.target.value)}
                  className="w-full p-2 border rounded-lg bg-background text-xs font-semibold"
                >
                  <option value="">Internal / No Brand</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">Next Version</label>
                <input type="text" readOnly value={`v${nextVersion}`} className="w-full p-2 border rounded-lg bg-muted font-mono font-bold text-xs" />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">File (PDF / Spec Sheet)</label>
              <input
                type="file"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="w-full text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-primary file:text-primary-foreground file:font-bold file:text-xs"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">Change Notes</label>
              <input
                type="text"
                value={changeNotes}
                onChange={(e) => setChangeNotes(e.target.value)}
                placeholder="e.g. Updated wash formula, revised hardware placement"
                className="w-full p-2 border rounded-lg bg-background text-xs"
              />
            </div>
            <button
              type="submit"
              disabled={isUploading || !file}
              className="w-full py-2 bg-primary text-primary-foreground font-bold text-xs rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              <UploadCloud className="h-3.5 w-3.5" /> {isUploading ? "Uploading..." : `Upload as v${nextVersion}`}
            </button>
          </form>
        )}

        <div className="space-y-1.5">
          <div className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1.5">
            <History className="h-3 w-3" /> Version History
          </div>
          {isLoading ? (
            <div className="py-6 text-center text-xs text-muted-foreground">Loading vault records...</div>
          ) : records.length === 0 ? (
            <div className="py-6 text-center text-xs text-muted-foreground border border-dashed rounded-xl">
              No tech packs uploaded yet for this style.
            </div>
          ) : (
            records.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => handleDownload(r)}
                className={`w-full flex items-center justify-between p-2.5 rounded-lg border text-xs text-left transition-colors ${
                  r.is_active ? "bg-emerald-50/50 border-emerald-200" : "bg-background hover:bg-muted/40 border-border"
                }`}
              >
                <div>
                  <div className="font-bold text-foreground flex items-center gap-1.5">
                    v{r.version_number} · {r.file_name}
                    {r.is_active && <span className="text-[9px] px-1.5 py-0.5 bg-emerald-600 text-white rounded-full font-black">ACTIVE</span>}
                  </div>
                  <div className="text-[10px] text-muted-foreground">{r.customer_name} · {r.change_notes} · {new Date(r.created_at).toLocaleDateString()}</div>
                </div>
                <Download className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
