"use client";

import { useState, useRef } from "react";
import { CheckCircle2, FileText, AlertTriangle } from "lucide-react";
import { submitWaiverForm, type WaiverPageData, type WaiverForm, type WaiverFormField } from "../actions";

/* ------------------------------------------------------------------ */
/*  Signature Pad (minimal canvas implementation)                      */
/* ------------------------------------------------------------------ */

function SignaturePad({
  value,
  onChange,
}: {
  value: string;
  onChange: (dataUrl: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);

  function getCtx() {
    return canvasRef.current?.getContext("2d") ?? null;
  }

  function startDraw(e: React.PointerEvent) {
    drawingRef.current = true;
    const ctx = getCtx();
    if (!ctx) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  }

  function draw(e: React.PointerEvent) {
    if (!drawingRef.current) return;
    const ctx = getCtx();
    if (!ctx) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#1c1917";
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
  }

  function endDraw() {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    if (canvasRef.current) {
      onChange(canvasRef.current.toDataURL("image/png"));
    }
  }

  function clear() {
    const ctx = getCtx();
    if (ctx && canvasRef.current) {
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      onChange("");
    }
  }

  return (
    <div>
      <canvas
        ref={canvasRef}
        width={400}
        height={150}
        className="w-full border border-stone-300 rounded-lg bg-white cursor-crosshair touch-none"
        onPointerDown={startDraw}
        onPointerMove={draw}
        onPointerUp={endDraw}
        onPointerLeave={endDraw}
      />
      <div className="flex justify-between items-center mt-1">
        <span className="text-[11px] text-stone-400">Sign above using your mouse or finger</span>
        {value && (
          <button
            type="button"
            onClick={clear}
            className="text-[11px] text-[#96604a] hover:underline"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Form Field Renderer                                                */
/* ------------------------------------------------------------------ */

function FormField({
  field,
  value,
  onChange,
}: {
  field: WaiverFormField;
  value: unknown;
  onChange: (val: unknown) => void;
}) {
  const baseInput =
    "w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#96604a]/30 focus:border-[#96604a]";

  switch (field.type) {
    case "text":
    case "email":
    case "phone":
      return (
        <input
          type={field.type === "phone" ? "tel" : field.type}
          value={(value as string) || ""}
          onChange={(e) => onChange(e.target.value)}
          className={baseInput}
          required={field.required}
          placeholder={field.label}
        />
      );

    case "date":
      return (
        <input
          type="date"
          value={(value as string) || ""}
          onChange={(e) => onChange(e.target.value)}
          className={baseInput}
          required={field.required}
        />
      );

    case "textarea":
      return (
        <textarea
          value={(value as string) || ""}
          onChange={(e) => onChange(e.target.value)}
          className={`${baseInput} min-h-[80px] resize-y`}
          required={field.required}
          placeholder={field.label}
        />
      );

    case "checkbox":
      return (
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={!!value}
            onChange={(e) => onChange(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-stone-300 text-[#96604a] focus:ring-[#96604a]"
          />
          <span className="text-sm text-stone-700">{field.label}</span>
        </label>
      );

    case "signature":
      return <SignaturePad value={(value as string) || ""} onChange={onChange} />;

    default:
      return (
        <input
          type="text"
          value={(value as string) || ""}
          onChange={(e) => onChange(e.target.value)}
          className={baseInput}
          placeholder={field.label}
        />
      );
  }
}

/* ------------------------------------------------------------------ */
/*  Single Waiver Form                                                 */
/* ------------------------------------------------------------------ */

function WaiverFormCard({
  form,
  token,
  onComplete,
}: {
  form: WaiverForm;
  token: string;
  onComplete: () => void;
}) {
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [completed, setCompleted] = useState(false);

  const fields = form.fields ?? [];

  function updateField(fieldId: string, value: unknown) {
    setFormData((prev) => ({ ...prev, [fieldId]: value }));
  }

  function validate(): boolean {
    for (const field of fields) {
      if (!field.required) continue;
      const val = formData[field.id];
      if (field.type === "checkbox" && !val) return false;
      if (field.type === "signature" && !val) return false;
      if (field.type !== "checkbox" && field.type !== "signature" && (!val || !(val as string).trim())) return false;
    }
    return true;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) {
      setError("Please complete all required fields.");
      return;
    }

    setSubmitting(true);
    setError("");

    const signatureField = fields.find((f) => f.type === "signature");
    const signatureDataUrl = signatureField ? (formData[signatureField.id] as string) : undefined;

    // Remove signature from data payload (stored separately)
    const dataPayload = { ...formData };
    if (signatureField) delete dataPayload[signatureField.id];

    const result = await submitWaiverForm(token, form.id, dataPayload, signatureDataUrl);

    if (result.success) {
      setCompleted(true);
      onComplete();
    } else {
      setError(result.error || "Something went wrong. Please try again.");
    }
    setSubmitting(false);
  }

  if (completed) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-stone-900">{form.name}</h3>
            <p className="text-xs text-emerald-600">Completed</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden"
    >
      <div className="px-6 pt-6 pb-4 border-b border-stone-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#faf6f1] flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5 text-[#96604a]" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-stone-900">{form.name}</h3>
            <span className="text-[10px] uppercase tracking-wide text-stone-400 font-medium">
              {form.type}
            </span>
          </div>
        </div>
        {form.description && (
          <p className="text-sm text-stone-500 mt-3 leading-relaxed">{form.description}</p>
        )}
      </div>

      <div className="px-6 py-5 space-y-4">
        {fields.map((field) => (
          <div key={field.id}>
            {field.type !== "checkbox" && (
              <label className="block text-sm font-medium text-stone-700 mb-1.5">
                {field.label}
                {field.required && <span className="text-red-500 ml-0.5">*</span>}
              </label>
            )}
            <FormField
              field={field}
              value={formData[field.id]}
              onChange={(val) => updateField(field.id, val)}
            />
          </div>
        ))}

        {error && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200/50 rounded-lg px-3 py-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-2.5 rounded-xl bg-[#96604a] text-white text-sm font-medium hover:bg-[#7a4e3a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? "Submitting..." : "Sign & Submit"}
        </button>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Page Component                                                */
/* ------------------------------------------------------------------ */

export function WaiverCompletionPage({
  data,
  token,
}: {
  data: WaiverPageData;
  token: string;
}) {
  const [completedCount, setCompletedCount] = useState(0);
  const totalForms = data.forms.length;
  const allDone = completedCount === totalForms;

  return (
    <div className="min-h-screen bg-[#faf6f1]">
      <div className="max-w-lg mx-auto px-4 py-8 sm:py-12">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-stone-900 mb-1">T Creative Studio</h1>
          <p className="text-sm text-stone-500">Complete your required waivers</p>
        </div>

        {/* Appointment info */}
        <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-5 mb-6">
          <div className="flex items-center justify-between text-sm">
            <span className="text-stone-500">Service</span>
            <span className="font-medium text-stone-900">{data.serviceName}</span>
          </div>
          <div className="flex items-center justify-between text-sm mt-2">
            <span className="text-stone-500">Appointment</span>
            <span className="font-medium text-stone-900">{data.appointmentDate}</span>
          </div>
          <div className="flex items-center justify-between text-sm mt-2">
            <span className="text-stone-500">Progress</span>
            <span className="font-medium text-stone-900">
              {completedCount} of {totalForms} completed
            </span>
          </div>
          <div className="flex gap-1 mt-3">
            {data.forms.map((_, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                  i < completedCount ? "bg-emerald-500" : "bg-stone-200"
                }`}
              />
            ))}
          </div>
        </div>

        {allDone ? (
          <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-8 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-7 h-7 text-emerald-600" />
            </div>
            <h2 className="text-lg font-semibold text-stone-900 mb-1">All Done!</h2>
            <p className="text-sm text-stone-500 max-w-xs mx-auto leading-relaxed">
              You&apos;ve completed all required waivers. Your appointment can now be confirmed.
              We&apos;ll be in touch soon!
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {data.forms.map((form) => (
              <WaiverFormCard
                key={form.id}
                form={form}
                token={token}
                onComplete={() => setCompletedCount((c) => c + 1)}
              />
            ))}
          </div>
        )}

        <p className="text-center text-xs text-stone-400 mt-8">
          By signing, you acknowledge that you have read and understand the terms above.
          <br />
          Your submission is encrypted and stored securely.
        </p>
      </div>
    </div>
  );
}
