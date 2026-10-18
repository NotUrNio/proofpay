"use client";

import { useState, use, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Upload,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileCheck,
  Sparkles,
  Loader2,
  ShieldCheck,
  Palette,
  Image as ImageIcon,
} from "lucide-react";

export default function SubmitDeliverablePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [submitting, setSubmitting] = useState(false);
  const [activeStage, setActiveStage] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Pre-flight inspection checklist
  const [checklist, setChecklist] = useState<{
    mime: { checked: boolean; passed: boolean; label: string };
    size: { checked: boolean; passed: boolean; label: string };
    dimensions: { checked: boolean; passed: boolean; label: string };
  }>({
    mime: { checked: false, passed: false, label: "PNG Image format" },
    size: { checked: false, passed: false, label: "Under 2MB file size" },
    dimensions: { checked: false, passed: false, label: "1080×1080 resolution (1:1)" },
  });

  const [form, setForm] = useState({
    width: 1080,
    height: 1080,
    mimeType: "image/png",
    fileSizeBytes: 524288,
    fileName: "summer_sale_banner.png",
    base64Data: "",
  });

  const [outcome, setOutcome] = useState<{
    decision: string;
    reasoning: string;
    fixGuidance?: string;
    jobStatus: string;
  } | null>(null);

  const inspectFile = (file: File) => {
    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    const isPng = file.type === "image/png" || file.name.endsWith(".png");
    const isSizeOk = file.size <= 2097152;

    const img = new Image();
    img.onload = () => {
      const isDimOk = img.width === 1080 && img.height === 1080;
      setChecklist({
        mime: {
          checked: true,
          passed: isPng,
          label: isPng ? "PNG image verified" : `Detected ${file.type || "non-PNG"} (PNG required)`,
        },
        size: {
          checked: true,
          passed: isSizeOk,
          label: `${(file.size / 1024).toFixed(0)} KB (${isSizeOk ? "Within 2MB limit" : "Exceeds 2MB limit"})`,
        },
        dimensions: {
          checked: true,
          passed: isDimOk,
          label: `${img.width}×${img.height} px (${isDimOk ? "Exact 1:1 match" : "Expected 1080×1080"})`,
        },
      });

      // Convert to base64
      const reader = new FileReader();
      reader.onloadend = () => {
        setForm({
          width: img.width,
          height: img.height,
          mimeType: file.type || "image/png",
          fileSizeBytes: file.size,
          fileName: file.name,
          base64Data: reader.result as string,
        });
      };
      reader.readAsDataURL(file);
    };
    img.src = url;
  };

  const loadSampleFixture = async (path: string, fileName: string) => {
    try {
      const res = await fetch(path);
      const blob = await res.blob();
      const file = new File([blob], fileName, { type: "image/png" });
      inspectFile(file);
    } catch (err) {
      console.error("Failed to load sample fixture:", err);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      inspectFile(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.base64Data && !selectedFile) return;

    setSubmitting(true);
    setOutcome(null);

    try {
      setActiveStage("Step 1: Running deterministic hard checks (aspect ratio & size)...");
      await new Promise((r) => setTimeout(r, 400));

      setActiveStage("Step 2: Multimodal visual sensor reading text and color palette...");
      const res = await fetch(`/api/jobs/${id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileBase64: form.base64Data,
          fileName: form.fileName,
          mimeType: form.mimeType,
          fileSizeBytes: form.fileSizeBytes,
          width: form.width,
          height: form.height,
        }),
      });

      setActiveStage("Step 3: Pure TypeScript Policy Guard evaluating mandate & cap...");
      const data = await res.json();

      const decision = data.verdict?.decision || data.decision || (data.job?.status === "PAID" ? "AUTO_PAY" : "REJECT");
      const reasoning = data.verdict?.reasoning || data.guardResult?.decision || data.message || "Evaluation complete.";

      let fixGuidance: string | undefined;
      if (decision === "REJECT") {
        if (reasoning.toLowerCase().includes("dimension") || reasoning.toLowerCase().includes("aspect")) {
          fixGuidance = "Export your graphic at exactly 1080×1080 pixels with a 1:1 square aspect ratio.";
        } else if (reasoning.toLowerCase().includes("palette") || reasoning.toLowerCase().includes("color")) {
          fixGuidance = "Adjust the dominant background and brand accents to match brand blue (#0070BA).";
        } else if (reasoning.toLowerCase().includes("injection")) {
          fixGuidance = "Remove system override commands or automated payout instructions from image text.";
        } else {
          fixGuidance = "Review contract rubric guidelines and re-upload deliverable.";
        }
      }

      setOutcome({
        decision,
        reasoning,
        fixGuidance,
        jobStatus: data.job?.status || "UPDATED",
      });
    } catch (err: any) {
      console.error("Submission failed:", err);
      setOutcome({
        decision: "ERROR",
        reasoning: err.message || "Submission failed unexpectedly.",
        fixGuidance: "Check sandbox connection and retry.",
        jobStatus: "ERROR",
      });
    } finally {
      setSubmitting(false);
      setActiveStage("");
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Back Link */}
      <Link
        href={`/jobs/${id}`}
        className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back to milestone pipeline</span>
      </Link>

      <div className="bg-[#161B22] border border-[#30363D] rounded-2xl p-6 sm:p-8 shadow-xl space-y-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Submit Milestone Deliverable
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-400">
            Submitting as <strong>Priya (Freelancer)</strong>. Once uploaded, the fail-closed verification pipeline inspects your deliverable against the client&apos;s contract policy.
          </p>
        </div>

        {/* Quick Sample Deliverable Gallery */}
        <div className="bg-[#0D1117] border border-[#21262D] rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-300 font-semibold">
            <span>Quick Test Fixtures (No file needed):</span>
            <span className="text-[10px] text-slate-500 font-normal">Click to test instantly</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <button
              type="button"
              onClick={() => loadSampleFixture("/demo/happy-path.png", "summer_sale_compliant.png")}
              className="p-2 rounded-lg bg-[#161B22] border border-emerald-800/80 hover:border-emerald-500 text-left transition-colors"
            >
              <div className="font-semibold text-emerald-400 text-[11px]">Compliant Banner</div>
              <div className="text-[10px] text-slate-400">1080×1080 • Brand Blue</div>
            </button>
            <button
              type="button"
              onClick={() => loadSampleFixture("/demo/wrong-size.png", "wrong_dim_1080x1079.png")}
              className="p-2 rounded-lg bg-[#161B22] border border-rose-800/80 hover:border-rose-500 text-left transition-colors"
            >
              <div className="font-semibold text-rose-400 text-[11px]">Wrong Size</div>
              <div className="text-[10px] text-slate-400">1080×1079 • Fails check</div>
            </button>
            <button
              type="button"
              onClick={() => loadSampleFixture("/demo/prompt-injection.png", "prompt_injection.png")}
              className="p-2 rounded-lg bg-[#161B22] border border-purple-800/80 hover:border-purple-500 text-left transition-colors"
            >
              <div className="font-semibold text-purple-400 text-[11px]">Prompt Injection</div>
              <div className="text-[10px] text-slate-400">Override attack text</div>
            </button>
            <button
              type="button"
              onClick={() => loadSampleFixture("/demo/borderline-color.png", "borderline_crimson.png")}
              className="p-2 rounded-lg bg-[#161B22] border border-amber-800/80 hover:border-amber-500 text-left transition-colors"
            >
              <div className="font-semibold text-amber-400 text-[11px]">Borderline Color</div>
              <div className="text-[10px] text-slate-400">&Delta;E = 11.69 &bull; Gray zone</div>
            </button>
          </div>
        </div>

        {/* Drag & Drop Upload Zone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
            isDragOver
              ? "border-blue-500 bg-blue-950/20"
              : selectedFile
              ? "border-emerald-600/60 bg-emerald-950/10"
              : "border-[#30363D] hover:border-slate-500 bg-[#0D1117]"
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => e.target.files?.[0] && inspectFile(e.target.files[0])}
            accept="image/png"
            className="hidden"
          />

          {previewUrl ? (
            <div className="space-y-3">
              <div className="max-h-48 max-w-xs mx-auto rounded-lg overflow-hidden border border-[#30363D] bg-black/40 flex items-center justify-center">
                <img src={previewUrl} alt="Preview" className="max-h-48 object-contain" />
              </div>
              <div className="text-xs text-white font-medium">
                {form.fileName} ({form.width}×{form.height} px)
              </div>
              <span className="text-[11px] text-blue-400 underline">
                Click or drop another image to replace
              </span>
            </div>
          ) : (
            <div className="space-y-2 py-4">
              <Upload className="w-8 h-8 text-slate-400 mx-auto" />
              <div className="text-sm font-semibold text-white">
                Drag & drop your deliverable here, or browse files
              </div>
              <p className="text-xs text-slate-400">
                Supports PNG images up to 2MB. Recommended: 1080×1080 square.
              </p>
            </div>
          )}
        </div>

        {/* Pre-Flight Inspection Checklist */}
        <div className="bg-[#0D1117] border border-[#21262D] rounded-xl p-4 space-y-2.5">
          <div className="text-xs font-semibold text-slate-300">
            Pre-Flight Deliverable Checklist:
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
            <div className="flex items-center gap-2 p-2 rounded-lg bg-[#161B22] border border-[#30363D]">
              {checklist.mime.checked ? (
                checklist.mime.passed ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                )
              ) : (
                <div className="w-4 h-4 rounded-full border border-slate-600 flex-shrink-0" />
              )}
              <span className="truncate text-slate-300">{checklist.mime.label}</span>
            </div>

            <div className="flex items-center gap-2 p-2 rounded-lg bg-[#161B22] border border-[#30363D]">
              {checklist.size.checked ? (
                checklist.size.passed ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                )
              ) : (
                <div className="w-4 h-4 rounded-full border border-slate-600 flex-shrink-0" />
              )}
              <span className="truncate text-slate-300">{checklist.size.label}</span>
            </div>

            <div className="flex items-center gap-2 p-2 rounded-lg bg-[#161B22] border border-[#30363D]">
              {checklist.dimensions.checked ? (
                checklist.dimensions.passed ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                )
              ) : (
                <div className="w-4 h-4 rounded-full border border-slate-600 flex-shrink-0" />
              )}
              <span className="truncate text-slate-300">{checklist.dimensions.label}</span>
            </div>
          </div>
        </div>

        {/* Live Multi-Stage Verification Active Banner */}
        {submitting && (
          <div className="bg-[#161B22] border border-blue-500/60 rounded-xl p-4 flex items-center gap-3 animate-pulse">
            <Loader2 className="w-5 h-5 text-blue-400 animate-spin flex-shrink-0" />
            <div className="text-xs">
              <span className="text-slate-400 font-medium">Verifying in real time: </span>
              <span className="font-semibold text-white">{activeStage}</span>
            </div>
          </div>
        )}

        {/* Outcome Card with Plain-Language Guidance */}
        {outcome && (
          <div className="bg-[#161B22] border border-[#30363D] rounded-2xl p-5 space-y-3 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {outcome.decision === "AUTO_PAY" ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                ) : outcome.decision === "NEEDS_HUMAN" ? (
                  <AlertTriangle className="w-5 h-5 text-amber-400" />
                ) : (
                  <XCircle className="w-5 h-5 text-rose-400" />
                )}
                <h3 className="font-bold text-sm text-white">
                  {outcome.decision === "AUTO_PAY" && "Approved & Paid Out Instantly"}
                  {outcome.decision === "NEEDS_HUMAN" && "Needs Human Review (Gray Zone)"}
                  {outcome.decision === "REJECT" && "Deliverable Not Approved"}
                </h3>
              </div>

              <Link
                href={`/jobs/${id}`}
                className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1"
              >
                <span>Inspect Checkpoint Route</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <p className="text-xs text-slate-300 font-mono bg-[#0D1117] p-3 rounded-lg border border-[#21262D]">
              {outcome.reasoning}
            </p>

            {outcome.fixGuidance && (
              <div className="bg-rose-950/40 border border-rose-900/60 rounded-lg p-3 text-xs text-rose-300 space-y-1">
                <span className="font-semibold block text-white">How to fix this:</span>
                <p>{outcome.fixGuidance}</p>
              </div>
            )}
          </div>
        )}

        {/* Action Button */}
        <div className="flex items-center justify-end pt-2">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || (!selectedFile && !form.base64Data)}
            className={`px-6 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              submitting || (!selectedFile && !form.base64Data)
                ? "bg-[#21262D] text-slate-500 cursor-not-allowed border border-[#30363D]"
                : "bg-[#2EA043] hover:bg-[#238636] text-white shadow-md"
            }`}
          >
            {submitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Running Verification Pipeline...</span>
              </>
            ) : (
              <>
                <FileCheck className="w-3.5 h-3.5" />
                <span>Submit Deliverable for Instant Verification</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
