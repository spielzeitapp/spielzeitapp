/** Gültige Werte für storage.objects.user_metadata.membership_role (Postgres enum). */
export const VALID_MEMBERSHIP_ROLES = [
  "trainer",
  "co_trainer",
  "head_coach",
  "parent",
  "player",
  "fan",
  "admin",
] as const;

export type ValidMembershipRole = (typeof VALID_MEMBERSHIP_ROLES)[number];

export type StorageUploadMetadataInput = Record<string, string | null | undefined>;

export function toMetadataInput(value: unknown): StorageUploadMetadataInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: StorageUploadMetadataInput = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof raw === "string" || raw == null) {
      out[key] = raw;
    } else if (typeof raw === "number" || typeof raw === "boolean") {
      out[key] = String(raw);
    }
  }
  return out;
}

function stripInvalidMembershipRole(record: Record<string, string>): Record<string, string> {
  const rawRole = record.membership_role?.trim().toLowerCase();
  if (!rawRole || !VALID_MEMBERSHIP_ROLES.includes(rawRole as ValidMembershipRole)) {
    delete record.membership_role;
  } else {
    record.membership_role = rawRole;
  }
  return record;
}

/** Entfernt leere Werte und ungültige membership_role — niemals "" an Storage senden. */
export function cleanStorageMetadata(
  metadata?: StorageUploadMetadataInput | null,
): Record<string, string> {
  const cleaned = Object.fromEntries(
    Object.entries(metadata ?? {}).filter(([, value]) => value !== "" && value != null),
  ) as Record<string, string>;

  delete cleaned.user_metadata;
  return stripInvalidMembershipRole(cleaned);
}

/** user_metadata-Spalte bereinigen — membership_role nie als leerer String. */
export function cleanUserMetadataForStorage(
  userMetadata?: StorageUploadMetadataInput | Record<string, unknown> | null,
): Record<string, string> {
  return cleanStorageMetadata(toMetadataInput(userMetadata));
}

export function membershipRoleForStorageMetadata(
  role: string | null | undefined,
): ValidMembershipRole | undefined {
  const normalized = (role ?? "").trim().toLowerCase();
  if (!normalized) return undefined;
  if (VALID_MEMBERSHIP_ROLES.includes(normalized as ValidMembershipRole)) {
    return normalized as ValidMembershipRole;
  }
  return undefined;
}

export type SanitizedStorageColumns = {
  userMetadata: Record<string, string>;
};

/** metadata + user_metadata gemeinsam bereinigen (Supabase schreibt beides in user_metadata). */
export function buildSanitizedStorageColumns(input: {
  metadata?: StorageUploadMetadataInput | null;
  userMetadata?: StorageUploadMetadataInput | Record<string, unknown> | null;
  membershipRole?: string | null;
}): SanitizedStorageColumns {
  const merged: StorageUploadMetadataInput = {
    ...cleanUserMetadataForStorage(input.userMetadata),
    ...cleanStorageMetadata(input.metadata),
  };

  const role = membershipRoleForStorageMetadata(
    input.membershipRole ?? merged.membership_role,
  );

  if (role) {
    merged.membership_role = role;
  } else {
    delete merged.membership_role;
  }

  return { userMetadata: cleanStorageMetadata(merged) };
}

/** @deprecated Alias — nutze buildSanitizedStorageColumns */
export function buildStorageMetadata(
  metadata?: StorageUploadMetadataInput | null,
  membershipRole?: string | null,
  userMetadata?: StorageUploadMetadataInput | Record<string, unknown> | null,
): Record<string, string> {
  return buildSanitizedStorageColumns({ metadata, membershipRole, userMetadata }).userMetadata;
}

export type SanitizedStorageUploadPayload = {
  upsert?: boolean;
  contentType?: string;
  cacheControl?: string;
  metadata?: Record<string, string>;
  user_metadata?: Record<string, string>;
};

export function toSanitizedUploadPayload(
  fileOptions: {
    upsert?: boolean;
    contentType?: string;
    cacheControl?: string;
    metadata?: Record<string, string>;
  },
  userMetadata: Record<string, string>,
): SanitizedStorageUploadPayload {
  const payload: SanitizedStorageUploadPayload = {
    upsert: fileOptions.upsert,
    contentType: fileOptions.contentType,
    cacheControl: fileOptions.cacheControl,
  };

  if (Object.keys(userMetadata).length > 0) {
    payload.metadata = userMetadata;
    payload.user_metadata = userMetadata;
  }

  return payload;
}
