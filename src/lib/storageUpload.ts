import type { FileOptions } from "@supabase/storage-js";
import { supabase } from "./supabaseClient";
import {
  buildSanitizedStorageColumns,
  toSanitizedUploadPayload,
  type StorageUploadMetadataInput,
} from "./storageUploadMetadata";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export type StorageUploadOptions = {
  upsert?: boolean;
  contentType?: string;
  cacheControl?: string;
  metadata?: StorageUploadMetadataInput;
  userMetadata?: StorageUploadMetadataInput | Record<string, unknown> | null;
  membershipRole?: string | null;
  /** Spieler-Hero: explizites metadata + userMetadata FormData (wie Trainer-Sanitizer). */
  playerHero?: boolean;
};

function encodeStoragePath(path: string): string {
  return path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

/** Zentraler Builder — metadata + user_metadata bereinigt. */
export function buildSanitizedStorageFileOptions(options: StorageUploadOptions): FileOptions {
  const { userMetadata } = buildSanitizedStorageColumns({
    metadata: options.metadata,
    userMetadata: options.userMetadata,
    membershipRole: options.membershipRole,
  });

  const fileOptions: FileOptions = {
    upsert: options.upsert,
    contentType: options.contentType,
    cacheControl: options.cacheControl,
  };

  if (Object.keys(userMetadata).length > 0) {
    fileOptions.metadata = userMetadata;
  }

  return fileOptions;
}

async function uploadViaSanitizedMultipartForm(
  bucket: string,
  path: string,
  file: File,
  options: StorageUploadOptions,
): Promise<{ error: { message: string } | null; fileOptions: FileOptions }> {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) {
    return { error: { message: "Unauthorized" }, fileOptions: buildSanitizedStorageFileOptions(options) };
  }

  const fileOptions = buildSanitizedStorageFileOptions(options);
  const { userMetadata } = buildSanitizedStorageColumns({
    metadata: options.metadata,
    userMetadata: options.userMetadata,
    membershipRole: options.membershipRole,
  });

  const sanitizedOptions = toSanitizedUploadPayload(fileOptions, userMetadata);
  console.log("PLAYER HERO UPLOAD OPTIONS SANITIZED", sanitizedOptions);

  const form = new FormData();
  form.append("cacheControl", options.cacheControl ?? "3600");
  if (Object.keys(userMetadata).length > 0) {
    const json = JSON.stringify(userMetadata);
    form.append("metadata", json);
    form.append("userMetadata", json);
  }
  form.append("", file, file.name);

  const response = await fetch(
    `${supabaseUrl}/storage/v1/object/${encodeURIComponent(bucket)}/${encodeStoragePath(path)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: supabaseAnonKey,
        "x-upsert": String(options.upsert ?? false),
      },
      body: form,
    },
  );

  if (!response.ok) {
    let message = response.statusText;
    try {
      const body = (await response.json()) as { message?: string; error?: string };
      message = body.message ?? body.error ?? message;
    } catch {
      // ignore parse errors
    }
    return { error: { message }, fileOptions };
  }

  return { error: null, fileOptions };
}

/** Storage-Upload mit bereinigter metadata/user_metadata — membership_role nie als leerer String. */
export async function uploadStorageObject(
  bucket: string,
  path: string,
  file: File | Blob | ArrayBuffer,
  options: StorageUploadOptions = {},
): Promise<{ error: { message: string } | null; fileOptions: FileOptions }> {
  if (options.playerHero && file instanceof File) {
    return uploadViaSanitizedMultipartForm(bucket, path, file, options);
  }

  const fileOptions = buildSanitizedStorageFileOptions(options);
  const { error } = await supabase.storage.from(bucket).upload(path, file, fileOptions);
  return { error: error ? { message: error.message } : null, fileOptions };
}
