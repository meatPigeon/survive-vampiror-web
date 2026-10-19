// Pure helpers of the leaderboards screen — covered by model.test.ts.

import type {
  GetMyProgressResponse,
  ResourceGrant,
  UserLeaderboardsState,
} from "@idosgames/core";
import { grantLines, type ResourceLine } from "@idosgames/react/ui";

export interface MilestoneView {
  MilestoneID?: string | null;
  DisplayName?: string | null;
  RequiredProgress?: number | null;
  Rewards?: ResourceGrant | null;
  SortOrder?: number | null;
}

export interface LeaderboardDefinitionView {
  LeaderboardID?: string;
  DisplayName?: string | null;
  ScoreDisplayName?: string | null;
  IsEnabled?: boolean | null;
  RankRewards?: Array<{
    Rank?: string | null;
    Rewards?: ResourceGrant | null;
  } | null> | null;
  Milestones?: Record<string, MilestoneView | null> | null;
  ScoreSources?: Array<{ SourceType?: string | null } | null> | null;
}

/**
 * What the board's call-to-action does. A board fed only by invites (`ReferralInvite` — the server
 * scores a new friend) asks the player to invite, not to play: playing would not move it.
 */
export function boardAction(
  def: LeaderboardDefinitionView | undefined,
): "invite" | "play" {
  const sources = (def?.ScoreSources ?? []).filter((s) => s);
  return sources.length > 0 &&
    sources.every((s) => s?.SourceType === "ReferralInvite")
    ? "invite"
    : "play";
}

export interface LeaderboardSection {
  Definitions?: Record<string, LeaderboardDefinitionView | null> | null;
}

/** Enabled boards, the preferred one first, then by id. */
export function enabledBoards(
  section: LeaderboardSection | undefined,
  preferred = "horde_adventure_1_v1",
): Array<LeaderboardDefinitionView & { LeaderboardID: string }> {
  return Object.entries(section?.Definitions ?? {})
    .map(([id, def]) =>
      def ? { ...def, LeaderboardID: def.LeaderboardID ?? id } : null,
    )
    .filter(
      (d): d is LeaderboardDefinitionView & { LeaderboardID: string } =>
        d !== null && d.IsEnabled !== false,
    )
    .sort((a, b) =>
      a.LeaderboardID === preferred
        ? -1
        : b.LeaderboardID === preferred
          ? 1
          : a.LeaderboardID.localeCompare(b.LeaderboardID),
    );
}

/** "1" → [1,1]; "2-5" → [2,5]; "51+" → [51, ∞]; junk → null. */
export function parseRankRange(
  range: string | null | undefined,
): [number, number] | null {
  const s = (range ?? "").trim();
  let m = /^(\d+)$/.exec(s);
  if (m) return [Number(m[1]), Number(m[1])];
  m = /^(\d+)\s*-\s*(\d+)$/.exec(s);
  if (m) return [Number(m[1]), Number(m[2])];
  m = /^(\d+)\s*\+$/.exec(s);
  if (m) return [Number(m[1]), Number.POSITIVE_INFINITY];
  return null;
}

/** What a rank earns under the board's rank rewards. */
export function rewardForRank(
  def: LeaderboardDefinitionView | undefined,
  rank: number | null | undefined,
): ResourceLine[] {
  if (!rank || rank < 1) return [];
  for (const r of def?.RankRewards ?? []) {
    const range = parseRankRange(r?.Rank);
    if (range && rank >= range[0] && rank <= range[1])
      return grantLines(r?.Rewards);
  }
  return [];
}

export interface MilestoneRow {
  id: string;
  name: string;
  required: number;
  reward: ResourceLine[];
  state: "claimed" | "ready" | "locked";
}

/** Score milestones of the current cycle, in order, with what is claimable. */
export function milestoneRows(
  def: LeaderboardDefinitionView | undefined,
  progress: number,
  claimed: readonly string[],
): MilestoneRow[] {
  return Object.entries(def?.Milestones ?? {})
    .map(([id, m]) => ({ id: m?.MilestoneID ?? id, m }))
    .filter(
      (x): x is { id: string; m: MilestoneView } =>
        x.m !== null && x.m !== undefined,
    )
    .sort(
      (a, b) =>
        Number(a.m.RequiredProgress ?? 0) - Number(b.m.RequiredProgress ?? 0) ||
        Number(a.m.SortOrder ?? 0) - Number(b.m.SortOrder ?? 0),
    )
    .map(({ id, m }) => {
      const required = Number(m.RequiredProgress ?? 0);
      return {
        id,
        name: m.DisplayName || id,
        required,
        reward: grantLines(m.Rewards),
        state: claimed.includes(id)
          ? "claimed"
          : progress >= required
            ? "ready"
            : "locked",
      };
    });
}

/** The cached progress of one board (the cache keys it by an internal cycle-doc id). */
export function cachedProgress(
  state: UserLeaderboardsState | null | undefined,
  leaderboardID: string,
): { claimed: string[] } {
  for (const [key, p] of Object.entries(state?.ProgressByCycle ?? {})) {
    if (
      key === leaderboardID ||
      key.endsWith(`_${leaderboardID}`) ||
      key.includes(`_${leaderboardID}:`)
    )
      return { claimed: p.ClaimedMilestoneIDs ?? [] };
  }
  return { claimed: [] };
}

/** Badge: boards with a rank reward or a milestone waiting. */
export function claimableBoards(
  progress: ReadonlyArray<GetMyProgressResponse | null | undefined>,
): number {
  return progress.filter(
    (p) =>
      p?.HasUnclaimedReward ||
      p?.HasUnclaimedMilestone ||
      (p?.ClaimableGraceCycles?.length ?? 0) > 0,
  ).length;
}

/** Whether the title has an enabled leaderboard — until it does, the lobby hides the tab. */
export function hasTitleData(section: LeaderboardSection | undefined): boolean {
  return Object.values(section?.Definitions ?? {}).some(
    (d) =>
      d != null && (d as { IsEnabled?: boolean | null }).IsEnabled !== false,
  );
}
