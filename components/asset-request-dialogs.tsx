"use client";

import { useState } from "react";
import {
  BackpackIcon,
  BatteryIcon,
  MemoryStickIcon,
  CableIcon,
  CheckIcon,
  CircleCheckIcon,
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
import { errorMessage } from "@/lib/inventory-api";
import { formatDate, initials, parseDate } from "@/lib/laptops";
import { useEmployeeDirectory } from "@/lib/use-employee-directory";
import { useToday } from "@/lib/use-today";
import { cn } from "@/lib/utils";

export const textareaClass =
  "w-full min-w-0 resize-none rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

// Without `request` this is the "New request" dialog with its own trigger
// button. With `request` it edits that request and is opened by the parent.
// Status changes go through the row actions (approve / complete / deny).
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
              setOpen(false);
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
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const editing = request != null;
  // Keep a stored type that's no longer in the option list.
  const assetTypes =
    request && !requestAssetTypes.includes(request.assetType)
      ? [request.assetType, ...requestAssetTypes]
      : requestAssetTypes;

  // Picking a name from the HRIS list fills in their department and ID;
  // anyone else can still be typed in by hand.
  function changeRequester(name: string) {
    setRequesterName(name);
    const match = employees.find(
      (e) => e.name.toLowerCase() === name.trim().toLowerCase(),
    );
    setEmployeeId(match?.id ?? null);
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
      department: department.trim() || null,
      assetType: get("assetType"),
      quantity: Number(get("quantity")) || 1,
      priority: get("priority") as RequestPriority,
      neededBy: get("neededBy") || null,
      reason,
    };

    setSaving(true);
    setError(null);
    try {
      await onSubmit(next);
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
                ? `HRIS employee ${employeeId}`
                : requesterName.trim()
                  ? "Not matched to an HRIS employee"
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
            defaultValue={request?.assetType ?? "Laptop"}
            className={selectClass}
          >
            {assetTypes.map((type) => (
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
          <span className="font-mono text-xs">{requestCode(request)}</span> ·{" "}
          {request.quantity > 1 && `${request.quantity}× `}
          {request.assetType} for {request.requesterName}
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

// Issues a supervisor-approved DTR request: serial number and condition
// are required by DTR before the request can move to Issued.
export function IssueDtrAssetDialog({
  request,
  open,
  onOpenChange,
  onConfirm,
}: {
  request: AssetRequest | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (input: {
    serialNumber: string;
    conditionIssued: DtrIssueCondition;
  }) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100svh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
        {request && open && (
          <IssueForm request={request} onConfirm={onConfirm} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function IssueForm({
  request,
  onConfirm,
}: {
  request: AssetRequest;
  onConfirm: (input: {
    serialNumber: string;
    conditionIssued: DtrIssueCondition;
  }) => void;
}) {
  const [serialNumber, setSerialNumber] = useState("");
  const [conditionIssued, setConditionIssued] =
    useState<DtrIssueCondition>("GOOD");
  const serial = serialNumber.trim();

  return (
    <form
      className="flex min-h-0 flex-col"
      onSubmit={(event) => {
        event.preventDefault();
        if (serial.length < 3) return;
        onConfirm({ serialNumber: serial, conditionIssued });
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
        <Button type="submit" disabled={serial.length < 3}>
          <CircleCheckIcon />
          Issue asset
        </Button>
      </DialogFooter>
    </form>
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
  open,
  onOpenChange,
}: {
  request: AssetRequest | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100svh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        {request && <Details request={request} />}
      </DialogContent>
    </Dialog>
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
  if (request.approvedAt || status !== "Cancelled") {
    steps.push({
      title: request.approvedAt ? "Approved" : "Awaiting approval",
      at: request.approvedAt,
      state: !request.approvedAt
        ? "upcoming"
        : status === "Ongoing"
          ? "current"
          : "done",
    });
  }
  if (status === "Cancelled") {
    const employeeCancelled = request.resolutionNote === "Cancelled by the employee.";
    steps.push({
      title: request.approvedAt || employeeCancelled ? "Cancelled" : "Denied",
      at: request.cancelledAt,
      state: "current",
    });
  } else {
    steps.push({
      title: request.completedAt ? "Completed" : "Awaiting hand-over",
      at: request.completedAt,
      state: request.completedAt ? "current" : "upcoming",
    });
  }
  return steps;
}

function Details({ request }: { request: AssetRequest }) {
  const today = useToday();
  const status = requestStatusStyles[request.status];
  const Icon = assetTypeIcons[request.assetType] ?? PackageIcon;
  const overdue =
    today != null &&
    request.neededBy != null &&
    (request.status === "Pending" || request.status === "Ongoing") &&
    parseDate(request.neededBy) < today;
  const steps = requestSteps(request);
  const cancelled = request.status === "Cancelled";

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
