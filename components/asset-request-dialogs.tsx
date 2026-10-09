"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BackpackIcon,
  BatteryIcon,
  MemoryStickIcon,
  CableIcon,
  CheckIcon,
  CircleCheckIcon,
  Loader2Icon,
  ClipboardListIcon,
  CpuIcon,
  HeadphonesIcon,
  HistoryIcon,
  KeyboardIcon,
  LaptopIcon,
  MessageSquareTextIcon,
  MouseIcon,
  PackageIcon,
  PlugIcon,
  PlusIcon,
  SmartphoneIcon,
  TvMinimalIcon,
  UserIcon,
  XCircleIcon,
  type LucideIcon,
} from "lucide-react";

import { FormField, selectClass } from "@/components/add-laptop-dialog";
import { Detail, Pill, Section } from "@/components/laptop-details-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { accessoryConfigs, type Accessory } from "@/lib/accessories";
import {
  priorityStyles,
  requestAssetTypes,
  requestCode,
  requestPriorities,
  requestStatusStyles,
  type AssetRequest,
  type RequestPriority,
} from "@/lib/asset-requests";
import {
  dtrIssueConditions,
  dtrReturnConditions,
  type DtrIssueCondition,
  type DtrReturnCondition,
} from "@/lib/dtr";
import {
  detectStockItem,
  inventoryKindForAssetType,
  requestHoldings,
  samePerson,
  stockHintScore,
  stockNoun,
  usableSerial,
  type IssuedHolding,
  type IssuedInventory,
  type IssueStockKind,
} from "@/lib/issue-stock";
import type { Laptop } from "@/lib/laptops";
import { toRamHost, type RamHost } from "@/lib/ram";
import { errorMessage } from "@/lib/inventory-api";
import { formatDate, initials, parseDate } from "@/lib/laptops";
import { useEmployeeDirectory } from "@/lib/use-employee-directory";
import { useToday } from "@/lib/use-today";
import { cn } from "@/lib/utils";

export const textareaClass =
  "w-full min-w-0 resize-none rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

