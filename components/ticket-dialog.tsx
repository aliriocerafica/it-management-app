"use client";

import { useState } from "react";
import {
  CheckIcon,
  ChevronDownIcon,
  PlusIcon,
} from "lucide-react";

import { FormField, selectClass } from "@/components/add-laptop-dialog";
import { textareaClass } from "@/components/asset-request-dialogs";
import { DateRangeFilter } from "@/components/date-range-filter";
import { EmployeePickerDialog } from "@/components/employee-picker-dialog";
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
import type { Employee } from "@/lib/employees";
import { ticketCategories, ticketCode, type Ticket } from "@/lib/tickets";
import { cn } from "@/lib/utils";

// The "New ticket" dialog with its own trigger button. The database assigns
// the ticket number.
export function TicketDialog({
  onAdd,
  itOfficers,
}: {
  onAdd: (ticket: Ticket) => void;
  // Who a ticket can be assigned to: the IT Officers from the
  // accountability form settings.
  itOfficers: string[];
}) {
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
            itOfficers={itOfficers}
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

function TicketForm({
  itOfficers,
  onSubmit,
}: {
  itOfficers: string[];
  onSubmit: (ticket: Ticket) => void;
}) {
  // Chosen in the same employee picker as assigning an asset. The
  // department isn't shown but is still saved, from the picked employee.
  const [requester, setRequester] = useState<Employee | null>(null);
  const [picking, setPicking] = useState(false);
  const [category, setCategory] = useState(ticketCategories[0]);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const get = (key: string) => String(form.get(key) ?? "").trim();

    const name = requester?.name.trim().replace(/\s+/g, " ") ?? "";
    if (!requester || !name) {
      setError("Who reported the issue?");
      return;
    }
    // "Other" saves the type of issue as typed, like the imported tickets.
    const otherIssue = get("otherIssue").replace(/\s+/g, " ");
    if (category === "Other" && !otherIssue) {
      setError("Type what kind of issue it is.");
      return;
    }
    const issue = category === "Other" ? otherIssue : category;
    const description = get("description");
    // No subject field: a short description becomes the subject, otherwise
    // the type of issue does (the same as imported tickets).
    const short = description.replace(/\s+/g, " ");
    const subject = short && short.length <= 80 ? short : issue;

    onSubmit({
      id: crypto.randomUUID(),
      ticketNo: 0,
      employeeId: requester.id || null,
      requesterName: name,
      requesterEmail: requester.email?.trim() || null,
      department: requester.department?.trim() || null,
      category: issue,
      subject,
      description: subject === short ? "" : description,
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
        <FormField
          label="Reported by"
          htmlFor="ticketRequester"
          className="sm:col-span-2"
        >
          <button
            id="ticketRequester"
            type="button"
            aria-haspopup="dialog"
            autoFocus
            className={cn(
              selectClass,
              "flex items-center justify-between gap-2 text-left",
            )}
            onClick={() => setPicking(true)}
          >
            <span className={cn("truncate", !requester && "text-muted-foreground")}>
              {requester ? (
                <>
                  {requester.name}
                  {(requester.id || requester.department) && (
                    <span className="text-muted-foreground">
                      {" · "}
                      {[requester.id, requester.department]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  )}
                </>
              ) : (
                "Select employee"
              )}
            </span>
            <ChevronDownIcon className="size-3.5 shrink-0 text-muted-foreground" />
          </button>
        </FormField>
        <FormField label="Category" htmlFor="ticketCategory">
          <FormSelect
            id="ticketCategory"
            value={category}
            onChange={(value) => {
              setCategory(value);
              setError(null);
            }}
            options={ticketCategories.map((option) => ({
              value: option,
              label: option,
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
        {category === "Other" && (
          <FormField
            label="Type of issue"
            htmlFor="ticketOtherIssue"
            className="sm:col-span-2"
          >
            <Input
              id="ticketOtherIssue"
              name="otherIssue"
              placeholder="e.g. CCTV, Google Form creation"
              autoFocus
              required
            />
          </FormField>
        )}
        <FormField
          label="Assigned to"
          htmlFor="ticketAssignedTo"
          className="sm:col-span-2"
          optional
        >
          <FormSelect
            id="ticketAssignedTo"
            name="assignedTo"
            defaultValue=""
            options={[
              { value: "", label: "Unassigned" },
              ...itOfficers.map((name) => ({ value: name, label: name })),
            ]}
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
            placeholder="e.g. Laptop won't connect to Wi-Fi since yesterday's update"
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

      <EmployeePickerDialog
        open={picking}
        onOpenChange={setPicking}
        holders={[]}
        noun="ticket"
        title="Select employee"
        description="Who reported the issue?"
        selectedLabel="Reported by"
        onPick={(employee) => {
          setRequester(employee);
          setError(null);
          setPicking(false);
        }}
      />
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
  // The times and the hours/minutes always agree: changing a time updates
  // the duration, and typing a duration moves "Closed at" to match.
  const [opened, setOpened] = useState(toLocalInput(ticket.createdAt));
  const [closed, setClosed] = useState(() =>
    toLocalInput(
      // A time entered by hand before (the old way) becomes the closing
      // time, so the dates show it too.
      ticket.closedAt && ticket.resolutionMinutes !== null
        ? new Date(
            new Date(ticket.createdAt).getTime() +
              ticket.resolutionMinutes * 60_000,
          ).toISOString()
        : (ticket.closedAt ?? new Date().toISOString()),
    ),
  );
  // Hours and minutes while they're being typed, as text so a field can be
  // cleared and retyped; null shows the duration between the two times.
  const [typing, setTyping] = useState<{
    hours: string;
    minutes: string;
  } | null>(null);
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
  const shown = typing ?? {
    hours: String(Math.floor(calculated / 60)),
    minutes: String(calculated % 60),
  };

  // Typing hours or minutes closes the ticket that long after it opened.
  // An emptied field counts as 0; 90 minutes is fine and shows as 1 h 30.
  function changeDuration(next: { hours: string; minutes: string }) {
    setTyping(next);
    setError(null);
    if (Number.isNaN(openedAt.getTime())) return;
    const total =
      Math.max(0, Math.floor(Number(next.hours) || 0)) * 60 +
      Math.max(0, Math.floor(Number(next.minutes) || 0));
    setClosed(
      toLocalInput(
        new Date(openedAt.getTime() + total * 60_000).toISOString(),
      ),
    );
  }

  // Changing a time or day; the hours and minutes follow.
  function changeTimes(nextOpened: string, nextClosed: string) {
    setOpened(nextOpened);
    setClosed(nextClosed);
    setTyping(null);
    setError(null);
  }

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
      // The two times now carry the duration.
      resolutionMinutes: null,
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
                  changeTimes(
                    `${range.from}T${opened.slice(11)}`,
                    `${range.to}T${closed.slice(11)}`,
                  );
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
                onChange={(event) =>
                  changeTimes(
                    `${opened.slice(0, 10)}T${event.target.value}`,
                    closed,
                  )
                }
              />
            </FormField>
            <FormField label="Closed at" htmlFor="resolutionClosedTime">
              <Input
                id="resolutionClosedTime"
                type="time"
                value={closed.slice(11)}
                onChange={(event) =>
                  changeTimes(
                    opened,
                    `${closed.slice(0, 10)}T${event.target.value}`,
                  )
                }
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
                  changeDuration({ ...shown, hours: event.target.value })
                }
                onBlur={() => setTyping(null)}
              />
            </FormField>
            <FormField label="Minutes" htmlFor="resolutionMinutes">
              <Input
                id="resolutionMinutes"
                type="number"
                min={0}
                step={1}
                placeholder="0"
                value={shown.minutes}
                onChange={(event) =>
                  changeDuration({ ...shown, minutes: event.target.value })
                }
                onBlur={() => setTyping(null)}
              />
            </FormField>
            <p className="text-[11px] text-muted-foreground sm:col-span-2">
              Change the times and the hours and minutes follow, or type the
              hours and minutes and &ldquo;Closed at&rdquo; moves to match.
            </p>
          </>
        )}
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
          <CheckIcon />
          {closing ? "Close ticket" : "Save"}
        </Button>
      </DialogFooter>
    </form>
  );
}
