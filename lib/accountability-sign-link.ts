import { del, get, put } from "@vercel/blob"

import { generateOpaqueToken, hashToken } from "@/lib/crypto"
import { prisma } from "@/lib/prisma"

export const SIGN_LINK_TTL_DAYS = 14

// Kept under the host's request-size limit.
export const SIGNED_COPY_MAX_BYTES = 4 * 1024 * 1024

// Issues a private upload link for one form version; returns the raw token
// to put in the emailed URL. Only its hash is stored.
export async function createSignLink(formId: string) {
  const token = generateOpaqueToken()
  await prisma.accountabilityFormSignLink.create({
    data: {
      formId,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + SIGN_LINK_TTL_DAYS * 86_400_000),
    },
  })
  return token
}

// The unexpired link for this raw value, with the form it belongs to.
export async function findSignLink(rawToken: string) {
  if (!/^[0-9a-f]{64}$/.test(rawToken)) return null
  const link = await prisma.accountabilityFormSignLink.findUnique({
    where: { tokenHash: hashToken(rawToken) },
    select: {
      id: true,
      expiresAt: true,
      form: {
        select: { id: true, holderName: true, version: true, signedAt: true },
      },
    },
  })
  if (!link || link.expiresAt <= new Date()) return null
  return link
}

// What a file really is, from its first bytes rather than its name. Null
// for anything that isn't a PDF or a common photo format.
export function signedCopyType(bytes: Uint8Array) {
  const starts = (...signature: number[]) =>
    signature.every((byte, index) => bytes[index] === byte)
  if (starts(0x25, 0x50, 0x44, 0x46, 0x2d)) {
    return { contentType: "application/pdf", extension: "pdf" }
  }
  if (starts(0xff, 0xd8, 0xff)) {
    return { contentType: "image/jpeg", extension: "jpg" }
  }
  if (starts(0x89, 0x50, 0x4e, 0x47)) {
    return { contentType: "image/png", extension: "png" }
  }
  return null
}

// Removes stored files that nothing points at any more. Best effort: a
// leftover file is harmless, so a storage hiccup shouldn't fail the caller.
export async function deleteSignedCopyFiles(urls: string[]) {
  if (urls.length === 0) return
  try {
    await del(urls)
  } catch (error) {
    console.error("Deleting signed-copy files failed", error)
  }
}

// Stores the uploaded signed copy and marks the form signed. Returns false
// if the form was signed in the meantime, so a link can't overwrite a copy
// IT has already accepted.
export async function saveSignedCopy(
  link: { id: string; form: { id: string; holderName: string; version: number } },
  file: { bytes: Uint8Array<ArrayBuffer>; contentType: string; extension: string },
) {
  // Private: the file can only be read through the app, by a signed-in user.
  const stored = await put(
    `signed-forms/${link.form.id}/signed.${file.extension}`,
    Buffer.from(file.bytes),
    { access: "private", addRandomSuffix: true, contentType: file.contentType },
  )

  const now = new Date()
  const replaced = await prisma.$transaction(async (tx) => {
    const { count } = await tx.accountabilityForm.updateMany({
      where: { id: link.form.id, signedAt: null },
      data: { signedAt: now, signedByName: `${link.form.holderName} (uploaded)` },
    })
    if (count === 0) return null
    // One copy per form: a re-upload after IT reset it replaces the old one.
    const earlier = await tx.accountabilityFormSignLink.findMany({
      where: { formId: link.form.id, blobUrl: { not: null } },
      select: { blobUrl: true },
    })
    await tx.accountabilityFormSignLink.updateMany({
      where: { formId: link.form.id, uploadedAt: { not: null } },
      data: { fileName: null, contentType: null, blobUrl: null, uploadedAt: null },
    })
    await tx.accountabilityFormSignLink.update({
      where: { id: link.id },
      data: {
        fileName: `Signed Accountability Form - ${link.form.holderName} - v${link.form.version}.${file.extension}`,
        contentType: file.contentType,
        blobUrl: stored.url,
        uploadedAt: now,
      },
    })
    return earlier.flatMap((row) => (row.blobUrl ? [row.blobUrl] : []))
  })

  await deleteSignedCopyFiles(replaced ?? [stored.url])
  return replaced !== null
}

export async function getSignedCopy(formId: string) {
  const link = await prisma.accountabilityFormSignLink.findFirst({
    where: { formId, uploadedAt: { not: null } },
    orderBy: { uploadedAt: "desc" },
    select: { fileName: true, contentType: true, blobUrl: true },
  })
  if (!link?.blobUrl || !link.contentType || !link.fileName) return null
  const stored = await get(link.blobUrl, { access: "private", useCache: false })
  if (!stored?.stream) return null
  return {
    fileName: link.fileName,
    contentType: link.contentType,
    stream: stored.stream,
  }
}
