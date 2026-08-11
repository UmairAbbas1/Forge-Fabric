import React, { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { Beaker, Package, Search } from "lucide-react";
import { SampleRequestDetails } from "./SampleRequestDetails.tsx";

export function SampleRequestsDashboard() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("sample_requests")
        .select(
          `
          *,
          companies ( name )
        `,
        )
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRequests(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const selectedRequest = requests.find((r) => r.id === selectedId);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 animate-in fade-in">
      <div className={`space-y-4 ${selectedId ? "lg:col-span-2" : "lg:col-span-3"}`}>
        <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-neutral-200 flex justify-between items-center bg-neutral-50/50">
            <h3 className="font-bold text-neutral-900">Sample Requests Pipeline</h3>
            <div className="relative">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search..."
                className="pl-9 pr-4 py-2 border border-neutral-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-neutral-50 text-neutral-500 font-bold uppercase text-[11px] tracking-wider border-b border-neutral-200">
                <tr>
                  <th className="px-6 py-4">Brand / Request</th>
                  <th className="px-6 py-4">Type</th>
                  <th className="px-6 py-4">Sourcing</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-neutral-500">
                      Loading sample requests...
                    </td>
                  </tr>
                ) : requests.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-neutral-500">
                      No sample requests found.
                    </td>
                  </tr>
                ) : (
                  requests.map((req) => (
                    <tr
                      key={req.id}
                      onClick={() => setSelectedId(req.id)}
                      className={`cursor-pointer transition-colors ${selectedId === req.id ? "bg-blue-50/50" : "hover:bg-neutral-50"}`}
                    >
                      <td className="px-6 py-4">
                        <div className="font-bold text-neutral-900">
                          {req.companies?.name || "Unknown Brand"}
                        </div>
                        <div className="text-xs text-neutral-500">
                          {req.quantity} pcs • {Object.keys(req.size_breakdown || {}).join(", ")}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold bg-neutral-100 text-neutral-700">
                          <Beaker className="w-3.5 h-3.5" />
                          {req.sample_type}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold ${
                            req.fabric_trim_source === "Brand Sourced"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-emerald-100 text-emerald-800"
                          }`}
                        >
                          <Package className="w-3.5 h-3.5" />
                          {req.fabric_trim_source}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 capitalize">
                          {req.status.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right text-neutral-500 text-xs">
                        {new Date(req.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {selectedId && selectedRequest && (
        <div className="lg:col-span-1">
          <SampleRequestDetails
            request={selectedRequest}
            onClose={() => setSelectedId(null)}
            onUpdate={() => fetchRequests()}
          />
        </div>
      )}
    </div>
  );
}
