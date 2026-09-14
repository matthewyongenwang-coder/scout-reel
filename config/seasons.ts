/**
 * Match timing per program and season. Kept as config because the game manual
 * changes during the season. V5RC Override 2026-27: 15s autonomous, an untimed
 * pause while the field is reset, then 1:45 driver control.
 */

export type MatchTiming = {
  /** Autonomous period length in seconds. */
  autonS: number;
  /** Driver control period length in seconds. */
  driverS: number;
  /** Typical pause between auton and driver when no anchor is known. */
  defaultGapS: number;
  /** Extra seconds shown before and after a clip so nothing is cut off. */
  leadS: number;
};

export const PROGRAM_V5RC = 1;

const V5RC_DEFAULT: MatchTiming = { autonS: 15, driverS: 105, defaultGapS: 10, leadS: 3 };

/** Season-specific overrides, keyed by API season id. Empty until a season differs. */
const SEASON_OVERRIDES: Record<number, MatchTiming> = {};

export function getMatchTiming(programId: number, seasonId?: number): MatchTiming {
  if (seasonId !== undefined && SEASON_OVERRIDES[seasonId]) return SEASON_OVERRIDES[seasonId];
  if (programId === PROGRAM_V5RC) return V5RC_DEFAULT;
  // Other programs are not supported in v1; V5RC timing is the closest fallback.
  return V5RC_DEFAULT;
}
