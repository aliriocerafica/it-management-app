"use client";

import { useState } from "react";
import { SendIcon } from "lucide-react";

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
import { type FormVersion } from "@/lib/accountability-forms";
import { errorMessage, sendSaleForm } from "@/lib/inventory-api";
import { type Laptop } from "@/lib/laptops";

// Emails a sold laptop's buyer their accountability form to sign.
export function SaleFormDialog({
  laptop,
  buyer,
  lastSentTo,
  open,
  onOpenChange,
  onSent,
}: {
  laptop: Laptop | null;
  buyer: string | null;
  // Where the form went last time, to send it there again.
  lastSentTo: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSent: (form: FormVersion) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100svh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
        {laptop && open && (
          <SaleForm
            laptop={laptop}
            defaultBuyer={buyer ?? ""}
            defaultEmail={lastSentTo ?? ""}
            onSent={onSent}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function SaleForm({
  laptop,
  defaultBuyer,
  defaultEmail,
  onSent,
}: {
  laptop: Laptop;
  defaultBuyer: string;
  defaultEmail: string;
  onSent: (form: FormVersion) => void;
}) {
  const [buyer, setBuyer] = useState(defaultBuyer);
  const [to, setTo] = useState(defaultEmail);
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
          onSent(await sendSaleForm(laptop.id, buyer.trim(), to.trim()));
        } catch (err) {
          setError(errorMessage(err));
          setSending(false);
        }
      }}
    >
      <DialogHeader className="border-b border-border px-6 py-5 pr-12">
        <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
          <SendIcon className="size-4" />
          Send accountability form to sign
        </DialogTitle>
        <DialogDescription>
          {laptop.brand} {laptop.model} ·{" "}
          <span className="font-mono text-xs">{laptop.assetTag}</span>
          <span className="mt-1 block">
            The buyer gets the form as a PDF, with a link to upload the signed
            copy.
          </span>
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-4 px-6 py-5">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sale-form-buyer" className="text-xs">
            Buyer
          </Label>
          <Input
            id="sale-form-buyer"
            value={buyer}
            onChange={(event) => setBuyer(event.target.value)}
            placeholder="e.g. Juan Dela Cruz"
            required
            autoFocus={!defaultBuyer}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sale-form-email" className="text-xs">
            Buyer&apos;s email
          </Label>
          <Input
            id="sale-form-email"
            type="email"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            placeholder="name@example.com"
            required
            autoFocus={!!defaultBuyer}
          />
        </div>
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
        <Button
          type="submit"
          disabled={sending || !buyer.trim() || !to.trim()}
        >
          <SendIcon />
          {sending ? "Sending…" : "Send"}
        </Button>
      </DialogFooter>
    </form>
  );
}
