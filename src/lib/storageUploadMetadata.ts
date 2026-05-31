/** Gültige Werte falls membership_role doch in Metadata landet — niemals "". */
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

/** Bereinigt Metadata für storage.objects.user_metadata — membership_role nie als "". */
export function buildSanitizedStorageColumns(input: {
  metadata?: StorageUploadMetadataInput | null;
}): { userMetadata: Record<string, string> } {
  return { userMetadata: cleanStorageMetadata(input.metadata) };
}
