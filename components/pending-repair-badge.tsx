"use client";

import { CircleCheckIcon, TriangleAlertIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// Alert icon for an asset that's back in use (or in stock) with a repair
// still outstanding. Hover or focus shows what's wrong.
export function PendingRepairIcon({
  issue,
  className,
}: {
  issue: string;
  className?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            tabIndex={0}
            role="img"
            aria-label={`Pending repair: ${issue}`}
            className={cn(
              "inline-flex size-5 shrink-0 cursor-help items-center justify-center rounded text-amber-600 hover:bg-amber-500/10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none dark:text-amber-400",
              className,
            )}
          />
        }
      >
        <TriangleAlertIcon className="size-3.5" />
      </TooltipTrigger>
      <TooltipContent side="top" className="flex-col items-start gap-0.5">
        <span className="font-semibold">Pending repair</span>
        <span className="whitespace-normal">{issue}</span>
      </TooltipContent>
    </Tooltip>
  );
}

// Clears the pending repair (the table asks for confirmation first).
export function RepairedButton({
  onClick,
  className,
}: {
  onClick: () => void;
  className?: string;
}) {
  return (
    <Button
      variant="outline"
      size="xs"
      className={cn("h-5 gap-1 px-1.5 text-[11px]", className)}
      onClick={onClick}
    >
      <CircleCheckIcon className="size-3" />
      Repaired
    </Button>
  );
}
