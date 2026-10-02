"use client";

import { useEffect, useState } from "react";
import {
  DownloadIcon,
  ExternalLinkIcon,
  HistoryIcon,
  Loader2Icon,
  MailIcon,
  SendIcon,
  Trash2Icon,
} from "lucide-react";

import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  formPdfUrl,
  type FormBackup,
  type FormVersion,
} from "@/lib/accountability-forms";
import { errorMessage } from "@/lib/inventory-api";
import { formatDate } from "@/lib/laptops";
import { cn } from "@/lib/utils";

export function formatSentAt(iso: string) {
  const date = new Date(iso);
  return `${formatDate(date)}, ${date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
}

async function sendForm(formId: string, to: string) {
  const response = await fetch(`/api/accountability-forms/${formId}/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ to }),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    throw new Error(body.error ?? `Couldn't send the email (${response.status}).`);
  }
}

export function SendFormDialog({
  form,
  defaultEmail,
  open,
  onOpenChange,
  onSent,
}: {
  form: FormVersion | null;
  defaultEmail: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSent: (to: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100svh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
        {form && open && (
          <SendForm form={form} defaultEmail={defaultEmail} onSent={onSent} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function SendForm({
  form,
  defaultEmail,
  onSent,
}: {
  form: FormVersion;
  defaultEmail: string | null;
  onSent: (to: string) => void;
}) {
  const [to, setTo] = useState(defaultEmail ?? "");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="flex min-h-0 flex-col"
      onSubmit={async (event) => {
        event.preventDefault();
        setSending(true);
        setError(null);
        try {
          await sendForm(form.id, to.trim());
          onSent(to.trim());
        } catch (err) {
          setError(errorMessage(err));
          setSending(false);
        }
      }}
    >
      <DialogHeader className="border-b border-border px-6 py-5 pr-12">
        <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
          <MailIcon className="size-4" />
          Send a copy
        </DialogTitle>
        <DialogDescription>
          Accountability form v{form.version} for {form.holderName}, attached
          as a PDF.
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-1.5 px-6 py-5">
        <Label htmlFor="send-to" className="text-xs">
          Email address
        </Label>
        <Input
          id="send-to"
          type="email"
          value={to}
          onChange={(event) => setTo(event.target.value)}
          placeholder="name@ardentparalegal.com"
          required
          autoFocus
        />
        <p className="text-xs text-muted-foreground">
          {defaultEmail
            ? "From the employee's HRIS record."
            : "No email on file in HRIS. Enter it by hand."}
        </p>
      </div>

      <DialogFooter className="mx-0 mb-0 items-center px-6 py-4">
        {error && (
          <p role="alert" className="mr-auto text-sm text-destructive">
            {error}
          </p>
        )}
        <DialogClose render={<Button variant="outline" type="button" />}>
          Cancel
        </DialogClose>
        <Button type="submit" disabled={sending || !to.trim()}>
          <SendIcon />
          {sending ? "Sending…" : "Send"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function VersionsDialog({
  holderName,
  open,
  onOpenChange,
  onSend,
  onDeleted,
  refreshKey,
}: {
  holderName: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSend: (form: FormVersion) => void;
  // Called after a version is deleted, with what's needed to undo it.
  onDeleted: (form: FormVersion, backup: FormBackup[]) => void;
  // Bump to reload after a send, so the history stays current.
  refreshKey: number;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100svh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        {holderName && open && (
          <VersionList
            key={`${holderName}-${refreshKey}`}
            holderName={holderName}
            onSend={onSend}
            onDeleted={onDeleted}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function VersionList({
  holderName,
  onSend,
  onDeleted,
}: {
  holderName: string;
  onSend: (form: FormVersion) => void;
  onDeleted: (form: FormVersion, backup: FormBackup[]) => void;
}) {
  const [versions, setVersions] = useState<FormVersion[] | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<FormVersion | null>(null);

  async function deleteVersion(form: FormVersion) {
    setError(null);
    setDeletingId(form.id);
    try {
      const response = await fetch(`/api/accountability-forms/${form.id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const { deleted } = (await response.json()) as { deleted: FormBackup[] };
      setVersions((prev) => prev?.filter((v) => v.id !== form.id) ?? null);
      onDeleted(form, deleted);
    } catch {
      setError(`Couldn't delete v${form.version}. Please try again.`);
    } finally {
      setDeletingId(null);
    }
  }

  useEffect(() => {
    let cancelled = false;
    fetch(
      `/api/accountability-forms/versions?holder=${encodeURIComponent(holderName)}`,
    )
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<FormVersion[]>;
      })
      .then((list) => !cancelled && setVersions(list))
      .catch(() => !cancelled && setError("Couldn't load the versions."));
    return () => {
      cancelled = true;
    };
  }, [holderName]);

  return (
    <>
      <DialogHeader className="border-b border-border px-6 py-5 pr-12">
        <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
          <HistoryIcon className="size-4" />
          Form versions
        </DialogTitle>
        <DialogDescription>{holderName}</DialogDescription>
      </DialogHeader>

      <div className="flex min-h-0 flex-col gap-2 overflow-y-auto px-6 py-5">
        {error && <p className="text-sm text-destructive">{error}</p>}
        {!versions && !error && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Loading…
          </p>
        )}
        {versions?.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No forms generated yet.
          </p>
        )}
        {versions?.map((form, index) => (
          <div
            key={form.id}
            className={cn(
              "rounded-xl border border-border px-4 py-3",
              index === 0 && "bg-muted/40",
            )}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm font-medium">
                v{form.version}
              </span>
              {index === 0 && (
                <span className="rounded bg-foreground px-1.5 py-px text-[10px] font-medium text-background">
                  Latest
                </span>
              )}
              <span className="text-xs text-muted-foreground">
                {form.generatedOn} · {form.itemCount}{" "}
                {form.itemCount === 1 ? "item" : "items"}
                {form.createdByName && ` · by ${form.createdByName}`}
              </span>
              <div className="ml-auto flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Open v${form.version}`}
                  nativeButton={false}
                  render={
                    <a
                      href={formPdfUrl(form.id)}
                      target="_blank"
                      rel="noreferrer"
                    />
                  }
                >
                  <ExternalLinkIcon />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Download v${form.version}`}
                  nativeButton={false}
                  render={<a href={formPdfUrl(form.id, true)} />}
                >
                  <DownloadIcon />
                </Button>
                <Button
                  variant="outline"
                  size="xs"
                  onClick={() => onSend(form)}
                >
                  <SendIcon />
                  Send
                </Button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Delete v${form.version}`}
                  className="text-muted-foreground hover:text-destructive"
                  disabled={deletingId !== null}
                  onClick={() => setDeleting(form)}
                >
                  {deletingId === form.id ? (
                    <Loader2Icon className="animate-spin" />
                  ) : (
                    <Trash2Icon />
                  )}
                </Button>
              </div>
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              IT Officer {form.itOfficerName} · HR {form.hrName}
            </div>
            {form.sends.length > 0 ? (
              <ul className="mt-2 flex flex-col gap-0.5 border-t border-border pt-2 text-[11px] text-muted-foreground">
                {form.sends.map((send) => (
                  <li key={send.id} className="flex items-center gap-1.5">
                    <MailIcon className="size-3" />
                    Sent to{" "}
                    <span className="text-foreground">{send.toEmail}</span>
                    <span className="tabular-nums">
                      {formatSentAt(send.sentAt)}
                    </span>
                    {send.sentByName && <span>by {send.sentByName}</span>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 border-t border-border pt-2 text-[11px] text-muted-foreground">
                Not sent yet
              </p>
            )}
          </div>
        ))}
      </div>

      <DialogFooter className="mx-0 mb-0 px-6 py-4">
        <DialogClose render={<Button variant="outline" />}>Close</DialogClose>
      </DialogFooter>

      <ConfirmDeleteDialog
        open={deleting !== null}
        onOpenChange={(next) => !next && setDeleting(null)}
        title={`Delete v${deleting?.version ?? ""}?`}
        description={
          deleting
            ? `Delete version ${deleting.version} of ${holderName}'s accountability form and its send history? You can undo this afterward.`
            : ""
        }
        onConfirm={() => {
          if (!deleting) return
          return deleteVersion(deleting)
        }}
      />
    </>
  );
}
