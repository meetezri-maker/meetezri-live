import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { X, UserPlus, Upload, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BulkAddUserRow {
  email: string;
  full_name: string;
}

interface BulkAddUsersModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (rows: BulkAddUserRow[], defaults: {
    status: "active" | "suspended" | "inactive";
    subscription: "trial" | "core" | "pro";
  }) => Promise<void>;
  isSubmitting?: boolean;
}

function parseBulkUserInput(raw: string): { rows: BulkAddUserRow[]; errors: string[] } {
  const errors: string[] = [];
  const rows: BulkAddUserRow[] = [];
  const seen = new Set<string>();

  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  lines.forEach((line, index) => {
    const lineNo = index + 1;
    const parts = line.includes(",")
      ? line.split(",").map((p) => p.trim())
      : line.split(/\t+/).map((p) => p.trim());

    let full_name = "";
    let email = "";

    if (parts.length >= 2) {
      full_name = parts[0] ?? "";
      email = parts[1] ?? "";
    } else if (parts.length === 1) {
      email = parts[0] ?? "";
      full_name = email.split("@")[0] || "User";
    }

    if (!email) {
      errors.push(`Line ${lineNo}: missing email`);
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push(`Line ${lineNo}: invalid email "${email}"`);
      return;
    }
    const key = email.toLowerCase();
    if (seen.has(key)) {
      errors.push(`Line ${lineNo}: duplicate email "${email}"`);
      return;
    }
    seen.add(key);
    rows.push({
      email: key,
      full_name: full_name.trim() || email.split("@")[0] || "User",
    });
  });

  return { rows, errors };
}

export function BulkAddUsersModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting = false,
}: BulkAddUsersModalProps) {
  const [rawInput, setRawInput] = useState("");
  const [status, setStatus] = useState<"active" | "suspended" | "inactive">("active");
  const [subscription, setSubscription] = useState<"trial" | "core" | "pro">("trial");
  const [parseErrors, setParseErrors] = useState<string[]>([]);

  const handleClose = () => {
    if (isSubmitting) return;
    setRawInput("");
    setParseErrors([]);
    onClose();
  };

  const handleSubmit = async () => {
    const { rows, errors } = parseBulkUserInput(rawInput);
    if (errors.length > 0) {
      setParseErrors(errors);
      return;
    }
    if (rows.length === 0) {
      setParseErrors(["Enter at least one user (name,email per line)."]);
      return;
    }
    if (rows.length > 50) {
      setParseErrors(["Maximum 50 users per batch."]);
      return;
    }
    setParseErrors([]);
    await onSubmit(rows, { status, subscription });
    setRawInput("");
  };

  const preview = parseBulkUserInput(rawInput);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={handleClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl"
          >
            <Card className="max-h-[90vh] overflow-y-auto p-6">
              <div className="mb-6 flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Upload className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">Add Multiple Users</h2>
                    <p className="text-sm text-muted-foreground">
                      One user per line: Name, email@example.com
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleClose}
                  disabled={isSubmitting}
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium">
                    Users <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    className={cn(
                      "min-h-[160px] w-full rounded-lg border bg-input-background px-3 py-2 text-sm",
                      "focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                    )}
                    placeholder={`Jane Doe, jane@example.com\nJohn Smith, john@example.com\nor just: user@mail.com`}
                    value={rawInput}
                    onChange={(e) => {
                      setRawInput(e.target.value);
                      setParseErrors([]);
                    }}
                    disabled={isSubmitting}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Up to 50 users. Invites are sent for each new account.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium">Default status</label>
                    <select
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                      value={status}
                      onChange={(e) =>
                        setStatus(e.target.value as "active" | "suspended" | "inactive")
                      }
                      disabled={isSubmitting}
                    >
                      <option value="active">Active</option>
                      <option value="suspended">Suspended</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium">Default plan</label>
                    <select
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                      value={subscription}
                      onChange={(e) =>
                        setSubscription(e.target.value as "trial" | "core" | "pro")
                      }
                      disabled={isSubmitting}
                    >
                      <option value="trial">Trial</option>
                      <option value="core">Grow</option>
                      <option value="pro">Thrive</option>
                    </select>
                  </div>
                </div>

                {parseErrors.length > 0 && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    <div className="mb-1 flex items-center gap-2 font-medium">
                      <AlertCircle className="h-4 w-4" />
                      Fix these issues
                    </div>
                    <ul className="list-inside list-disc space-y-0.5">
                      {parseErrors.map((err) => (
                        <li key={err}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {preview.rows.length > 0 && parseErrors.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Ready to invite <strong>{preview.rows.length}</strong> user
                    {preview.rows.length !== 1 ? "s" : ""} on the{" "}
                    <strong className="capitalize">{subscription}</strong> plan.
                  </p>
                )}
              </div>

              <div className="mt-6 flex justify-end gap-3 border-t pt-6">
                <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  className="gap-2"
                  disabled={isSubmitting}
                  onClick={handleSubmit}
                >
                  <UserPlus className="h-4 w-4" />
                  {isSubmitting ? "Adding…" : "Add Users"}
                </Button>
              </div>
            </Card>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
