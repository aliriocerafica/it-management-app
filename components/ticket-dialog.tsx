"use client";

import { useState } from "react";
import { CheckIcon, PlusIcon, RotateCcwIcon } from "lucide-react";

import { FormField } from "@/components/add-laptop-dialog";
import { textareaClass } from "@/components/asset-request-dialogs";
import { DateRangeFilter } from "@/components/date-range-filter";
import { FormSelect } from "@/components/form-select";
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
import { requestPriorities, type RequestPriority } from "@/lib/asset-requests";
import { ticketCategories, ticketCode, type Ticket } from "@/lib/tickets";
import { useEmployeeDirectory } from "@/lib/use-employee-directory";
import { cn } from "@/lib/utils";

// The "New ticket" dialog with its own trigger button. The parent assigns
// the ticket number.
export function TicketDialog({ onAdd }: { onAdd: (ticket: Ticket) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <PlusIcon />
        New ticket
      </DialogTrigger>
      <DialogContent className="flex max-h-[calc(100svh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        {open && (
          <TicketForm
            onSubmit={(ticket) => {
              onAdd(ticket);
              setOpen(false);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function TicketForm({ onSubmit }: { onSubmit: (ticket: Ticket) => void }) {
  const { employees, status } = useEmployeeDirectory();
  const [requesterName, setRequesterName] = useState("");
  const [department, setDepartment] = useState("");
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [requesterEmail, setRequesterEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

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

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const get = (key: string) => String(form.get(key) ?? "").trim();

    const name = requesterName.trim().replace(/\s+/g, " ");
    if (!name) {
      setError("Who reported the issue?");
      return;
    }
    const subject = get("subject");
    if (!subject) {
      setError("Add a short subject for the issue.");
      return;
    }

    onSubmit({
      id: crypto.randomUUID(),
      ticketNo: 0,
      employeeId,
      requesterName: name,
      requesterEmail: requesterEmail.trim() || null,
      department: department.trim() || null,
      category: get("category"),
      subject,
      description: get("description"),
      priority: get("priority") as RequestPriority,
      status: "Open",
      assignedTo: get("assignedTo") || null,
      resolutionNote: null,
      createdAt: new Date().toISOString(),
      closedAt: null,
      resolutionMinutes: null,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex min-h-0 flex-col">
      <DialogHeader className="border-b border-border px-6 py-5 pr-12">
        <DialogTitle className="text-lg font-semibold">
          New troubleshooting ticket
        </DialogTitle>
        <DialogDescription>
          Log an IT issue an employee needs fixed.
        </DialogDescription>
      </DialogHeader>

      <div className="grid min-h-0 gap-3 overflow-y-auto px-6 py-5 sm:grid-cols-2">
        <FormField label="Reported by" htmlFor="ticketRequesterName">
          <Input
            id="ticketRequesterName"
            value={requesterName}
            onChange={(event) => changeRequester(event.target.value)}
            list="ticket-employee-options"
            placeholder={
              status === "loading"
                ? "Loading employees…"
                : "Search HRIS or type a full name"
            }
            autoComplete="off"
            required
            autoFocus
          />
          <datalist id="ticket-employee-options">
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
                : " "}
          </p>
        </FormField>
        <FormField label="Department" htmlFor="ticketDepartment" optional>
          <Input
            id="ticketDepartment"
            value={department}
            onChange={(event) => setDepartment(event.target.value)}
            placeholder="e.g. Finance"
          />
        </FormField>
        <FormField label="Category" htmlFor="ticketCategory">
          <FormSelect
            id="ticketCategory"
            name="category"
            defaultValue={ticketCategories[0]}
            options={ticketCategories.map((category) => ({
              value: category,
              label: category,
            }))}
          />
        </FormField>
        <FormField label="Priority" htmlFor="ticketPriority">
          <FormSelect
            id="ticketPriority"
            name="priority"
            defaultValue="Normal"
            options={requestPriorities.map((priority) => ({
              value: priority,
              label: priority,
            }))}
          />
        </FormField>
        <FormField label="Subject" htmlFor="ticketSubject">
          <Input
            id="ticketSubject"
            name="subject"
            placeholder="e.g. Laptop won't connect to Wi-Fi"
            required
          />
        </FormField>
        <FormField label="Assigned to" htmlFor="ticketAssignedTo" optional>
          <Input
            id="ticketAssignedTo"
            name="assignedTo"
            placeholder="e.g. IT Support"
          />
        </FormField>
        <FormField
          label="Description"
          htmlFor="ticketDescription"
          className="sm:col-span-2"
          optional
        >
          <textarea
            id="ticketDescription"
            name="description"
            placeholder="e.g. Started after yesterday's update; other devices connect fine"
            rows={3}
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
        <Button type="submit">
          <PlusIcon />
          Create ticket
        </Button>
      </DialogFooter>
    </form>
  );
}

// What the resolution time editor can change on a ticket.
export type ResolutionTimeEdit = Pick<
  Ticket,
  "createdAt" | "closedAt" | "resolutionMinutes"
>;

// An ISO timestamp as a datetime-local input value, in the viewer's time zone.
function toLocalInput(iso: string) {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// Corrects a closed ticket's dates and resolution time, for when it was
// closed later than it was actually fixed. With `closing` it closes an open
// ticket instead, offering the same fields as an option.
export function ResolutionTimeDialog({
  ticket,
  open,
  onOpenChange,
  onSave,
  closing = false,
}: {
  ticket: Ticket | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (edit: ResolutionTimeEdit) => void;
  closing?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="shine-border flex max-h-[calc(100svh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        {ticket && open && (
          <ResolutionTimeForm
            ticket={ticket}
            onSave={onSave}
            closing={closing}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ResolutionTimeForm({
  ticket,
  onSave,
  closing,
}: {
  ticket: Ticket;
  onSave: (edit: ResolutionTimeEdit) => void;
  closing: boolean;
}) {
  // When closing, whether to set the time by hand or leave it to the system.
  const [custom, setCustom] = useState(!closing);
  const [opened, setOpened] = useState(toLocalInput(ticket.createdAt));
  const [closed, setClosed] = useState(() =>
    toLocalInput(ticket.closedAt ?? new Date().toISOString()),
  );
  // Hours and minutes as typed by hand, kept as text so a field can be
  // cleared while retyping; null follows the two dates.
  const [manual, setManual] = useState<{
    hours: string;
    minutes: string;
  } | null>(
    ticket.resolutionMinutes === null
      ? null
      : {
          hours: String(Math.floor(ticket.resolutionMinutes / 60)),
          minutes: String(ticket.resolutionMinutes % 60),
        },
  );
  const [error, setError] = useState<string | null>(null);

  const openedAt = new Date(opened);
  const closedAt = new Date(closed);
  const datesValid =
    !Number.isNaN(openedAt.getTime()) && !Number.isNaN(closedAt.getTime());
  const calculated = datesValid
    ? Math.max(
        0,
        Math.round((closedAt.getTime() - openedAt.getTime()) / 60_000),
      )
    : 0;
  const shown = manual ?? {
    hours: String(Math.floor(calculated / 60)),
    minutes: String(calculated % 60),
  };

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!custom) {
      onSave({
        createdAt: ticket.createdAt,
        closedAt: new Date().toISOString(),
        resolutionMinutes: null,
      });
      return;
    }
    if (!datesValid) {
      setError("Enter both times.");
      return;
    }
    if (closedAt < openedAt) {
      setError("Closed can't be before opened.");
      return;
    }
    onSave({
      createdAt: openedAt.toISOString(),
      closedAt: closedAt.toISOString(),
      // An emptied field counts as 0.
      resolutionMinutes: manual
        ? Math.max(0, Math.floor(Number(manual.hours) || 0)) * 60 +
          Math.min(59, Math.max(0, Math.floor(Number(manual.minutes) || 0)))
        : null,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex min-h-0 flex-col">
      <DialogHeader className="border-b border-border px-6 py-5 pr-12">
        <DialogTitle className="text-lg font-semibold">
          {closing ? `Close ${ticketCode(ticket)}` : "Edit resolution time"}
        </DialogTitle>
        <DialogDescription>
          {closing
            ? `"${ticket.subject}" for ${ticket.requesterName} moves to Closed Tickets. You can undo this afterward.`
            : `When ${ticketCode(ticket)} was opened and closed, and how long it actually took to fix.`}
        </DialogDescription>
      </DialogHeader>

      <div className="grid min-h-0 gap-4 overflow-y-auto px-6 py-6 sm:grid-cols-2">
        {closing && (
          <div
            role="radiogroup"
            aria-label="Resolution time"
            className="grid gap-2 sm:col-span-2 sm:grid-cols-2"
          >
            {[
              {
                value: false,
                title: "Let the system set it",
                hint: "From when it was opened until now.",
              },
              {
                value: true,
                title: "Set the resolution time",
                hint: "If it was fixed earlier than you're closing it.",
              },
            ].map((option) => (
              <button
                key={option.title}
                type="button"
                role="radio"
                aria-checked={custom === option.value}
                onClick={() => {
                  setCustom(option.value);
                  setError(null);
                }}
                className={cn(
                  "rounded-lg border px-3 py-2.5 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                  custom === option.value
                    ? "border-blue-500 bg-blue-500/15"
                    : "border-border hover:bg-muted/50",
                )}
              >
                <div className="text-sm font-medium">{option.title}</div>
                <div className="text-[11px] text-muted-foreground">
                  {option.hint}
                </div>
              </button>
            ))}
          </div>
        )}
        {custom && (
          <>
            <FormField
              label="Opened – closed"
              htmlFor="resolutionDates"
              className="sm:col-span-2"
            >
              <DateRangeFilter
                id="resolutionDates"
                label="Pick the opened and closed days"
                value={{ from: opened.slice(0, 10), to: closed.slice(0, 10) }}
                onChange={(range) => {
                  if (!range) return;
                  setOpened(`${range.from}T${opened.slice(11)}`);
                  setClosed(`${range.to}T${closed.slice(11)}`);
                  setError(null);
                }}
                showPresets={false}
                applyFirstClick
                className="w-full justify-start font-normal [&>svg:last-child]:ml-auto"
              />
            </FormField>
            <FormField label="Opened at" htmlFor="resolutionOpenedTime">
              <Input
                id="resolutionOpenedTime"
                type="time"
                value={opened.slice(11)}
                onChange={(event) => {
                  setOpened(`${opened.slice(0, 10)}T${event.target.value}`);
                  setError(null);
                }}
              />
            </FormField>
            <FormField label="Closed at" htmlFor="resolutionClosedTime">
              <Input
                id="resolutionClosedTime"
                type="time"
                value={closed.slice(11)}
                onChange={(event) => {
                  setClosed(`${closed.slice(0, 10)}T${event.target.value}`);
                  setError(null);
                }}
              />
            </FormField>
            <FormField label="Hours" htmlFor="resolutionHours">
              <Input
                id="resolutionHours"
                type="number"
                min={0}
                step={1}
                placeholder="0"
                value={shown.hours}
                onChange={(event) =>
                  setManual({ ...shown, hours: event.target.value })
                }
              />
            </FormField>
            <FormField label="Minutes" htmlFor="resolutionMinutes">
              <Input
                id="resolutionMinutes"
                type="number"
                min={0}
                max={59}
                step={1}
                placeholder="0"
                value={shown.minutes}
                onChange={(event) =>
                  setManual({ ...shown, minutes: event.target.value })
                }
              />
            </FormField>
            <p className="text-[11px] text-muted-foreground sm:col-span-2">
              {manual === null
                ? "Hours and minutes follow the two dates. Type over them if the fix took a different amount of time."
                : "Hours and minutes were entered by hand, so they no longer follow the dates."}
            </p>
          </>
        )}
      </div>

      <DialogFooter className="mx-0 mb-0 items-center px-6 py-4">
        {error ? (
          <p role="alert" className="mr-auto text-sm text-destructive">
            {error}
          </p>
        ) : (
          custom &&
          manual !== null && (
            <Button
              variant="ghost"
              type="button"
              className="mr-auto"
              onClick={() => setManual(null)}
            >
              <RotateCcwIcon />
              Use dates
            </Button>
          )
        )}
        <DialogClose render={<Button variant="outline" type="button" />}>
          Cancel
        </DialogClose>
        <Button type="submit">
          <CheckIcon />
          {closing ? "Close ticket" : "Save"}
        </Button>
      </DialogFooter>
    </form>
  );
}
