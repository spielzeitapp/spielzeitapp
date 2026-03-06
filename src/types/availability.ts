/**
 * Availability status convention.
 * DB/API may use other values – map to these in your layer if needed.
 */
export const AVAILABILITY_STATUS = {
  YES: "yes",
  NO: "no",
  MAYBE: "maybe",
} as const;

export type AvailabilityStatus =
  (typeof AVAILABILITY_STATUS)[keyof typeof AVAILABILITY_STATUS];

/** Check if a string is a valid status (for mapping from DB). */
export function isAvailabilityStatus(
  s: string | null | undefined,
): s is AvailabilityStatus {
  return s === "yes" || s === "no" || s === "maybe";
}

/** Map unknown DB value to status; fallback to "maybe". */
export function toAvailabilityStatus(
  s: string | null | undefined,
): AvailabilityStatus {
  if (isAvailabilityStatus(s)) return s;
  return AVAILABILITY_STATUS.MAYBE;
}

/**
 * Availability row (Supabase/DB).
 * Expected columns: id, match_id, player_id, status, comment, updated_by, updated_at, created_at
 */
export type AvailabilityRow = {
  id: string;
  match_id: string;
  player_id: string;
  status: string;
  comment: string | null;
  updated_by: string | null;
  updated_at?: string | null;
  created_at?: string | null;
};
