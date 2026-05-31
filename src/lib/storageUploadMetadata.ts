/** Gültige Werte für storage.objects.metadata.membership_role (Postgres enum). */
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

/** Entfernt leere Werte und ungültige membership_role — niemals "" an Storage senden. */
export function cleanStorageMetadata(
  metadata?: StorageUploadMetadataInput | null,
): Record<string, string> {
  const cleaned = Object.fromEntries(
    Object.entries(metadata ?? {}).filter(([, value]) => value !== "" && value != null),
  ) as Record<string, string>;

  const rawRole = cleaned.membership_role?.trim().toLowerCase();
  if (!rawRole || !VALID_MEMBERSHIP_ROLES.includes(rawRole as ValidMembershipRole)) {
    delete cleaned.membership_role;
  } else {
    cleaned.membership_role = rawRole;
  }

  delete cleaned.user_metadata;

  return cleaned;
}

/** Auth user_metadata → flache, bereinigte Storage-Felder (ohne leere membership_role). */
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

export function buildStorageMetadata(
  metadata?: StorageUploadMetadataInput | null,
  membershipRole?: string | null,
  userMetadata?: StorageUploadMetadataInput | Record<string, unknown> | null,
): Record<string, string> {
  const merged: StorageUploadMetadataInput = {
    ...cleanUserMetadataForStorage(userMetadata),
    ...(metadata ?? {}),
  };

  const role = membershipRoleForStorageMetadata(
    membershipRole ?? merged.membership_role ?? cleanUserMetadataForStorage(userMetadata).membership_role,
  );

  if (role) {
    merged.membership_role = role;
  } else {
    delete merged.membership_role;
  }

  return cleanStorageMetadata(merged);
}
