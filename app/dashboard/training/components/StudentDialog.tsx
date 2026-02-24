"use client";

import { useState } from "react";
import { Dialog, Field, Input, Select, DialogFooter } from "@/components/ui/dialog";
import type { ProgramRow, ClientOption, StudentStatus, EnrollmentFormData } from "../actions";

export function StudentDialog({
  open,
  onClose,
  onSave,
  programs,
  clients,
  saving,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (data: EnrollmentFormData) => void;
  programs: ProgramRow[];
  clients: ClientOption[];
  saving: boolean;
}) {
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [programId, setProgramId] = useState<number>(programs[0]?.id ?? 0);
  const [status, setStatus] = useState<StudentStatus>("active");
  const [amountPaid, setAmountPaid] = useState("0");

  const selectedProg = programs.find((p) => p.id === programId) ?? programs[0];

  return (
    <Dialog open={open} onClose={onClose} title="Add Student" size="md">
      <div className="space-y-4" key={String(open)}>
        <Field label="Client" required>
          <Select value={clientId} onChange={(e) => setClientId(e.target.value)}>
            {clients.length === 0 && <option value="">No clients available</option>}
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Program" required>
            <Select
              value={String(programId)}
              onChange={(e) => setProgramId(Number(e.target.value))}
            >
              {programs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Status">
            <Select value={status} onChange={(e) => setStatus(e.target.value as StudentStatus)}>
              <option value="waitlist">Waitlist</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="completed">Completed</option>
            </Select>
          </Field>
        </div>
        <Field label="Amount paid ($)">
          <Input
            type="number"
            value={amountPaid}
            onChange={(e) => setAmountPaid(e.target.value)}
            min={0}
          />
        </Field>
        {selectedProg && (
          <p className="text-xs text-muted bg-surface border border-border rounded-lg px-3 py-2">
            Program: <span className="text-foreground font-medium">{selectedProg.name}</span>
            {" · "}${selectedProg.price} · {selectedProg.sessions} sessions
          </p>
        )}
        <DialogFooter
          onCancel={onClose}
          onConfirm={() => {
            if (!clientId || !selectedProg) return;
            onSave({
              clientId,
              programId: selectedProg.id,
              status,
              amountPaid: Number(amountPaid) || 0,
            });
          }}
          confirmLabel="Add student"
          disabled={!clientId || saving}
        />
      </div>
    </Dialog>
  );
}
