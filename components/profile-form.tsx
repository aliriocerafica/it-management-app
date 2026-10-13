"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CameraIcon, Loader2Icon } from "lucide-react";

import { ErrorToast } from "@/components/error-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SessionUser } from "@/lib/auth/dto";
import { initials } from "@/lib/laptops";

const MAX_DIMENSION = 320;

// Reads the file, downscales it on a canvas, and re-encodes as JPEG so the
// upload (and what ends up stored) stays small regardless of the original.
function resizeImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Couldn't read that file."));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () =>
        reject(new Error("That file isn't a readable image."));
      image.onload = () => {
        const scale = Math.min(
          1,
          MAX_DIMENSION / Math.max(image.width, image.height),
        );
        const width = Math.max(1, Math.round(image.width * scale));
        const height = Math.max(1, Math.round(image.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Couldn't process that image."));
          return;
        }
        ctx.drawImage(image, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      image.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

async function saveProfile(patch: { name?: string; avatarUrl?: string | null }) {
  const response = await fetch("/api/auth/me", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;
    throw new Error(body?.error ?? "Couldn't save your profile.");
  }
}

export function ProfileForm({ user }: { user: SessionUser }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl);
  const [name, setName] = useState(user.name);
  const [uploading, setUploading] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) {
      setError("Choose an image file.");
      return;
    }
    setUploading(true);
    setError(null);
    const previous = avatarUrl;
    try {
      const resized = await resizeImage(file);
      setAvatarUrl(resized);
      await saveProfile({ avatarUrl: resized });
      router.refresh();
    } catch (err) {
      setAvatarUrl(previous);
      setError(
        err instanceof Error ? err.message : "Couldn't update your photo.",
      );
    } finally {
      setUploading(false);
    }
  }

  async function handleRemovePhoto() {
    setUploading(true);
    setError(null);
    const previous = avatarUrl;
    try {
      setAvatarUrl(null);
      await saveProfile({ avatarUrl: null });
      router.refresh();
    } catch (err) {
      setAvatarUrl(previous);
      setError(
        err instanceof Error ? err.message : "Couldn't remove your photo.",
      );
    } finally {
      setUploading(false);
    }
  }

  async function handleSaveName(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || trimmed === user.name) return;
    setSavingName(true);
    setError(null);
    try {
      await saveProfile({ name: trimmed });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save your name.");
    } finally {
      setSavingName(false);
    }
  }

  return (
    <div className="flex w-full min-w-0 max-w-3xl flex-col gap-4">
      <div className="flex items-center gap-4 rounded-2xl border border-border p-4">
        <div className="relative shrink-0">
          <Avatar size="lg" className="avatar-shine size-16">
            {avatarUrl && <AvatarImage src={avatarUrl} alt={user.name} />}
            <AvatarFallback className="bg-neutral-900 text-base font-medium text-white dark:bg-white dark:text-neutral-900">
              {initials(user.name)}
            </AvatarFallback>
          </Avatar>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            aria-label="Change photo"
            className="absolute -right-1 -bottom-1 flex size-6 items-center justify-center rounded-full border-2 border-background bg-neutral-900 text-white shadow-sm transition-colors hover:bg-neutral-800 disabled:opacity-60 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            {uploading ? (
              <Loader2Icon className="size-3 animate-spin" />
            ) : (
              <CameraIcon className="size-3" />
            )}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void handleFile(file);
            }}
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold">{user.name}</p>
          <p className="truncate text-sm text-muted-foreground">
            {user.email}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
            >
              Upload photo
            </Button>
            {avatarUrl && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleRemovePhoto}
                disabled={uploading}
              >
                Remove
              </Button>
            )}
          </div>
        </div>
      </div>

      <form
        onSubmit={handleSaveName}
        className="flex flex-col gap-4 rounded-2xl border border-border p-4"
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="profile-name" className="text-xs">
            Name
          </Label>
          <Input
            id="profile-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Email</Label>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Role</Label>
          <p className="text-sm text-muted-foreground">
            {user.role === "ADMIN" ? "Admin" : "Staff"}
          </p>
        </div>
        <Button
          type="submit"
          disabled={savingName || !name.trim() || name.trim() === user.name}
          className="self-start"
        >
          {savingName ? "Saving…" : "Save name"}
        </Button>
      </form>

      <ErrorToast message={error} onDismiss={() => setError(null)} />
    </div>
  );
}
