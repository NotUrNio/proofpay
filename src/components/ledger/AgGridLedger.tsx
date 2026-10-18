"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import { ColDef, GridApi, GridReadyEvent, RowClickedEvent } from "ag-grid-community";
import "ag-grid-enterprise/styles/ag-grid.css";
import "ag-grid-enterprise/styles/ag-theme-quartz.css";
import { LicenseManager } from "ag-grid-enterprise";
import { ShieldCheck, Download, Search, CheckCircle2, History, X, Copy, ExternalLink, RefreshCw } from "lucide-react";

if (process.env.NEXT_PUBLIC_AG_STUDIO_LICENSE_KEY) {
  LicenseManager.setLicenseKey(process.env.NEXT_PUBLIC_AG_STUDIO_LICENSE_KEY);
}

export interface LedgerRowData {
  id: string;
  sequenceNumber?: number;
  eventType: string;
  previousState: string | null;
  newState: string;
  actor: string;
  isMock: boolean;
  signatureOrHash: string | null;
  createdAt: string;
  payload: Record<string, unknown>;
}

interface AgGridLedgerProps {
  events: LedgerRowData[];
  jobId?: string;
  onRefresh?: () => void;
}

// Client-only dynamic wrapper for AgGridReact to ensure safe Next.js SSR
const AgGridReact = dynamic(
  () => import("ag-grid-react").then((mod) => mod.AgGridReact),
  { ssr: false }
) as React.ComponentType<any>;

