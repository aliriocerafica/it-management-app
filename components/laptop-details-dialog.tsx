"use client";

import {
  CalendarIcon,
  CpuIcon,
  LaptopIcon,
  PlugIcon,
  HistoryIcon,
  UserIcon,
  WrenchIcon,
  type LucideIcon,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  formatAge,
  formatSpan,
  formatDate,
  initials,
  parseDate,
  statusStyles,
  warrantyInfo,
  type ChargerCondition,
  type Laptop,
  type OwnershipEntry,
} from "@/lib/laptops";
import { cn } from "@/lib/utils";

const chargerConditionStyles: Record<ChargerCondition, string> = {
  Good: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  "Worn cable": "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  Replaced: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
  Missing: "bg-red-500/10 text-red-700 dark:text-red-400",
};

export function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border p-4">
      <h3 className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
        <Icon className="size-3.5" />
        {title}
      </h3>
      <dl className="flex flex-col gap-2.5">{children}</dl>
    </section>
  );
}

export function Detail({
  label,
  children,
  mono,
}: {
  label: string;
  children: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "min-w-0 text-right font-medium break-words",
          mono && "font-mono text-xs",
        )}
      >
        {children}
      </dd>
    </div>
  );
}

export function Pill({
  className,
  children,
}: {
  className: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-xs font-medium",
        className,
      )}
    >
      {children}
    </span>
  );
}

type TimelineItem = Pick<Laptop, "history" | "purchaseDate" | "status">;

export function OwnershipTimeline({
  laptop,
  today,
}: {
  laptop: TimelineItem;
  today: Date | null;
}) {
  const owners = new Set(
    laptop.history.flatMap((entry) => (entry.handler ? [entry.handler] : [])),
  ).size;

  return (
    <section className="flex min-h-0 flex-col rounded-xl border border-border p-4 sm:col-span-2 lg:col-span-1">
      <h3 className="mb-4 flex shrink-0 items-center gap-1.5 text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
        <HistoryIcon className="size-3.5" />
        Ownership history
        <span className="ml-auto font-medium tracking-normal normal-case">
          {owners} {owners === 1 ? "owner" : "owners"}
        </span>
      </h3>
      <ol className="min-h-0 overflow-y-auto [scrollbar-width:none] max-h-64 sm:max-h-80 lg:max-h-[calc(100svh-22rem)] [&::-webkit-scrollbar]:hidden">
        <TimelineStep
          dot={
            <span className="size-3 rounded-full border-2 border-muted-foreground/40 bg-card" />
          }
          title="Purchased"
          dates={formatDate(parseDate(laptop.purchaseDate))}
        />
        {laptop.history.map((entry, index) => (
          <TimelineStep
            key={`${entry.from}-${index}`}
            isLast={index === laptop.history.length - 1}
            dot={<EntryDot entry={entry} laptop={laptop} />}
            title={entry.handler ?? "With IT"}
            subtitle={entry.department}
            current={entry.to === null}
            dates={`${formatDate(parseDate(entry.from))} – ${
              entry.to ? formatDate(parseDate(entry.to)) : "Present"
            }`}
            duration={
              today
                ? formatSpan(
                    parseDate(entry.from),
                    entry.to ? parseDate(entry.to) : today,
                  )
                : undefined
            }
            note={entry.note}
          />
        ))}
      </ol>
    </section>
  );
}

function EntryDot({
  entry,
  laptop,
}: {
  entry: OwnershipEntry;
  laptop: TimelineItem;
}) {
  if (entry.to === null) {
    return (
      <span
        className={cn(
          "size-3 rounded-full ring-4 ring-foreground/10",
          statusStyles[laptop.status].dot,
        )}
      />
    );
  }
  if (entry.handler === null) {
    return (
      <span className="size-3 rounded-full border-2 border-muted-foreground/60 bg-card" />
    );
  }
  return <span className="size-3 rounded-full bg-muted-foreground/50" />;
}

function TimelineStep({
  dot,
  title,
  subtitle,
  dates,
  duration,
  note,
  current,
  isLast,
}: {
  dot: React.ReactNode;
  title: string;
  subtitle?: string;
  dates: string;
  duration?: string;
  note?: string;
  current?: boolean;
  isLast?: boolean;
}) {
  return (
    <li className="relative flex gap-3 pb-5 last:pb-0">
      {!isLast && (
        <span
          aria-hidden
          className="absolute top-4 -bottom-0.5 left-1.5 w-px -translate-x-1/2 bg-border"
        />
      )}
      <span className="relative flex h-5 w-3 shrink-0 items-center justify-center">
        {dot}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className={cn("font-medium", !current && "text-foreground/80")}>
            {title}
          </span>
          {subtitle && (
            <span className="text-xs text-muted-foreground">{subtitle}</span>
          )}
          {current && (
            <span className="rounded bg-foreground px-1.5 py-px text-[10px] font-semibold text-background">
              Current
            </span>
          )}
          {duration && (
            <span className="ml-auto text-xs text-muted-foreground tabular-nums">
              {duration}
            </span>
          )}
        </div>
        <span className="text-xs text-muted-foreground tabular-nums">
          {dates}
        </span>
        {note && (
          <span className="text-xs text-muted-foreground italic">{note}</span>
        )}
      </div>
    </li>
  );
}

