"use client";

import {
  CalendarIcon,
  SlidersHorizontalIcon,
  UserIcon,
  type LucideIcon,
} from "lucide-react";

import {
  Detail,
  OwnershipTimeline,
  Pill,
  Section,
} from "@/components/laptop-details-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { type Accessory, type AccessoryConfig } from "@/lib/accessories";
import {
  formatAge,
  formatDate,
  initials,
  parseDate,
  statusStyles,
  warrantyInfo,
} from "@/lib/laptops";
import { cn } from "@/lib/utils";

export function AccessoryDetailsDialog({
  item,
  config,
  icon,
  open,
  onOpenChange,
  today,
}: {
  item: Accessory | null;
  config: AccessoryConfig;
  icon: LucideIcon;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  today: Date | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100svh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl lg:max-w-5xl">
        {item && (
          <AccessoryDetails
            item={item}
            config={config}
            icon={icon}
            today={today}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function AccessoryDetails({
  item,
  config,
  icon: Icon,
  today,
}: {
  item: Accessory;
  config: AccessoryConfig;
  icon: LucideIcon;
  today: Date | null;
}) {
  const status = statusStyles[item.status];
  const warranty = today ? warrantyInfo(item, today) : null;

  return (
    <>
      <DialogHeader className="flex-row items-center gap-4 border-b border-border px-6 py-5 pr-12">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-muted">
          <Icon className="size-6" />
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <DialogTitle className="text-lg font-semibold">
            {item.brand} {item.model}
          </DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            <span className="font-mono">{item.assetTag}</span>
            <span aria-hidden>·</span>
            <span className="font-mono">SN {item.serialNumber}</span>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded border border-border px-1.5 py-px text-[11px] font-medium",
                status.text,
              )}
            >
              <span className={cn("size-1.5 rounded-full", status.dot)} />
              {item.status}
            </span>
          </DialogDescription>
        </div>
      </DialogHeader>

      <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto px-6 py-5 [scrollbar-width:none] sm:grid-cols-2 lg:grid-cols-3 [&::-webkit-scrollbar]:hidden">
        <div className="flex flex-col gap-4">
          <Section title="Assignment" icon={UserIcon}>
            {item.handler ? (
              <div className="flex items-center gap-3">
                <Avatar className="size-9 after:rounded-full">
                  <AvatarFallback className="bg-muted text-xs font-medium">
                    {initials(item.handler)}
                  </AvatarFallback>
                </Avatar>
                <div className="leading-tight">
                  <div className="font-medium">{item.handler}</div>
                  <div className="text-xs text-muted-foreground">
                    {item.department}
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
                  style={{ backgroundColor: item.colorHex }}
                />
                {item.color}
              </span>
            </Detail>
          </Section>

          <Section title="Specifications" icon={SlidersHorizontalIcon}>
            {config.specFields.map((field) => (
              <Detail key={field.key} label={field.label}>
                {item.specs[field.key] || "—"}
              </Detail>
            ))}
          </Section>
        </div>

        <div className="flex flex-col gap-4">
          <Section title="Purchase & warranty" icon={CalendarIcon}>
            <Detail label="Purchased">
              {formatDate(parseDate(item.purchaseDate))}
            </Detail>
            <Detail label="Age">
              {today ? formatAge(item.purchaseDate, today) : "—"}
            </Detail>
            <Detail label="Warranty">
              {item.warrantyYears} yr{item.warrantyYears === 1 ? "" : "s"}
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
        </div>

        <OwnershipTimeline laptop={item} today={today} />
      </div>

      <DialogFooter showCloseButton className="mx-0 mb-0 px-6 py-4" />
    </>
  );
}
