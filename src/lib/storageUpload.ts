import type { FileOptions } from "@supabase/storage-js";
import { supabase } from "./supabaseClient";
import {
  buildStorageMetadata,
  cleanStorageMetadata,
  type StorageUploadMetadataInput,
} from "./storageUploadMetadata";

export type StorageUploadOptions = {
  upsert?: boolean;
  contentType?: string;
  cacheControl?: string;
  metadata?: StorageUploadMetadataInput;
  membershipRole?: string | null;
};

function toFileOptions(options: StorageUploadOptions): FileOptions {
  const fileOptions: FileOptions = {
    upsert: options.upsert,
    contentType: options.contentType,
    cacheControl: options.cacheControl,
  };

  const metadata = options.membershipRole
    ? buildStorageMetadata(options.metadata, options.membershipRole)
    : cleanStorageMetadata(options.metadata);

  if (Object.keys(metadata).length > 0) {
    fileOptions.metadata = metadata;
  }

  return fileOptions;
}

/** Storage-Upload mit bereinigter metadata — membership_role nie als leerer String. */
export async function uploadStorageObject(
  bucket: string,
  path: string,
  file: File | Blob | ArrayBuffer,
  options: StorageUploadOptions = {},
): Promise<{ error: { message: string } | null }> {
  const { error } = await supabase.storage.from(bucket).upload(path, file, toFileOptions(options));
  return { error: error ? { message: error.message } : null };
}
