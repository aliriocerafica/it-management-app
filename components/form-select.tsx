"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDownIcon } from "lucide-react";

import { selectClass } from "@/components/add-laptop-dialog";
import { cn } from "@/lib/utils";

// A select whose menu is positioned on the viewport. Native menus are cut
// off inside dialogs, which scroll and are centered with a transform.
export function FormSelect({
  id,
  name,
  options,
  defaultValue,
}: {
  id: string;
  name: string;
  options: { value: string; label: string }[];
  defaultValue?: string;
}) {
  const initial = defaultValue ?? options[0]?.value ?? "";
  const [value, setValue] = useState(initial);
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
    upward: boolean;
  } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const selected = options.find((option) => option.value === value);

  function openMenu() {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    const spaceAbove = rect.top - 8;
    const upward = spaceBelow < 160 && spaceAbove > spaceBelow;
    setMenu({
      top: upward ? rect.top - 4 : rect.bottom + 4,
      left: rect.left,
      width: rect.width,
      maxHeight: Math.max(120, Math.min(280, upward ? spaceAbove : spaceBelow)),
      upward,
    });
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (rootRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    function onScroll(event: Event) {
      const target = event.target;
      if (target instanceof Node && rootRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onScroll);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onScroll);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  return (
    <div ref={rootRef}>
      <button
        ref={buttonRef}
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(selectClass, "flex items-center justify-between gap-2 text-left")}
        onClick={() => (open ? setOpen(false) : openMenu())}
      >
        <span className="truncate">{selected?.label ?? "Select"}</span>
        <ChevronDownIcon className="size-3.5 shrink-0 text-muted-foreground" />
      </button>
      <input type="hidden" name={name} value={value} />
      {open && menu && (
        <div
          role="listbox"
          aria-labelledby={id}
          style={{
            top: menu.top,
            left: menu.left,
            width: menu.width,
            maxHeight: menu.maxHeight,
            transform: menu.upward ? "translateY(-100%)" : undefined,
          }}
          className="fixed z-50 overflow-y-auto rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10"
        >
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                className={cn(
                  "flex w-full rounded-md px-2 py-1.5 text-left text-sm outline-none hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground",
                  isSelected && "bg-accent text-accent-foreground",
                )}
                onClick={() => {
                  setValue(option.value);
                  setOpen(false);
                  buttonRef.current?.focus();
                }}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