// Without `request` this is the "New request" dialog with its own trigger
// button. With `request` it edits that request and is opened by the parent.
// Status changes go through the row actions (approve / complete / deny / archive).
export function AssetRequestDialog({
  onAdd,
  request,
  open: openProp,
  onOpenChange,
  onSave,
}: {
  // Both resolve once the database has the change; a rejection keeps the
  // dialog open and shows the error.
  onAdd?: (request: AssetRequest) => Promise<void>;
  request?: AssetRequest | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSave?: (request: AssetRequest) => Promise<void>;
}) {
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  const setOpen = onOpenChange ?? setOpenState;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {openProp === undefined && (
        <DialogTrigger render={<Button />}>
          <PlusIcon />
          New request
        </DialogTrigger>
      )}
      <DialogContent className="flex max-h-[calc(100svh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        {open && (
          <RequestForm
            request={request ?? null}
            onSubmit={async (next) => {
              await (request ? onSave : onAdd)?.(next);
              if (!request) setOpen(false);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function RequestForm({
  request,
  onSubmit,
}: {
  request: AssetRequest | null;
  onSubmit: (request: AssetRequest) => Promise<void>;
}) {
  const { employees, status } = useEmployeeDirectory();
  const [requesterName, setRequesterName] = useState(
    request?.requesterName ?? "",
  );
  const [department, setDepartment] = useState(request?.department ?? "");
  const [employeeId, setEmployeeId] = useState(request?.employeeId ?? null);
  const [requesterEmail, setRequesterEmail] = useState(
    request?.requesterEmail ?? "",
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const editing = request != null;
  const listedTypes = requestAssetTypes.filter((type) => type !== "Other");
  const storedType = request?.assetType ?? "Laptop";
  const storedIsListed = listedTypes.includes(storedType);
  const [assetType, setAssetType] = useState(
    storedIsListed ? storedType : "Other",
  );
  const [otherAsset, setOtherAsset] = useState(
    storedIsListed ? "" : storedType === "Other" ? "" : storedType,
  );

  // Picking a name from the HRIS list fills in their department and ID;
  // anyone else can still be typed in by hand.
  function changeRequester(name: string) {
    setRequesterName(name);
    const match = employees.find(
      (e) => e.name.toLowerCase() === name.trim().toLowerCase(),
    );
    setEmployeeId(match?.id ?? null);
    setRequesterEmail(match?.email?.trim() ?? "");
    if (match) setDepartment(match.department);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const get = (key: string) => String(form.get(key) ?? "").trim();

    const name = requesterName.trim().replace(/\s+/g, " ");
    if (!name) {
      setError("Who is the request for?");
      return;
    }
    const reason = get("reason");
    if (!reason) {
      setError("Add a reason for the request.");
      return;
    }
    const chosenAsset =
      assetType === "Other" ? otherAsset.trim().replace(/\s+/g, " ") : assetType;
    if (!chosenAsset) {
      setError("Type what asset they need.");
      return;
    }

    const next: AssetRequest = {
      ...(request ?? {
        id: crypto.randomUUID(),
        requestNo: 0,
        status: "Pending",
        resolutionNote: null,
        createdAt: new Date().toISOString(),
        approvedAt: null,
        completedAt: null,
        cancelledAt: null,
      }),
      employeeId,
      requesterName: name,
      requesterEmail: requesterEmail.trim() || null,
      department: department.trim() || null,
      assetType: chosenAsset,
      quantity: Number(get("quantity")) || 1,
      priority: get("priority") as RequestPriority,
      neededBy: get("neededBy") || null,
      reason,
    };

    setSaving(true);
    setError(null);
    try {
      await onSubmit(next);
      setSaving(false);
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex min-h-0 flex-col">
      <DialogHeader className="border-b border-border px-6 py-5 pr-12">
        <DialogTitle className="text-lg font-semibold">
          {editing ? `Edit ${requestCode(request)}` : "New asset request"}
        </DialogTitle>
        <DialogDescription>
          {editing
            ? "Update the details of this request."
            : "Log equipment an employee needs from IT."}
        </DialogDescription>
      </DialogHeader>

      <div className="grid min-h-0 gap-3 overflow-y-auto px-6 py-5 sm:grid-cols-2">
        <FormField label="Requested by" htmlFor="requesterName">
          <Input
            id="requesterName"
            value={requesterName}
            onChange={(event) => changeRequester(event.target.value)}
            list="request-employee-options"
            placeholder={
              status === "loading"
                ? "Loading employees…"
                : "Search HRIS or type a full name"
            }
            autoComplete="off"
            required
            autoFocus
          />
          <datalist id="request-employee-options">
            {employees.map((employee) => (
              <option key={employee.id} value={employee.name}>
                {[employee.id, employee.department].filter(Boolean).join(" · ")}
              </option>
            ))}
          </datalist>
          <p className="text-[11px] text-muted-foreground">
            {status === "error"
              ? "Couldn't reach HRIS. Type the name by hand."
              : employeeId
                ? `HRIS employee ${employeeId}${requesterEmail ? ` · ${requesterEmail}` : ""}`
                : requesterName.trim()
                  ? "Not matched to an HRIS employee — denial email needs a match"
                  : " "}
          </p>
        </FormField>
        <FormField label="Department" htmlFor="department" optional>
          <Input
            id="department"
            value={department}
            onChange={(event) => setDepartment(event.target.value)}
            placeholder="e.g. Finance"
          />
        </FormField>
        <FormField label="Asset type" htmlFor="assetType">
          <select
            id="assetType"
            name="assetType"
            value={assetType}
            onChange={(event) => setAssetType(event.target.value)}
            className={selectClass}
          >
            {requestAssetTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Quantity" htmlFor="quantity">
          <Input
            id="quantity"
            name="quantity"
            type="number"
            min={1}
            max={100}
            defaultValue={request?.quantity ?? 1}
            required
          />
        </FormField>
        {assetType === "Other" && (
          <FormField
            label="What asset"
            htmlFor="otherAsset"
            className="sm:col-span-2"
          >
            <Input
              id="otherAsset"
              value={otherAsset}
              onChange={(event) => setOtherAsset(event.target.value)}
              placeholder="e.g. Webcam, docking station, printer"
              required
            />
          </FormField>
        )}
        <FormField label="Priority" htmlFor="priority">
          <select
            id="priority"
            name="priority"
            defaultValue={request?.priority ?? "Normal"}
            className={selectClass}
          >
            {requestPriorities.map((priority) => (
              <option key={priority} value={priority}>
                {priority}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Needed by" htmlFor="neededBy" optional>
          <Input
            id="neededBy"
            name="neededBy"
            type="date"
            defaultValue={request?.neededBy ?? ""}
          />
        </FormField>
        <FormField label="Reason" htmlFor="reason" className="sm:col-span-2">
          <textarea
            id="reason"
            name="reason"
            defaultValue={request?.reason}
            placeholder="e.g. New hire starting Monday; current mouse scroll wheel is broken"
            rows={3}
            required
            className={textareaClass}
          />
        </FormField>
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
        <Button type="submit" disabled={saving}>
          {editing ? <CheckIcon /> : <PlusIcon />}
          {saving ? "Saving…" : editing ? "Save changes" : "Create request"}
        </Button>
      </DialogFooter>
    </form>
  );
}

// Asks for a note when a request is denied (required) or completed.
export function RequestNoteDialog({
  request,
  open,
  onOpenChange,
  title,
  summary,
  label,
  placeholder,
  required,
  confirmLabel,
  confirmVariant = "default",
  icon: Icon,
  onConfirm,
}: {
  request: AssetRequest | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  summary?: string;
  label: string;
  placeholder: string;
  required?: boolean;
  confirmLabel: string;
  confirmVariant?: "default" | "destructive";
  icon: LucideIcon;
  onConfirm: (note: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100svh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
        {request && open && (
          <NoteForm
            request={request}
            title={title}
            summary={summary}
            label={label}
            placeholder={placeholder}
            required={required}
            confirmLabel={confirmLabel}
            confirmVariant={confirmVariant}
            icon={Icon}
            onConfirm={onConfirm}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function NoteForm({
  request,
  title,
  summary,
  label,
  placeholder,
  required,
  confirmLabel,
  confirmVariant,
  icon: Icon,
  onConfirm,
}: {
  request: AssetRequest;
  title: string;
  summary?: string;
  label: string;
  placeholder: string;
  required?: boolean;
  confirmLabel: string;
  confirmVariant: "default" | "destructive";
  icon: LucideIcon;
  onConfirm: (note: string) => void;
}) {
  const [note, setNote] = useState("");
  const trimmed = note.trim();

  return (
    <form
      className="flex min-h-0 flex-col"
      onSubmit={(event) => {
        event.preventDefault();
        if (!required || trimmed) onConfirm(trimmed);
      }}
    >
      <DialogHeader className="border-b border-border px-6 py-5 pr-12">
        <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
          <Icon className="size-4" />
          {title}
        </DialogTitle>
        <DialogDescription>
          {summary ?? (
            <>
              <span className="font-mono text-xs">{requestCode(request)}</span>{" "}
              · {request.quantity > 1 && `${request.quantity}× `}
              {request.assetType} for {request.requesterName}
            </>
          )}
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-1.5 px-6 py-5">
        <Label htmlFor="request-note" className="text-xs">
          {label}
          {!required && (
            <span className="font-normal text-muted-foreground">
              (optional)
            </span>
          )}
        </Label>
        <textarea
          id="request-note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder={placeholder}
          rows={3}
          required={required}
          autoFocus
          className={textareaClass}
        />
      </div>

      <DialogFooter className="mx-0 mb-0 px-6 py-4">
        <DialogClose render={<Button variant="outline" type="button" />}>
          Back
        </DialogClose>
        <Button
          type="submit"
          variant={confirmVariant}
          disabled={required && !trimmed}
        >
          <Icon />
          {confirmLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}

const conditionLabels: Record<string, string> = {
  NEW: "New",
  GOOD: "Good",
  FAIR: "Fair",
  POOR: "Poor",
  DAMAGED: "Damaged",
};

// Issues a supervisor-approved DTR request. Tracked types (headset, RAM, …)
// take their serial from vacant inventory; DTR still requires a condition.
export function IssueDtrAssetDialog({
  request,
  holdings = [],
  open,
  onOpenChange,
  onConfirm,
}: {
  request: AssetRequest | null;
  holdings?: IssuedHolding[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (input: {
    serialNumber: string;
    conditionIssued: DtrIssueCondition;
    stock?: IssuedInventory;
  }) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100svh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        {request && open && (
          <IssueForm
            request={request}
            holdings={holdings}
            onConfirm={onConfirm}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function IssueForm({
  request,
  holdings,
  onConfirm,
}: {
  request: AssetRequest;
  holdings: IssuedHolding[];
  onConfirm: (input: {
    serialNumber: string;
    conditionIssued: DtrIssueCondition;
    stock?: IssuedInventory;
  }) => void;
}) {
  const kind = inventoryKindForAssetType(request.assetType);
  const [serialNumber, setSerialNumber] = useState("");
  const [conditionIssued, setConditionIssued] =
    useState<DtrIssueCondition>("GOOD");
  const [manual, setManual] = useState(!kind);
  const [stock, setStock] = useState<Array<Accessory | Laptop> | null>(
    kind ? null : [],
  );
  const [hosts, setHosts] = useState<RamHost[] | null>(kind === "ram" ? null : []);
  const [selectedId, setSelectedId] = useState("");
  const [hostId, setHostId] = useState("");
  const [query, setQuery] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const issued = requestHoldings(holdings, request);
  const [holdingId, setHoldingId] = useState(() =>
    issued?.items.length === 1 ? issued.items[0].id : "",
  );
  const [useHolding, setUseHolding] = useState(true);

  useEffect(() => {
    if (!kind) return;
    const requestedKind = kind;
    let cancelled = false;
    const hint = `${request.assetType} ${request.reason}`;

    async function load() {
      const response = await fetch(stockUrl(requestedKind), { cache: "no-store" });
      if (!response.ok) throw new Error("Couldn't load inventory.");
      const rows = (await response.json()) as Array<Accessory | Laptop>;
      if (cancelled) return;
      const vacant = rows.filter(
        (item) => item.status === "Vacant" && usableSerial(item.serialNumber),
      );
      vacant.sort(
        (a, b) => stockHintScore(b, hint) - stockHintScore(a, hint),
      );
      setStock(vacant);
      if (vacant.length === 0) {
        setManual(true);
        setHosts([]);
        return;
      }
      const detected = detectStockItem(vacant, (item) =>
        stockHintScore(item, hint),
      );
      if (detected) setSelectedId(detected.id);

      if (requestedKind !== "ram") {
        setHosts([]);
        return;
      }
      const laptopsResponse = await fetch("/api/laptops", { cache: "no-store" });
      if (!laptopsResponse.ok) {
        if (!cancelled) setHosts([]);
        return;
      }
      const laptops = (await laptopsResponse.json()) as Laptop[];
      if (cancelled) return;
      const matched = laptops
        .filter(
          (laptop) =>
            laptop.status !== "Retired" &&
            samePerson(laptop.handler, request.requesterName),
        )
        .map(toRamHost);
      setHosts(matched);
      if (matched.length === 1) setHostId(matched[0].id);
    }

    load().catch((error: unknown) => {
      if (cancelled) return;
      setLoadError(
        error instanceof Error ? error.message : "Couldn't load inventory.",
      );
      setStock((current) => current ?? []);
      setHosts((current) => current ?? []);
      setManual(true);
    });
    return () => {
      cancelled = true;
    };
  }, [kind, request.assetType, request.reason, request.requesterName]);

  const selected = stock?.find((item) => item.id === selectedId) ?? null;
  const pickedHolding =
    useHolding && issued
      ? (issued.items.find((item) => item.id === holdingId) ?? null)
      : null;
  const picking = Boolean(
    !pickedHolding && kind && !manual && stock && stock.length > 0,
  );
  const serial = (
    pickedHolding
      ? pickedHolding.serialNumber
      : picking
        ? (selected?.serialNumber ?? "")
        : serialNumber
  ).trim();
  const typedMatch =
    stock?.find(
      (item) => item.serialNumber.trim().toLowerCase() === serial.toLowerCase(),
    ) ?? null;
  const chosen = picking ? selected : typedMatch;
  const host =
    kind === "ram"
      ? hosts?.length === 1
        ? hosts[0]
        : (hosts?.find((item) => item.id === hostId) ?? null)
      : null;
  const needsHost = Boolean(
    chosen && kind === "ram" && hosts && hosts.length > 1 && !host,
  );
  const waiting =
    !pickedHolding &&
    (Boolean(kind === "ram" && hosts === null && !loadError) ||
      Boolean(kind && !manual && stock === null && !loadError));
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (stock ?? []).filter(
      (item) =>
        item.id === selectedId ||
        !q ||
        [item.assetTag, item.brand, item.model, item.serialNumber]
          .join(" ")
          .toLowerCase()
          .includes(q),
    );
  }, [query, selectedId, stock]);

  return (
    <form
      className="flex min-h-0 flex-col"
      onSubmit={(event) => {
        event.preventDefault();
        if (serial.length < 3 || needsHost || (picking && !chosen)) return;
        onConfirm({
          serialNumber: serial,
          conditionIssued,
          stock:
            !pickedHolding && chosen && kind
              ? toIssuedInventory(kind, chosen, host)
              : undefined,
        });
      }}
    >
      <DialogHeader className="border-b border-border px-6 py-5 pr-12">
        <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
          <CircleCheckIcon className="size-4" />
          Issue asset
        </DialogTitle>
        <DialogDescription>
          <span className="font-mono text-xs">{requestCode(request)}</span> ·{" "}
          {request.quantity > 1 && `${request.quantity}× `}
          {request.assetType} for {request.requesterName}
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-4 px-6 py-5">
        <AlreadyIssued
          holdings={holdings}
          request={request}
          selectedId={useHolding ? holdingId : ""}
          onSelect={(id) => {
            setHoldingId(id);
            setUseHolding(true);
          }}
        />
        {pickedHolding ? (
          <Button
            type="button"
            variant="link"
            size="xs"
            className="h-auto self-start px-0"
            onClick={() => setUseHolding(false)}
          >
            Enter a different serial
          </Button>
        ) : kind && !manual ? (
          <InventoryPick
            kind={kind}
            stock={stock}
            filtered={filtered}
            selected={selected}
            selectedId={selectedId}
            query={query}
            loadError={loadError}
            requesterName={request.requesterName}
            hosts={hosts}
            host={host}
            hostId={hostId}
            onQuery={setQuery}
            onSelect={setSelectedId}
            onHost={setHostId}
            onManual={() => setManual(true)}
          />
        ) : (
          <div className="flex flex-col gap-2">
            {loadError && (
              <p className="text-sm text-red-600 dark:text-red-400">
                {loadError} Enter the serial number instead.
              </p>
            )}
            {!loadError && kind && stock && stock.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No vacant {stockNoun(kind)} in inventory.
              </p>
            )}
            <FormField label="Serial number" htmlFor="dtr-serial">
              <Input
                id="dtr-serial"
                value={serialNumber}
                onChange={(event) => setSerialNumber(event.target.value)}
                placeholder="e.g. SN-1001"
                minLength={3}
                maxLength={100}
                required
                autoFocus
              />
            </FormField>
            {kind && stock && stock.length > 0 && (
              <Button
                type="button"
                variant="link"
                size="xs"
                className="h-auto self-start px-0"
                onClick={() => setManual(false)}
              >
                Choose from inventory
              </Button>
            )}
          </div>
        )}
        {kind === "ram" && manual && !pickedHolding && (
          <RamHostField
            requesterName={request.requesterName}
            hosts={hosts}
            host={host}
            hostId={hostId}
            onHost={setHostId}
            known={Boolean(chosen)}
          />
        )}
        <FormField label="Condition" htmlFor="dtr-condition">
          <select
            id="dtr-condition"
            value={conditionIssued}
            onChange={(event) =>
              setConditionIssued(event.target.value as DtrIssueCondition)
            }
            className={selectClass}
          >
            {dtrIssueConditions.map((condition) => (
              <option key={condition} value={condition}>
                {conditionLabels[condition]}
              </option>
            ))}
          </select>
        </FormField>
      </div>

      <DialogFooter className="mx-0 mb-0 px-6 py-4">
        <DialogClose render={<Button variant="outline" type="button" />}>
          Back
        </DialogClose>
        <Button
          type="submit"
          disabled={waiting || needsHost || serial.length < 3}
        >
          <CircleCheckIcon />
          Issue asset
        </Button>
      </DialogFooter>
    </form>
  );
}

// Issues several approved DTR requests at once. Each row needs its own serial.
export function IssueDtrAssetsDialog({
  requests,
  holdings = [],
  open,
  onOpenChange,
  onConfirm,
}: {
  requests: AssetRequest[];
  holdings?: IssuedHolding[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (
    items: {
      id: string;
      serialNumber: string;
      conditionIssued: DtrIssueCondition;
    }[],
  ) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100svh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        {open && requests.length > 0 && (
          <IssueManyForm
            key={requests.map((request) => request.id).join()}
            requests={requests}
            holdings={holdings}
            onConfirm={onConfirm}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function initialIssuedPicks(
  requests: AssetRequest[],
  holdings: IssuedHolding[],
) {
  const used = new Set<string>();
  const picked: Record<string, string> = {};
  for (const request of requests) {
    const available = (requestHoldings(holdings, request)?.items ?? []).filter(
      (item) =>
        !used.has(item.id) && item.serialNumber.trim().length >= 3,
    );
    if (available.length !== 1) continue;
    picked[request.id] = available[0].id;
    used.add(available[0].id);
  }
  return picked;
}

function IssueManyForm({
  requests,
  holdings,
  onConfirm,
}: {
  requests: AssetRequest[];
  holdings: IssuedHolding[];
  onConfirm: (
    items: {
      id: string;
      serialNumber: string;
      conditionIssued: DtrIssueCondition;
    }[],
  ) => void;
}) {
  const [conditionIssued, setConditionIssued] =
    useState<DtrIssueCondition>("GOOD");
  const [serials, setSerials] = useState<Record<string, string>>({});
  const [picked, setPicked] = useState(() =>
    initialIssuedPicks(requests, holdings),
  );
  const [manual, setManual] = useState<Record<string, boolean>>({});
  const rows = requests.map((request) => {
    const items = requestHoldings(holdings, request)?.items ?? [];
    const holding = manual[request.id]
      ? null
      : (items.find((item) => item.id === picked[request.id]) ?? null);
    const serial = (
      holding ? holding.serialNumber : (serials[request.id] ?? "")
    ).trim();
    return { request, items, holding, serial };
  });
  const trimmed = rows.map((row) => row.serial);
  const duplicate = trimmed.some(
    (serial, index) => serial.length > 0 && trimmed.indexOf(serial) !== index,
  );
  const ready =
    !duplicate && trimmed.every((serial) => serial.length >= 3 && serial.length <= 100);

  return (
    <form
      className="flex min-h-0 flex-col"
      onSubmit={(event) => {
        event.preventDefault();
        if (!ready) return;
        onConfirm(
          requests.map((request, index) => ({
            id: request.id,
            serialNumber: trimmed[index],
            conditionIssued,
          })),
        );
      }}
    >
      <DialogHeader className="border-b border-border px-6 py-5 pr-12">
        <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
          <CircleCheckIcon className="size-4" />
          Issue {requests.length} assets
        </DialogTitle>
        <DialogDescription>
          The asset already with each person is selected. Enter a serial only
          when they don&apos;t have one. They all go out in the same condition.
        </DialogDescription>
      </DialogHeader>

      <div className="flex min-h-0 flex-col gap-4 overflow-y-auto px-6 py-5">
        <FormField label="Condition" htmlFor="dtr-batch-condition">
          <select
            id="dtr-batch-condition"
            value={conditionIssued}
            onChange={(event) =>
              setConditionIssued(event.target.value as DtrIssueCondition)
            }
            className={selectClass}
          >
            {dtrIssueConditions.map((condition) => (
              <option key={condition} value={condition}>
                {conditionLabels[condition]}
              </option>
            ))}
          </select>
        </FormField>
        <div className="flex flex-col gap-3">
          {rows.map(({ request, items, holding }) => (
            <div key={request.id} className="flex flex-col gap-1.5">
              <p className="text-xs font-medium">
                <span className="font-mono">{requestCode(request)}</span>
                {" · "}
                {request.assetType}
                <span className="font-normal text-muted-foreground">
                  {" "}
                  for {request.requesterName}
                </span>
              </p>
              {items.length > 0 && !manual[request.id] ? (
                <div className="flex flex-col gap-1 rounded-lg border border-border bg-muted/40 p-1">
                  {items.map((item) => {
                    const isSelected = holding?.id === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() =>
                          setPicked((prev) => ({
                            ...prev,
                            [request.id]: item.id,
                          }))
                        }
                        className={cn(
                          "rounded-md px-2 py-1.5 text-left text-sm leading-tight outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          isSelected
                            ? "bg-background ring-1 ring-foreground/20"
                            : "hover:bg-background/70",
                        )}
                      >
                        <span className="font-mono text-xs">{item.assetTag}</span>
                        <span className="text-muted-foreground">
                          {" "}
                          · {item.brand} {item.model}
                          {item.serialNumber ? ` · SN ${item.serialNumber}` : ""}
                          {item.installedIn ? ` · in ${item.installedIn}` : ""}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <Input
                  id={`dtr-serial-${request.id}`}
                  aria-label={`Serial for ${request.requesterName}`}
                  value={serials[request.id] ?? ""}
                  onChange={(event) =>
                    setSerials((prev) => ({
                      ...prev,
                      [request.id]: event.target.value,
                    }))
                  }
                  placeholder={`Serial for ${request.requesterName}`}
                  minLength={3}
                  maxLength={100}
                  required
                />
              )}
              {items.length > 0 && (
                <Button
                  type="button"
                  variant="link"
                  size="xs"
                  className="h-auto self-start px-0"
                  onClick={() =>
                    setManual((prev) => ({
                      ...prev,
                      [request.id]: !prev[request.id],
                    }))
                  }
                >
                  {manual[request.id]
                    ? "Choose the issued asset"
                    : "Enter a different serial"}
                </Button>
              )}
            </div>
          ))}
        </div>
        {duplicate && (
          <p role="alert" className="text-sm text-destructive">
            Each asset needs its own serial number.
          </p>
        )}
      </div>

      <DialogFooter className="mx-0 mb-0 px-6 py-4">
        <DialogClose render={<Button variant="outline" type="button" />}>
          Back
        </DialogClose>
        <Button type="submit" disabled={!ready}>
          <CircleCheckIcon />
          Issue {requests.length} assets
        </Button>
      </DialogFooter>
    </form>
  );
}

function stockUrl(kind: IssueStockKind) {
  return kind === "laptop" ? "/api/laptops" : `/api/accessories?kind=${kind}`;
}

function toIssuedInventory(
  kind: IssueStockKind,
  item: Accessory | Laptop,
  host: RamHost | null,
): IssuedInventory {
  if (kind === "laptop") return { kind: "laptop", item: item as Laptop };
  if (kind === "ram") return { kind: "ram", item: item as Accessory, host };
  return { kind, item: item as Accessory };
}

function stockDetail(kind: IssueStockKind, item: Accessory | Laptop) {
  if (kind === "laptop" || !("kind" in item)) return "";
  const summary = accessoryConfigs[item.kind].summary(item.specs ?? {});
  return [summary.primary, summary.secondary]
    .filter((part) => part && !part.includes("undefined"))
    .join(" · ");
}

function InventoryPick({
  kind,
  stock,
  filtered,
  selected,
  selectedId,
  query,
  loadError,
  requesterName,
  hosts,
  host,
  hostId,
  onQuery,
  onSelect,
  onHost,
  onManual,
}: {
  kind: IssueStockKind;
  stock: Array<Accessory | Laptop> | null;
  filtered: Array<Accessory | Laptop>;
  selected: Accessory | Laptop | null;
  selectedId: string;
  query: string;
  loadError: string | null;
  requesterName: string;
  hosts: RamHost[] | null;
  host: RamHost | null;
  hostId: string;
  onQuery: (value: string) => void;
  onSelect: (id: string) => void;
  onHost: (id: string) => void;
  onManual: () => void;
}) {
  const noun = stockNoun(kind);
  const one = stockNoun(kind, 1);

  if (stock === null && !loadError) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2Icon className="size-3.5 animate-spin" />
        Checking inventory for a vacant {one}…
      </p>
    );
  }

  if (loadError) {
    return <p className="text-sm text-red-600 dark:text-red-400">{loadError}</p>;
  }

  if (!stock || stock.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No vacant {noun} in inventory. Enter the serial number instead.
      </p>
    );
  }

  const detected = stock.length === 1 || Boolean(selected);

  return (
    <div className="flex flex-col gap-3">
      {stock.length === 1 && selected ? (
        <DetectedStock kind={kind} item={selected} />
      ) : (
        <div className="flex flex-col gap-2">
          {(stock.length > 6 || query) && (
            <Input
              value={query}
              onChange={(event) => onQuery(event.target.value)}
              placeholder={`Search ${noun}`}
              aria-label={`Search ${noun}`}
            />
          )}
          <FormField label={`Vacant ${one}`} htmlFor="dtr-stock">
            <select
              id="dtr-stock"
              value={selectedId}
              onChange={(event) => onSelect(event.target.value)}
              className={selectClass}
              required
              autoFocus
            >
              <option value="" disabled>
                Select a vacant {one}
              </option>
              {filtered.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.assetTag} · {item.brand} {item.model} ·{" "}
                  {item.serialNumber}
                </option>
              ))}
            </select>
          </FormField>
          {selected && <DetectedStock kind={kind} item={selected} compact />}
        </div>
      )}
      {kind === "ram" && (
        <RamHostField
          requesterName={requesterName}
          hosts={hosts}
          host={host}
          hostId={hostId}
          onHost={onHost}
          known={detected && Boolean(selected)}
        />
      )}
      <Button
        type="button"
        variant="link"
        size="xs"
        className="h-auto self-start px-0"
        onClick={onManual}
      >
        Enter a serial instead
      </Button>
    </div>
  );
}

function DetectedStock({
  kind,
  item,
  compact = false,
}: {
  kind: IssueStockKind;
  item: Accessory | Laptop;
  compact?: boolean;
}) {
  const detail = stockDetail(kind, item);
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-border bg-muted/40 px-3 py-2.5">
      <CircleCheckIcon className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
      <div className="min-w-0 leading-tight">
        {!compact && (
          <p className="text-xs text-muted-foreground">Detected in inventory</p>
        )}
        <p className="truncate text-sm font-medium">
          <span className="font-mono">{item.assetTag}</span>
          <span className="font-normal text-muted-foreground">
            {" "}
            · {item.brand} {item.model}
          </span>
        </p>
        <p className="truncate text-xs text-muted-foreground">
          Serial {item.serialNumber}
          {detail ? ` · ${detail}` : ""}
        </p>
      </div>
    </div>
  );
}

function RamHostField({
  requesterName,
  hosts,
  host,
  hostId,
  onHost,
  known,
}: {
  requesterName: string;
  hosts: RamHost[] | null;
  host: RamHost | null;
  hostId: string;
  onHost: (id: string) => void;
  known: boolean;
}) {
  if (!known) return null;
  if (hosts === null) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2Icon className="size-3.5 animate-spin" />
        Looking up {requesterName}&apos;s laptop…
      </p>
    );
  }
  if (hosts.length === 1 && host) {
    return (
      <p className="text-xs text-muted-foreground">
        Installs in <span className="font-mono">{host.assetTag}</span> ·{" "}
        {host.brand} {host.model}
      </p>
    );
  }
  if (hosts.length > 1) {
    return (
      <FormField label="Install in" htmlFor="dtr-ram-host">
        <select
          id="dtr-ram-host"
          value={hostId}
          onChange={(event) => onHost(event.target.value)}
          className={selectClass}
          required
        >
          <option value="" disabled>
            {requesterName}&apos;s laptop
          </option>
          {hosts.map((laptop) => (
            <option key={laptop.id} value={laptop.id}>
              {laptop.assetTag} · {laptop.brand} {laptop.model}
            </option>
          ))}
        </select>
      </FormField>
    );
  }
  return (
    <p className="text-xs text-muted-foreground">
      {requesterName} has no laptop in inventory, so this module will be marked
      in use for them.
    </p>
  );
}

export function ReturnDtrAssetDialog({
  request,
  open,
  onOpenChange,
  onConfirm,
}: {
  request: AssetRequest | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (returnCondition: DtrReturnCondition) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100svh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
        {request && open && (
          <ReturnForm request={request} onConfirm={onConfirm} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ReturnForm({
  request,
  onConfirm,
}: {
  request: AssetRequest;
  onConfirm: (returnCondition: DtrReturnCondition) => void;
}) {
  const [returnCondition, setReturnCondition] =
    useState<DtrReturnCondition>("GOOD");

  return (
    <form
      className="flex min-h-0 flex-col"
      onSubmit={(event) => {
        event.preventDefault();
        onConfirm(returnCondition);
      }}
    >
      <DialogHeader className="border-b border-border px-6 py-5 pr-12">
        <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
          <PackageIcon className="size-4" />
          Mark returned
        </DialogTitle>
        <DialogDescription>
          <span className="font-mono text-xs">{requestCode(request)}</span> ·{" "}
          {request.assetType} for {request.requesterName}
        </DialogDescription>
      </DialogHeader>

      <div className="px-6 py-5">
        <FormField label="Return condition" htmlFor="dtr-return-condition">
          <select
            id="dtr-return-condition"
            value={returnCondition}
            onChange={(event) =>
              setReturnCondition(event.target.value as DtrReturnCondition)
            }
            className={selectClass}
          >
            {dtrReturnConditions.map((condition) => (
              <option key={condition} value={condition}>
                {conditionLabels[condition]}
              </option>
            ))}
          </select>
        </FormField>
      </div>

      <DialogFooter className="mx-0 mb-0 px-6 py-4">
        <DialogClose render={<Button variant="outline" type="button" />}>
          Back
        </DialogClose>
        <Button type="submit">
          <PackageIcon />
          Mark returned
        </Button>
      </DialogFooter>
    </form>
  );
}

// Icon for the requested asset type, shown in the details header.
const assetTypeIcons: Record<string, LucideIcon> = {
  Laptop: LaptopIcon,
  Headset: HeadphonesIcon,
  Mouse: MouseIcon,
  Keyboard: KeyboardIcon,
  Monitor: TvMinimalIcon,
  "Laptop bag": BackpackIcon,
  Battery: BatteryIcon,
  RAM: MemoryStickIcon,
  Charger: PlugIcon,
  "Peripheral kit": CableIcon,
  "Hardware device": CpuIcon,
  Phone: SmartphoneIcon,
};

export function RequestDetailsDialog({
  request,
  holdings = [],
  open,
  onOpenChange,
}: {
  request: AssetRequest | null;
  holdings?: IssuedHolding[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100svh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        {request && <Details request={request} holdings={holdings} />}
      </DialogContent>
    </Dialog>
  );
}

export function AlreadyIssued({
  holdings,
  request,
  compact = false,
  selectedId,
  onSelect,
}: {
  holdings: IssuedHolding[];
  request: Pick<AssetRequest, "requesterName" | "assetType" | "resolutionNote">;
  compact?: boolean;
  selectedId?: string;
  onSelect?: (id: string) => void;
}) {
  const match = requestHoldings(holdings, request);
  if (!match) return null;
  if (compact && match.items.length === 0) return null;

  if (compact) {
    const others = match.items.filter((item) => item.id !== match.completed?.id);
    return (
      <div className="mt-0.5 space-y-0.5">
        {match.completed && (
          <div className="text-[11px] text-emerald-700 dark:text-emerald-400">
            Issued {match.completed.assetTag}
            {match.completed.installedIn
              ? ` in ${match.completed.installedIn}`
              : ""}
          </div>
        )}
        {others.length > 0 && (
          <div
            className="text-[11px] text-amber-700 dark:text-amber-400"
            title={others
              .map((item) =>
                `${item.assetTag} ${item.brand} ${item.model}${item.installedIn ? ` in ${item.installedIn}` : ""}`,
              )
              .join(", ")}
          >
            Already has {others.map((item) => item.assetTag).join(", ")}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-muted/40 px-3 py-2.5">
      <p className="text-xs font-medium text-muted-foreground">
        Already with {request.requesterName}
      </p>
      {match.items.length === 0 ? (
        <p className="mt-1 text-sm">
          No {stockNoun(match.kind, 1)} is currently issued to them.
        </p>
      ) : (
        <ul className="mt-1.5 flex flex-col gap-1.5">
          {match.items.map((item) => {
            const forThisRequest = match.completed?.id === item.id;
            const isSelected = selectedId === item.id;
            const label = (
              <>
                <span className="font-mono text-xs">{item.assetTag}</span>
                <span className="text-muted-foreground">
                  {" "}
                  · {item.brand} {item.model}
                  {item.serialNumber ? ` · SN ${item.serialNumber}` : ""}
                  {item.installedIn ? ` · in ${item.installedIn}` : ""}
                </span>
                {forThisRequest && (
                  <span className="ml-1.5 text-xs text-emerald-700 dark:text-emerald-400">
                    This request
                  </span>
                )}
              </>
            );
            if (!onSelect) {
              return (
                <li key={item.id} className="text-sm leading-tight">
                  {label}
                </li>
              );
            }
            return (
              <li key={item.id}>
                <button
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => onSelect(item.id)}
                  className={cn(
                    "flex w-full rounded-md px-2 py-1.5 text-left text-sm leading-tight outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    isSelected
                      ? "bg-background ring-1 ring-foreground/20"
                      : "hover:bg-background/70",
                  )}
                >
                  {label}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

type Step = {
  title: string;
  at: string | null;
  // Finished, where the request is now, or not reached yet.
  state: "done" | "current" | "upcoming";
};

function requestSteps(request: AssetRequest): Step[] {
  const { status } = request;
  const steps: Step[] = [
    {
      title: "Requested",
      at: request.createdAt,
      state: status === "Pending" ? "current" : "done",
    },
  ];
  const denied =
    status === "Denied" ||
    (status === "Archived" && Boolean(request.cancelledAt) && !request.completedAt);
  if (request.approvedAt || !denied) {
    steps.push({
      title: request.approvedAt ? "Approved" : "Awaiting approval",
      at: request.approvedAt,
      state: !request.approvedAt
        ? "upcoming"
        : status === "Approved"
          ? "current"
          : "done",
    });
  }
  if (denied) {
    const employeeCancelled =
      request.resolutionNote === "Cancelled by the employee.";
    steps.push({
      title: request.approvedAt || employeeCancelled ? "Cancelled" : "Denied",
      at: request.cancelledAt,
      state: status === "Denied" ? "current" : "done",
    });
  } else {
    steps.push({
      title: request.completedAt ? "Completed" : "Awaiting hand-over",
      at: request.completedAt,
      state:
        status === "Completed"
          ? "current"
          : request.completedAt
            ? "done"
            : "upcoming",
    });
  }
  if (status === "Archived") {
    steps.push({
      title: "Archived",
      at: request.cancelledAt && !request.completedAt ? request.cancelledAt : request.completedAt,
      state: "current",
    });
  }
  return steps;
}

function Details({
  request,
  holdings,
}: {
  request: AssetRequest;
  holdings: IssuedHolding[];
}) {
  const today = useToday();
  const status = requestStatusStyles[request.status];
  const Icon = assetTypeIcons[request.assetType] ?? PackageIcon;
  const overdue =
    today != null &&
    request.neededBy != null &&
    (request.status === "Pending" || request.status === "Approved") &&
    parseDate(request.neededBy) < today;
  const steps = requestSteps(request);
  const cancelled = request.status === "Denied";

  return (
    <>
      <DialogHeader className="flex-row items-center gap-4 border-b border-border px-6 py-5 pr-12">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-muted">
          <Icon className="size-6" />
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <DialogTitle className="text-lg font-semibold">
            {request.quantity > 1 && `${request.quantity}× `}
            {request.assetType}
          </DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            <span className="font-mono">{requestCode(request)}</span>
            {request.source === "dtr" && (
              <>
                <span aria-hidden>·</span>
                <span>From DTR</span>
              </>
            )}
            <span aria-hidden>·</span>
            <span>Requested {formatDate(new Date(request.createdAt))}</span>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded border border-border px-1.5 py-px text-[11px] font-medium",
                status.text,
              )}
            >
              <span className={cn("size-1.5 rounded-full", status.dot)} />
              {request.status}
            </span>
          </DialogDescription>
        </div>
      </DialogHeader>

      <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto px-6 py-5 text-sm scrollbar-none sm:grid-cols-2 [&::-webkit-scrollbar]:hidden">
        <div className="flex flex-col gap-4">
          <Section title="Requested by" icon={UserIcon}>
            <div className="flex items-center gap-3">
              <Avatar className="size-9 after:rounded-full">
                <AvatarFallback className="bg-muted text-xs font-medium">
                  {initials(request.requesterName)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 leading-tight">
                <div className="truncate font-medium">
                  {request.requesterName}
                </div>
                <div className="text-xs text-muted-foreground">
                  {request.department ?? "No department"}
                </div>
              </div>
            </div>
            <Detail label="Employee ID" mono={request.employeeId != null}>
              {request.employeeId ?? (
                <span className="font-normal text-muted-foreground italic">
                  Not linked to HRIS
                </span>
              )}
            </Detail>
            <Detail label="Email">
              {request.requesterEmail ?? (
                <span className="font-normal text-muted-foreground italic">
                  No email on file
                </span>
              )}
            </Detail>
          </Section>

          <Section title="Request" icon={ClipboardListIcon}>
            <Detail label="Asset">{request.assetType}</Detail>
            <Detail label="Quantity">{request.quantity}</Detail>
            <Detail label="Priority">
              <Pill className={priorityStyles[request.priority]}>
                {request.priority}
              </Pill>
            </Detail>
            <Detail label="Needed by">
              {request.neededBy ? (
                <span className="inline-flex items-center gap-2">
                  {overdue && (
                    <Pill className="bg-red-500/10 text-red-700 dark:text-red-400">
                      Overdue
                    </Pill>
                  )}
                  {formatDate(parseDate(request.neededBy))}
                </span>
              ) : (
                <span className="font-normal text-muted-foreground">
                  No deadline
                </span>
              )}
            </Detail>
          </Section>
          <AlreadyIssued holdings={holdings} request={request} />
        </div>

        <section className="rounded-xl border border-border p-4">
          <h3 className="mb-4 flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
            <HistoryIcon className="size-3.5" />
            Progress
          </h3>
          <ol>
            {steps.map((step, index) => {
              const next = steps[index + 1];
              return (
                <li
                  key={step.title}
                  className="relative flex gap-3 pb-5 last:pb-0"
                >
                  {next && (
                    <span
                      aria-hidden
                      className={cn(
                        "absolute top-4 -bottom-0.5 left-1.5 -translate-x-1/2",
                        next.state === "upcoming"
                          ? "border-l border-dashed border-muted-foreground/40"
                          : "w-px bg-border",
                      )}
                    />
                  )}
                  <span className="relative flex h-5 w-3 shrink-0 items-center justify-center">
                    {step.state === "upcoming" ? (
                      <span className="size-3 rounded-full border-2 border-dashed border-muted-foreground/40 bg-card" />
                    ) : step.state === "current" ? (
                      <span
                        className={cn(
                          "size-3 rounded-full ring-4 ring-foreground/10",
                          status.dot,
                        )}
                      />
                    ) : (
                      <span className="size-3 rounded-full bg-muted-foreground/50" />
                    )}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span
                      className={cn(
                        "font-medium",
                        step.state === "upcoming" &&
                          "font-normal text-muted-foreground",
                      )}
                    >
                      {step.title}
                    </span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {step.at ? formatDate(new Date(step.at)) : "Not yet"}
                    </span>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        <section className="rounded-xl border border-border p-4 sm:col-span-2">
          <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
            <MessageSquareTextIcon className="size-3.5" />
            Reason
          </h3>
          <p className="whitespace-pre-wrap">{request.reason}</p>
        </section>

        {request.resolutionNote && (
          <section
            className={cn(
              "rounded-xl border p-4 sm:col-span-2",
              cancelled
                ? "border-red-500/30 bg-red-500/5"
                : "border-emerald-500/30 bg-emerald-500/5",
            )}
          >
            <h3
              className={cn(
                "mb-2 flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.08em] uppercase",
                cancelled
                  ? "text-red-700 dark:text-red-400"
                  : "text-emerald-700 dark:text-emerald-400",
              )}
            >
              {cancelled ? (
                <XCircleIcon className="size-3.5" />
              ) : (
                <CircleCheckIcon className="size-3.5" />
              )}
              {cancelled
                ? request.approvedAt
                  ? "Reason for cancelling"
                  : "Reason for denial"
                : "Resolution"}
            </h3>
            <p className="whitespace-pre-wrap">{request.resolutionNote}</p>
          </section>
        )}
      </div>

      <DialogFooter showCloseButton className="mx-0 mb-0 px-6 py-4" />
    </>
  );
}
