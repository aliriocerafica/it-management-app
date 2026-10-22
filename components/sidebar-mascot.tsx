"use client"

import { useSyncExternalStore } from "react"
import { RefreshCwIcon } from "lucide-react"
import { Mascot } from "page-mascot"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { SessionUser } from "@/lib/auth/dto"
import { cn } from "@/lib/utils"

// Each has a pair of sprite sheets in public/mascots.
const mascots = [
  "cat",
  "bear",
  "bunny",
  "dino",
  "fox",
  "frog",
  "koala",
  "owl",
  "panda",
  "penguin",
  "pug",
  "raccoon",
  "tiger",
] as const
type MascotName = (typeof mascots)[number]

// Drains the colour and deepens the blacks so the full-colour sheets read as
// black-and-white ink drawings.
const inkLook = "grayscale contrast-125 brightness-95"

// What sits at the top of the sidebar: one of the mascots, or the user's own
// profile photo.
type Choice = MascotName | "profile"
type ProfileUser = Pick<SessionUser, "name" | "avatarUrl">

const storageKey = "sidebar-mascot"
const defaultMascot: MascotName = "cat"
const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  window.addEventListener("storage", listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener("storage", listener)
  }
}

function currentMascot(): Choice {
  try {
    const saved = window.localStorage.getItem(storageKey)
    if (saved === "profile") return saved
    return mascots.find((name) => name === saved) ?? defaultMascot
  } catch {
    return defaultMascot
  }
}

function chooseMascot(name: Choice) {
  try {
    window.localStorage.setItem(storageKey, name)
  } catch {
    // Storage blocked: the choice just won't be remembered.
  }
  for (const listener of listeners) listener()
}

// The mascot (or profile photo) this browser picked, remembered in
// localStorage.
function useMascot() {
  return useSyncExternalStore<Choice>(
    subscribe,
    currentMascot,
    () => defaultMascot,
  )
}

function ProfileAvatar({
  user,
  className,
}: {
  user: ProfileUser
  className?: string
}) {
  return (
    <Avatar className={cn("shrink-0", className)}>
      {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.name} />}
      <AvatarFallback className="bg-neutral-900 font-medium text-white dark:bg-white dark:text-neutral-900">
        {user.name.trim()[0]?.toUpperCase() ?? "?"}
      </AvatarFallback>
    </Avatar>
  )
}

// The centre frame of a mascot's directions sheet, as a still picture. With
// no name it shows whatever this browser picked, which may be the profile
// photo instead.
export function MascotStill({
  name,
  user,
  className,
}: {
  name?: MascotName
  user?: ProfileUser
  className?: string
}) {
  const chosen = useMascot()
  if (!name && chosen === "profile" && user) {
    return (
      <ProfileAvatar user={user} className={cn("avatar-shine", className)} />
    )
  }
  const shown = name ?? (chosen === "profile" ? defaultMascot : chosen)
  return (
    <span
      aria-hidden
      style={{
        backgroundImage: `url(/mascots/${shown}-directions.webp)`,
      }}
      className={cn(
        "block shrink-0 bg-size-[300%_300%] bg-center bg-no-repeat",
        inkLook,
        className,
      )}
    />
  )
}

// The cursor-following mascot at the top of the sidebar, with a small button
// on its corner for switching to another animal or to the profile photo.
export function SidebarMascot({ user }: { user: ProfileUser }) {
  const chosen = useMascot()

  return (
    <div className="relative shrink-0">
      {chosen === "profile" ? (
        <ProfileAvatar user={user} className="avatar-shine size-11 text-base transition-[width,height] duration-300 ease-sidebar motion-reduce:duration-0 group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:text-sm" />
      ) : (
        <Mascot
          key={chosen}
          directions={`/mascots/${chosen}-directions.webp`}
          reactions={`/mascots/${chosen}-reactions.webp`}
          size={64}
          label={chosen}
          className={inkLook}
        />
      )}
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Change mascot or show profile photo"
          title="Change mascot or show profile photo"
          className={cn(
            "absolute flex items-center justify-center rounded-full border border-sidebar-border bg-sidebar text-muted-foreground outline-none hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring",
            // The photo fills its whole circle, unlike the mascot's sheet, so
            // the button sits smaller and half outside it, ringed in the
            // sidebar colour like a status badge.
            chosen === "profile"
              ? "-right-1.5 -bottom-1.5 size-5 shadow-[0_0_0_2px_var(--sidebar)]"
              : "right-0 bottom-0 size-6",
          )}
        >
          <RefreshCwIcon
            className={chosen === "profile" ? "size-2.5" : "size-3"}
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          className="grid w-auto min-w-0 grid-cols-4 gap-1 rounded-2xl p-2"
          side="bottom"
          align="start"
          sideOffset={8}
        >
          <DropdownMenuItem
            onClick={() => chooseMascot("profile")}
            className={cn(
              "col-span-4 gap-2.5 rounded-xl p-2 font-medium",
              chosen === "profile" && "bg-accent",
            )}
          >
            <ProfileAvatar user={user} className="size-8 text-xs" />
            Show profile photo
          </DropdownMenuItem>
          <p className="col-span-4 px-2 pt-1 text-xs text-muted-foreground">
            Or show a page mascot
          </p>
          {mascots.map((name) => (
            <DropdownMenuItem
              key={name}
              aria-label={name}
              title={name}
              onClick={() => chooseMascot(name)}
              className={cn(
                "justify-center rounded-xl p-1",
                name === chosen && "bg-accent",
              )}
            >
              <MascotStill name={name} className="size-12" />
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