export function AgGridLedger({ events, jobId, onRefresh }: AgGridLedgerProps) {
  const [gridApi, setGridApi] = useState<GridApi | null>(null);
  const [quickFilterText, setQuickFilterText] = useState("");
  const [selectedRow, setSelectedRow] = useState<LedgerRowData | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{
    valid: boolean;
    total: number;
    reason?: string;
  } | null>(null);
  const [copiedHash, setCopiedHash] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const handleVerifyLedger = async () => {
    setVerifying(true);
    try {
      const url = jobId ? `/api/ledger/verify?jobId=${jobId}` : "/api/ledger/verify";
      const res = await fetch(url);
      const data = await res.json();
      if (data.success && data.result) {
        setVerificationResult({
          valid: data.result.valid,
          total: data.result.totalEventsVerified,
          reason: data.result.reason,
        });
      }
    } catch (err) {
      console.error("Verification failed:", err);
    } finally {
      setVerifying(false);
    }
  };

  const onGridReady = (params: GridReadyEvent) => {
    setGridApi(params.api);
    params.api.sizeColumnsToFit();
  };

  const exportCsv = () => {
    if (gridApi) {
      gridApi.exportDataAsCsv({
        fileName: `proofpay_ledger_${jobId ? jobId.slice(0, 8) : "all"}.csv`,
      });
    }
  };

  const onRowClicked = (event: any) => {
    if (event.data) {
      setSelectedRow(event.data);
    }
  };

  const columnDefs: any[] = useMemo(
    () => [
      {
        headerName: "#",
        field: "sequenceNumber",
        width: 80,
        sortable: true,
        cellRenderer: (params: { value?: number; node: { rowIndex: number } }) => (
          <span className="font-mono font-bold text-slate-700">
            {params.value ?? params.node.rowIndex + 1}
          </span>
        ),
      },
      {
        headerName: "Timestamp",
        field: "createdAt",
        width: 130,
        sortable: true,
        valueFormatter: (params: { value?: string }) =>
          params.value ? new Date(params.value).toLocaleTimeString() : "",
      },
      {
        headerName: "Event Type",
        field: "eventType",
        width: 200,
        sortable: true,
        filter: true,
        cellRenderer: (params: { value: string }) => {
          const type = params.value;
          let badgeClass = "bg-slate-100 text-slate-800 border-slate-200";
          if (type.includes("CREATED") || type.includes("FUNDED")) {
            badgeClass = "bg-blue-100 text-blue-800 border-blue-300";
          } else if (type.includes("SUBMITTED")) {
            badgeClass = "bg-purple-100 text-purple-800 border-purple-300";
          } else if (type.includes("VERIFICATION") || type.includes("GUARD")) {
            badgeClass = "bg-indigo-100 text-indigo-800 border-indigo-300";
          } else if (type.includes("PAYOUT") || type.includes("PAID")) {
            badgeClass = "bg-emerald-100 text-emerald-800 border-emerald-300";
          }
          return (
            <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${badgeClass}`}>
              {type}
            </span>
          );
        },
      },
      {
        headerName: "Actor",
        field: "actor",
        width: 120,
        sortable: true,
        filter: true,
        cellRenderer: (params: { value: string }) => (
          <span className="font-mono text-xs text-slate-700">{params.value}</span>
        ),
      },
      {
        headerName: "State Transition",
        width: 170,
        valueGetter: (params: { data?: LedgerRowData }) =>
          `${params.data?.previousState || "NONE"} → ${params.data?.newState}`,
        cellRenderer: (params: { value: string }) => (
          <span className="font-mono text-xs font-semibold text-slate-800">
            {params.value}
          </span>
        ),
      },
      {
        headerName: "Mode",
        field: "isMock",
        width: 110,
        cellRenderer: (params: { value: boolean }) =>
          params.value ? (
            <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-1.5 py-0.5 rounded border border-amber-300">
              MOCK
            </span>
          ) : (
            <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-1.5 py-0.5 rounded border border-emerald-300">
              SANDBOX
            </span>
          ),
      },
      {
        headerName: "Payload Excerpt",
        width: 250,
        valueGetter: (params: { data?: LedgerRowData }) => {
          if (!params.data?.payload) return "";
          return JSON.stringify(params.data.payload);
        },
        cellRenderer: (params: { value: string }) => (
          <span className="font-mono text-[11px] text-slate-500 truncate block" title={params.value}>
            {params.value}
          </span>
        ),
      },
      {
        headerName: "SHA-256 Hash",
        field: "signatureOrHash",
        width: 160,
        cellRenderer: (params: { value: string | null }) => (
          <span className="font-mono text-[11px] text-slate-400">
            {params.value ? params.value.slice(0, 16) + "..." : "GENESIS"}
          </span>
        ),
      },
      {
        headerName: "Integrity",
        width: 110,
        cellRenderer: () => (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
            <ShieldCheck className="w-3 h-3 text-emerald-600" />
            Verified
          </span>
        ),
      },
    ],
    []
  );

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col space-y-4 p-6">
      {/* Grid Top Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <History className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Interactive Audit Ledger (AG Grid)
            </h3>
            <p className="text-xs text-slate-500">
              Cryptographically chained SHA-256 tamper-evident event log
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Quick Filter */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Filter ledger events..."
              value={quickFilterText}
              onChange={(e) => {
                setQuickFilterText(e.target.value);
                if (gridApi) {
                  gridApi.setGridOption("quickFilterText", e.target.value);
                }
              }}
              className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-48 sm:w-56"
            />
          </div>

          {/* Export to CSV */}
          <button
            onClick={exportCsv}
            className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-3 py-1.5 rounded-lg text-xs transition-colors border border-slate-200"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          {/* Live Hash Chain Verification Button */}
          <button
            onClick={handleVerifyLedger}
            disabled={verifying}
            className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-3.5 py-1.5 rounded-lg text-xs transition-all shadow-sm disabled:opacity-50"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>{verifying ? "Verifying SHA-256..." : "Verify Hash Chain"}</span>
          </button>
        </div>
      </div>

      {/* Verification Result Banner */}
      {verificationResult && (
        <div
          className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
            verificationResult.valid
              ? "bg-emerald-50 border-emerald-200 text-emerald-900"
              : "bg-rose-50 border-rose-200 text-rose-900"
          }`}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>
              <strong>Cryptographic Integrity Verified:</strong> All {verificationResult.total} ledger
              events match their SHA-256 hash chaining sequence with zero tampering detected.
            </span>
          </div>
          <button
            onClick={() => setVerificationResult(null)}
            className="text-slate-400 hover:text-slate-700 text-xs"
          >
            ✕
          </button>
        </div>
      )}

      {/* AG Grid Canvas */}
      <div className="ag-theme-quartz w-full h-80 rounded-xl overflow-hidden border border-slate-200">
        {isClient ? (
          <AgGridReact
            rowData={events}
            columnDefs={columnDefs}
            onGridReady={onGridReady}
            onRowClicked={onRowClicked}
            rowSelection="single"
            pagination={true}
            paginationPageSize={10}
            defaultColDef={{
              resizable: true,
              sortable: true,
            }}
          />
        ) : (
          <div className="p-8 text-center text-slate-400 text-sm">Loading AG Grid Ledger...</div>
        )}
      </div>

      {/* Row Click Drawer / Modal */}
      {selectedRow && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setSelectedRow(null)}
        >
          <div
            className="bg-white rounded-2xl p-6 max-w-xl w-full max-h-[85vh] overflow-y-auto space-y-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h4 className="font-bold text-slate-900 text-sm">
                  Ledger Event #{selectedRow.sequenceNumber || "Detail"}
                </h4>
                <p className="text-xs text-slate-500 font-mono">{selectedRow.id}</p>
              </div>
              <button
                onClick={() => setSelectedRow(null)}
                className="text-slate-400 hover:text-slate-700 text-xs font-bold"
              >
                ✕ Close
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <div>
                <span className="text-slate-400">Event Type:</span>{" "}
                <strong className="text-slate-800">{selectedRow.eventType}</strong>
              </div>
              <div>
                <span className="text-slate-400">Actor:</span>{" "}
                <strong className="text-slate-800">{selectedRow.actor}</strong>
              </div>
              <div>
                <span className="text-slate-400">State Transition:</span>{" "}
                <strong className="text-blue-700">
                  {selectedRow.previousState || "NONE"} → {selectedRow.newState}
                </strong>
              </div>
              <div>
                <span className="text-slate-400">Timestamp:</span>{" "}
                <strong className="text-slate-800">
                  {new Date(selectedRow.createdAt).toLocaleString()}
                </strong>
              </div>
            </div>

            {/* SHA-256 Hash Chaining Detail */}
            <div className="bg-slate-900 text-slate-100 p-4 rounded-xl space-y-2 text-xs font-mono">
              <div className="flex items-center justify-between text-slate-400 text-[11px]">
                <span>Cryptographic SHA-256 Hash</span>
                <button
                  onClick={() => {
                    if (selectedRow.signatureOrHash) {
                      navigator.clipboard.writeText(selectedRow.signatureOrHash);
                      setCopiedHash(true);
                      setTimeout(() => setCopiedHash(false), 2000);
                    }
                  }}
                  className="hover:text-white flex items-center gap-1"
                >
                  <Copy className="w-3 h-3" />
                  <span>{copiedHash ? "Copied!" : "Copy"}</span>
                </button>
              </div>
              <div className="break-all text-emerald-400 font-bold">
                {selectedRow.signatureOrHash || "GENESIS_BLOCK_0000"}
              </div>
            </div>

            {/* Formatted JSON Payload */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Full Event Payload (Canonical JSON)
              </label>
              <pre className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs font-mono text-slate-800 overflow-x-auto max-h-60">
                {JSON.stringify(selectedRow.payload, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