export function LaptopDetailsDialog({
  laptop,
  open,
  onOpenChange,
  today,
}: {
  laptop: Laptop | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  today: Date | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100svh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl lg:max-w-5xl">
        {laptop && <LaptopDetails laptop={laptop} today={today} />}
      </DialogContent>
    </Dialog>
  );
}

function LaptopDetails({
  laptop,
  today,
}: {
  laptop: Laptop;
  today: Date | null;
}) {
  const status = statusStyles[laptop.status];
  const warranty = today ? warrantyInfo(laptop, today) : null;
  const { charger } = laptop;

  return (
    <>
      <DialogHeader className="flex-row items-center gap-4 border-b border-border px-6 py-5 pr-12">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-muted">
          <LaptopIcon className="size-6" />
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <DialogTitle className="text-lg font-semibold">
            {laptop.brand} {laptop.model}
          </DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            <span className="font-mono">{laptop.assetTag}</span>
            <span aria-hidden>·</span>
            <span className="font-mono">SN {laptop.serialNumber}</span>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded border border-border px-1.5 py-px text-[11px] font-medium",
                status.text,
              )}
            >
              <span className={cn("size-1.5 rounded-full", status.dot)} />
              {laptop.status}
            </span>
          </DialogDescription>
        </div>
      </DialogHeader>

      <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto px-6 py-5 [scrollbar-width:none] sm:grid-cols-2 lg:grid-cols-3 [&::-webkit-scrollbar]:hidden">
        {laptop.status === "In repair" && (
          <section className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 sm:col-span-2 lg:col-span-3">
            <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.08em] text-amber-700 uppercase dark:text-amber-400">
              <WrenchIcon className="size-3.5" />
              Repair details
            </h3>
            <p className="text-sm">
              {laptop.repairIssue || (
                <span className="text-muted-foreground italic">
                  No problem recorded.
                </span>
              )}
            </p>
          </section>
        )}
        <div className="flex flex-col gap-4">
          <Section title="Assignment" icon={UserIcon}>
            {laptop.handler ? (
              <div className="flex items-center gap-3">
                <Avatar className="size-9 after:rounded-full">
                  <AvatarFallback className="bg-muted text-xs font-medium">
                    {initials(laptop.handler)}
                  </AvatarFallback>
                </Avatar>
                <div className="leading-tight">
                  <div className="font-medium">{laptop.handler}</div>
                  <div className="text-xs text-muted-foreground">
                    {laptop.department}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground italic">
                Not assigned to anyone
              </p>
            )}
            <Detail label="Color">
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="size-3 rounded-full ring-1 ring-foreground/15"
                  style={{ backgroundColor: laptop.colorHex }}
                />
                {laptop.color}
              </span>
            </Detail>
          </Section>

          <Section title="Specifications" icon={CpuIcon}>
            <Detail label="Processor">{laptop.cpu}</Detail>
            <Detail label="Memory">{laptop.ram}</Detail>
            <Detail label="Storage">{laptop.storage}</Detail>
            <Detail label="OS">{laptop.os}</Detail>
          </Section>
        </div>

        <div className="flex flex-col gap-4">
          <Section title="Purchase & warranty" icon={CalendarIcon}>
            <Detail label="Purchased">
              {formatDate(parseDate(laptop.purchaseDate))}
            </Detail>
            <Detail label="Age">
              {today ? formatAge(laptop.purchaseDate, today) : "—"}
            </Detail>
            <Detail label="Warranty">
              {laptop.warrantyYears} yr
              {laptop.warrantyYears === 1 ? "" : "s"}
            </Detail>
            {warranty && (
              <Detail label={warranty.state === "Expired" ? "Ended" : "Until"}>
                <span className="inline-flex items-center gap-2">
                  <Pill
                    className={cn(
                      warranty.state === "Active" &&
                        "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
                      warranty.state === "Expiring" &&
                        "bg-amber-500/10 text-amber-700 dark:text-amber-400",
                      warranty.state === "Expired" &&
                        "bg-muted text-muted-foreground",
                    )}
                  >
                    {warranty.state}
                  </Pill>
                  {formatDate(warranty.end)}
                </span>
              </Detail>
            )}
          </Section>

          <Section title="Charger" icon={PlugIcon}>
            <Detail label="Condition">
              <Pill className={chargerConditionStyles[charger.condition]}>
                {charger.condition}
              </Pill>
            </Detail>
            <Detail label="Connector">{charger.connector}</Detail>
            <Detail label="Power">{charger.wattage} W</Detail>
            <Detail label="Part no." mono>
              {charger.partNumber}
            </Detail>
            <Detail label="Serial no." mono>
              {charger.serialNumber}
            </Detail>
          </Section>
        </div>

        <OwnershipTimeline laptop={laptop} today={today} />
      </div>

      <DialogFooter showCloseButton className="mx-0 mb-0 px-6 py-4" />
    </>
  );
}
