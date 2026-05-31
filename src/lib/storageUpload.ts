import type { FileOptions } from "@supabase/storage-js";
import { supabase } from "./supabaseClient";
import {
  buildStorageMetadata,
  toMetadataInput,
  type StorageUploadMetadataInput,
} from "./storageUploadMetadata";

export type StorageUploadOptions = {
  upsert?: boolean;
  contentType?: string;
  cacheControl?: string;
  metadata?: StorageUploadMetadataInput;
  userMetadata?: StorageUploadMetadataInput | Record<string, unknown> | null;
  membershipRole?: string | null;
  /** Auth-Session user_metadata einlesen und mit sanitizen (Spieler-Hero). */
  includeAuthUserMetadata?: boolean;
  debugLabel?: string;
};

async function resolveAuthUserMetadata(): Promise<StorageUploadMetadataInput> {
  try {
    const { data } = await supabase.auth.getSession();
    return toMetadataInput(data.session?.user?.user_metadata);
  } catch {
    return {};
  }
}

/** Zentraler Builder — metadata + user_metadata bereinigt, membership_role nie "". */
export async function buildSanitizedStorageFileOptions(
  options: StorageUploadOptions,
): Promise<FileOptions> {
  const authUserMetadata = options.includeAuthUserMetadata ? await resolveAuthUserMetadata() : null;

  const fileOptions: FileOptions = {
    upsert: options.upsert,
    contentType: options.contentType,
    cacheControl: options.cacheControl,
  };

  const metadata = buildStorageMetadata(options.metadata, options.membershipRole, {
    ...(authUserMetadata ?? {}),
    ...toMetadataInput(options.userMetadata),
  });

  if (Object.keys(metadata).length > 0) {
    fileOptions.metadata = metadata;
  }

  return fileOptions;
}

/** Storage-Upload mit bereinigter metadata/user_metadata — membership_role nie als leerer String. */
export async function uploadStorageObject(
  bucket: string,
  path: string,
  file: File | Blob | ArrayBuffer,
  options: StorageUploadOptions = {},
): Promise<{ error: { message: string } | null; fileOptions: FileOptions }> {
  const fileOptions = await buildSanitizedStorageFileOptions(options);

  if (options.debugLabel === "player-hero") {
    console.log("player hero upload sanitized options", fileOptions);
  }

  const { error } = await supabase.storage.from(bucket).upload(path, file, fileOptions);
  return { error: error ? { message: error.message } : null, fileOptions };
}
