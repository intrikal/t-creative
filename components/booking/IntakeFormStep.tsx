"use client";

/**
 * IntakeFormStep — Renders intake form fields during the booking flow.
 *
 * Shown between time selection and confirm/pay when the selected service
 * has an active intake form definition. Supports all 6 field types and
 * pre-fills from the client's last submission for the same form.
 */

import { useState, useEffect } from "react";
import { ChevronLeft } from "lucide-react";
import type { IntakeFormField } from "@/db/schema";
import { cn } from "@/lib/utils";

type IntakeFormDefinition = {
  id: number;
  name: string;
  description: string | null;
  fields: IntakeFormField[];
  version: number;
};

type Props = {
  definitions: IntakeFormDefinition[];
  prefill: Record<number, Record<string, unknown>>;
  onSubmit: (
    responses: Array<{
      formDefinitionId: number;
      formVersion: number;
      responses: Record<string, unknown>;
    }>,
  ) => void;
  onBack: () => void;
};

export function IntakeFormStep({ definitions, prefill, onSubmit, onBack }: Props) {
  // State: one response map per form definition
  const [allResponses, setAllResponses] = useState<Record<number, Record<string, unknown>>>(() => {
    const initial: Record<number, Record<string, unknown>> = {};
    for (const def of definitions) {
      const pre = prefill[def.id] ?? {};
      const resp: Record<string, unknown> = {};
      for (const field of def.fields) {
        if (pre[field.id] !== undefined) {
          resp[field.id] = pre[field.id];
        } else if (field.type === "checkbox") {
          resp[field.id] = false;
        } else if (field.type === "multiselect") {
          resp[field.id] = [];
        } else {
          resp[field.id] = "";
        }
      }
      initial[def.id] = resp;
    }
    return initial;
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  function updateResponse(defId: number, fieldId: string, value: unknown) {
    setAllResponses((prev) => ({
      ...prev,
      [defId]: { ...prev[defId], [fieldId]: value },
    }));
    // Clear error on change
    setErrors((prev) => {
      const next = { ...prev };
      delete next[`${defId}.${fieldId}`];
      return next;
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Validate required fields
    const newErrors: Record<string, string> = {};
    for (const def of definitions) {
      for (const field of def.fields) {
        if (!field.required) continue;
        const val = allResponses[def.id]?.[field.id];
        if (val === undefined || val === null || val === "") {
          newErrors[`${def.id}.${field.id}`] = "Required";
        } else if (Array.isArray(val) && val.length === 0) {
          newErrors[`${def.id}.${field.id}`] = "Select at least one";
        }
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onSubmit(
      definitions.map((def) => ({
        formDefinitionId: def.id,
        formVersion: def.version,
        responses: allResponses[def.id] ?? {},
      })),
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          aria-label="Go back"
          className="p-2.5 rounded-lg hover:bg-stone-100 text-stone-400 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div>
          <p className="text-sm font-medium text-stone-700">A few questions before we start</p>
          <p className="text-xs text-stone-400">
            This helps us prepare for your appointment
          </p>
        </div>
      </div>

      {definitions.map((def) => (
        <div key={def.id} className="space-y-3">
          {definitions.length > 1 && (
            <p className="text-xs font-semibold text-stone-600 pt-2 border-t border-stone-100">
              {def.name}
            </p>
          )}
          {def.description && (
            <p className="text-[11px] text-stone-400 leading-relaxed">
              {def.description}
            </p>
          )}

          {def.fields.map((field) => {
            const errorKey = `${def.id}.${field.id}`;
            const hasError = !!errors[errorKey];
            const value = allResponses[def.id]?.[field.id];

            return (
              <div key={field.id} className="space-y-1">
                <label className="text-xs font-medium text-stone-600">
                  {field.label}
                  {field.required && (
                    <span className="text-red-400 ml-0.5">*</span>
                  )}
                </label>

                {field.type === "text" && (
                  <input
                    type="text"
                    value={(value as string) ?? ""}
                    onChange={(e) =>
                      updateResponse(def.id, field.id, e.target.value)
                    }
                    className={cn(
                      "w-full px-3.5 py-2.5 text-sm bg-white border rounded-xl text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#e8c4b8] focus:border-[#96604a] transition",
                      hasError ? "border-red-300" : "border-stone-200",
                    )}
                  />
                )}

                {field.type === "textarea" && (
                  <textarea
                    value={(value as string) ?? ""}
                    onChange={(e) =>
                      updateResponse(def.id, field.id, e.target.value)
                    }
                    rows={3}
                    className={cn(
                      "w-full px-3.5 py-2.5 text-sm bg-white border rounded-xl text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#e8c4b8] focus:border-[#96604a] transition resize-none",
                      hasError ? "border-red-300" : "border-stone-200",
                    )}
                  />
                )}

                {field.type === "select" && (
                  <select
                    value={(value as string) ?? ""}
                    onChange={(e) =>
                      updateResponse(def.id, field.id, e.target.value)
                    }
                    className={cn(
                      "w-full px-3.5 py-2.5 text-sm bg-white border rounded-xl text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#e8c4b8] focus:border-[#96604a] transition",
                      hasError ? "border-red-300" : "border-stone-200",
                    )}
                  >
                    <option value="">Select...</option>
                    {(field.options ?? []).map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                )}

                {field.type === "multiselect" && (
                  <div className="space-y-1.5">
                    {(field.options ?? []).map((opt) => {
                      const selected = Array.isArray(value)
                        ? (value as string[]).includes(opt)
                        : false;
                      return (
                        <label
                          key={opt}
                          className="flex items-center gap-2 text-sm text-stone-700 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => {
                              const current = Array.isArray(value)
                                ? (value as string[])
                                : [];
                              const next = selected
                                ? current.filter((v) => v !== opt)
                                : [...current, opt];
                              updateResponse(def.id, field.id, next);
                            }}
                            className="accent-[#96604a] w-3.5 h-3.5"
                          />
                          {opt}
                        </label>
                      );
                    })}
                  </div>
                )}

                {field.type === "checkbox" && (
                  <label className="flex items-center gap-2 text-sm text-stone-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!value}
                      onChange={(e) =>
                        updateResponse(def.id, field.id, e.target.checked)
                      }
                      className="accent-[#96604a] w-4 h-4"
                    />
                    Yes
                  </label>
                )}

                {field.type === "date" && (
                  <input
                    type="date"
                    value={(value as string) ?? ""}
                    onChange={(e) =>
                      updateResponse(def.id, field.id, e.target.value)
                    }
                    className={cn(
                      "w-full px-3.5 py-2.5 text-sm bg-white border rounded-xl text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#e8c4b8] focus:border-[#96604a] transition",
                      hasError ? "border-red-300" : "border-stone-200",
                    )}
                  />
                )}

                {hasError && (
                  <p className="text-[11px] text-red-500">{errors[errorKey]}</p>
                )}
              </div>
            );
          })}
        </div>
      ))}

      <button
        type="submit"
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold bg-[#96604a] text-white hover:bg-[#7a4e3a] active:scale-[0.98] transition-colors"
      >
        Continue
      </button>
    </form>
  );
}
