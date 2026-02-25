"use client";

import { useState, useEffect } from "react";
import { X, Check } from "lucide-react";
import type { ContactRow } from "@/app/dashboard/messages/actions";
import { getVisibleContacts, createThread } from "@/app/dashboard/messages/actions";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { Dialog, Field, Input, Textarea, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface ComposeDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: (threadId: number) => void;
}

export function ComposeDialog({ open, onClose, onCreated }: ComposeDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} title="New message" size="lg">
      {open && <ComposeForm onClose={onClose} onCreated={onCreated} />}
    </Dialog>
  );
}

function ComposeForm({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (threadId: number) => void;
}) {
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [selected, setSelected] = useState<ContactRow[]>([]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);

  useEffect(() => {
    getVisibleContacts().then(setContacts);
  }, []);

  function toggleContact(contact: ContactRow) {
    setSelected((prev) =>
      prev.some((c) => c.id === contact.id)
        ? prev.filter((c) => c.id !== contact.id)
        : [...prev, contact],
    );
  }

  function removeContact(id: string) {
    setSelected((prev) => prev.filter((c) => c.id !== id));
  }

  async function handleSend() {
    if (!subject.trim() || !body.trim() || selected.length === 0) return;
    setSending(true);
    try {
      const { threadId } = await createThread({
        subject: subject.trim(),
        participantIds: selected.map((c) => c.id),
        body: body.trim(),
      });
      onCreated(threadId);
      onClose();
    } catch {
      setSending(false);
    }
  }

  const roleBadge = (role: string) => {
    const cfg: Record<string, string> = {
      admin: "bg-accent/12 text-accent",
      assistant: "bg-purple-50 text-purple-700",
      client: "bg-foreground/8 text-muted",
    };
    return cfg[role] ?? cfg.client;
  };

  return (
    <>
      <div className="space-y-4">
        {/* Recipients */}
        <Field label="To" required>
          <div className="flex flex-wrap items-center gap-1.5 min-h-[38px] px-3 py-1.5 bg-surface border border-border rounded-lg">
            {selected.map((c) => (
              <span
                key={c.id}
                className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-accent/10 text-accent rounded-full"
              >
                {c.firstName} {c.lastName}
                <button
                  onClick={() => removeContact(c.id)}
                  className="hover:text-destructive transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
              <PopoverTrigger asChild>
                <button className="text-sm text-muted hover:text-foreground transition-colors px-1 py-0.5">
                  {selected.length === 0 ? "Select contacts..." : "+"}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search contacts..." />
                  <CommandList>
                    <CommandEmpty>No contacts found.</CommandEmpty>
                    <CommandGroup>
                      {contacts.map((contact) => {
                        const isSelected = selected.some((s) => s.id === contact.id);
                        return (
                          <CommandItem
                            key={contact.id}
                            value={`${contact.firstName} ${contact.lastName} ${contact.email}`}
                            onSelect={() => toggleContact(contact)}
                          >
                            <div
                              className={cn(
                                "flex h-4 w-4 items-center justify-center rounded border border-border mr-1",
                                isSelected && "bg-accent border-accent text-white",
                              )}
                            >
                              {isSelected && <Check className="w-3 h-3" />}
                            </div>
                            <span className="flex-1 truncate">
                              {contact.firstName} {contact.lastName}
                            </span>
                            <span
                              className={cn(
                                "text-[10px] px-1.5 py-0.5 rounded-full capitalize",
                                roleBadge(contact.role),
                              )}
                            >
                              {contact.role}
                            </span>
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </Field>

        {/* Subject */}
        <Field label="Subject" required>
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="What's this about?"
          />
        </Field>

        {/* Message */}
        <Field label="Message" required>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write your message..."
            rows={5}
          />
        </Field>
      </div>

      <DialogFooter
        onCancel={onClose}
        onConfirm={handleSend}
        confirmLabel={sending ? "Sending..." : "Send"}
        disabled={sending || !subject.trim() || !body.trim() || selected.length === 0}
      />
    </>
  );
}
