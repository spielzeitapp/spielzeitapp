import type { FileOptions } from "@supabase/storage-js";
import { supabase } from "./supabaseClient";
import { buildSanitizedStorageColumns, type StorageUploadMetadataInput } from "./storageUploadMetadata";

export type StorageUploadOptions = {
  upsert?: boolean;
  contentType?: string;
  cacheControl?: string;
  metadata?: StorageUploadMetadataInput;
  debugLabel?: string;
};

/** Zentraler Builder — wie Trainer-Upload, membership_role nie als leerer String. */
export function buildSanitizedStorageFileOptions(options: StorageUploadOptions): FileOptions {
  const { userMetadata } = buildSanitizedStorageColumns({ metadata: options.metadata });

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

/** Storage-Upload mit bereinigter metadata — ein Pfad für Trainer + Spieler. */
export async function uploadStorageObject(
  bucket: string,
  path: string,
  file: File | Blob | ArrayBuffer,
  options: StorageUploadOptions = {},
): Promise<{ error: { message: string } | null; fileOptions: FileOptions }> {
  const fileOptions = buildSanitizedStorageFileOptions(options);

  if (options.debugLabel === "player") {
    console.log("PLAYER UPLOAD FINAL OPTIONS", fileOptions);
  }

  const { error } = await supabase.storage.from(bucket).upload(path, file, fileOptions);
  return { error: error ? { message: error.message } : null, fileOptions };
}
