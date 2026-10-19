import { useEffect, useState, type ReactNode } from 'react';
import type { GetMyProgressResponse } from '@idosgames/core';
import type { FeatureRegistry } from '@idosgames/module-sdk';
import { useIDosGamesClient, useUserState } from '@idosgames/react';
import { Button, Card, configSection, errorText, grantedBy, grantLines, Icon, outlined, Popup, ProgressBar, ResourceList, useCatalog, useCelebrate, usePopupClose, useToast, useStagger, v } from '@idosgames/react/ui';
import { cachedProgress, enabledBoards, milestoneRows, rewardForRank, type LeaderboardDefinitionView, type LeaderboardSection } from './model';
import { t } from './i18n';

export function RankRewardsPopup({
  def,
  myRank,
  onClose,
}: {
  def: LeaderboardDefinitionView;
  myRank: number | null;
  onClose: () => void;
}): ReactNode {
  const stagger = useStagger();
  return (
    <Popup title={t("rankRewards")} onClose={onClose}>
      <div style={{ display: "grid", gap: 8 }}>
        {(def.RankRewards ?? []).map((r, i) => {
          const lines = grantLines(r?.Rewards);
          const mineHere =
            myRank !== null &&
            rewardForRank({ RankRewards: [r] }, myRank).length > 0;
          return (
            <Card
              key={r?.Rank ?? i}
              highlight={mineHere}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "10px 12px",
                ...stagger(i),
              }}
            >
              <span style={{ ...outlined, fontSize: 16 }}>#{r?.Rank}</span>
              <ResourceList lines={lines} />
            </Card>
          );
        })}
      </div>
    </Popup>
  );
}

export function MilestonesPopup({
  def,
  progress,
  onClaimed,
  onClose,
}: {
  def: LeaderboardDefinitionView & { LeaderboardID: string };
  progress: GetMyProgressResponse | null;
  onClaimed: () => Promise<void>;
  onClose: () => void;
}): ReactNode {
  const client = useIDosGamesClient();
  const state = useUserState();
  const catalog = useCatalog();
  const celebrate = useCelebrate();
  const toast = useToast();
  const stagger = useStagger();
  const [busy, setBusy] = useState<string | null>(null);
  const earned = Number(
    progress?.MilestoneTokensEarned ?? progress?.ScoreEarnedThisCycle ?? 0,
  );
  const rows = milestoneRows(
    def,
    earned,
    cachedProgress(state?.Leaderboard, def.LeaderboardID).claimed,
  );

  const claim = async (milestoneID: string) => {
    setBusy(milestoneID);
    const res = await client.leaderboard.claimMilestone(
      def.LeaderboardID,
      milestoneID,
    );
    setBusy(null);
    if (!res.ok) return toast(errorText(res.error), "error");
    celebrate(grantedBy(res.data));
    await onClaimed();
  };

  return (
    <Popup title={t("milestones")} onClose={onClose} width={440}>
      <div style={{ display: "grid", gap: 10 }}>
        {rows.map((row, i) => (
          <Card
            key={row.id}
            highlight={row.state === "ready"}
            style={{
              display: "grid",
              gap: 8,
              opacity: row.state === "claimed" ? 0.6 : 1,
              ...stagger(i),
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span style={{ ...outlined, fontSize: 15 }}>
                {catalog.localize(row.name)}
              </span>
              <ResourceList lines={row.reward} />
            </div>
            <ProgressBar
              value={Math.min(earned, row.required)}
              max={row.required}
              tone={row.state === "ready" ? "gold" : "green"}
            />
            {row.state === "ready" ? (
              <Button
                tone="gold"
                size="sm"
                attract
                busy={busy === row.id}
                onClick={() => void claim(row.id)}
              >
                {t("claim")}
              </Button>
            ) : row.state === "claimed" ? (
              <div style={{ justifySelf: "center" }}>
                <Icon glyph="check" size={26} />
              </div>
            ) : null}
          </Card>
        ))}
      </div>
    </Popup>
  );
}

/**
 * The reward of a finished round pops up by itself (Unity LeaderboardCycleRewardPopup): the place
 * the player took, what it earns, and "Claim". An always-on panel; it also keeps the badge.
 */
export function makeCycleRewardWatcher(features: FeatureRegistry) {
  return function CycleRewardWatcher(): ReactNode {
    const client = useIDosGamesClient();
    const [pending, setPending] = useState<{
      def: LeaderboardDefinitionView & { LeaderboardID: string };
      rank: number | null;
    } | null>(null);

    useEffect(() => {
      let cancelled = false;
      const check = async () => {
        const boards = enabledBoards(
          configSection<LeaderboardSection>(client, "Leaderboard"),
        ).filter(b => (b.RankRewards?.length ?? 0) > 0 || Object.keys(b.Milestones ?? {}).length > 0);
        if (boards.length === 0) return;
        const res = await client.leaderboard.getProgressBatch(
          boards.map((b) => b.LeaderboardID),
        );
        if (cancelled || !res.ok) return;
        const progress = res.data.map((r) =>
          r.Success ? (r.Data ?? null) : null,
        );
        features.setBadge(
          "leaderboard",
          progress.filter(
            (p) => p?.HasUnclaimedReward || p?.HasUnclaimedMilestone,
          ).length,
        );
        const withReward = progress.find((p) => p?.HasUnclaimedReward);
        const def = withReward
          ? boards.find((b) => b.LeaderboardID === withReward.LeaderboardID)
          : undefined;
        if (withReward && def)
          setPending({ def, rank: withReward.LastKnownRank ?? null });
      };
      void check();
      const offA = client.on(
        "leaderboard:cycleRewardClaimed",
        () => void check(),
      );
      const offB = client.on(
        "leaderboard:milestoneClaimed",
        () => void check(),
      );
      return () => {
        cancelled = true;
        offA();
        offB();
      };
    }, [client]);

    if (!pending) return null;
    return (
      <CycleRewardPopup
        def={pending.def}
        rank={pending.rank}
        onClose={() => setPending(null)}
      />
    );
  };
}

function CycleRewardPopup({
  def,
  rank,
  onClose,
}: {
  def: LeaderboardDefinitionView & { LeaderboardID: string };
  rank: number | null;
  onClose: () => void;
}): ReactNode {
  const catalog = useCatalog();
  const lines = rewardForRank(def, rank);
  return (
    <Popup title={t("lastCycle")} onClose={onClose} variant="center" queued>
      <div style={{ display: "grid", justifyItems: "center", gap: 10 }}>
        <div className="idos-bounce">
          <Icon glyph="trophy" size={84} />
        </div>
        <div style={{ ...outlined, fontSize: 16 }}>
          {catalog.localize(def.DisplayName ?? def.LeaderboardID)}
        </div>
        <div style={{ ...outlined, fontSize: 14, color: v.textDim }}>
          {t("yourPlace")}
        </div>
        <div style={{ ...outlined, fontSize: 34, color: v.gold }}>
          {rank ? `#${rank}` : t("notRanked")}
        </div>
        {lines.length > 0 ? (
          <>
            <div style={{ ...outlined, fontSize: 14, color: v.textDim }}>
              {t("reward")}
            </div>
            <ResourceList lines={lines} size={26} gap={14} />
          </>
        ) : null}
      </div>
      <ClaimCycle leaderboardID={def.LeaderboardID} />
    </Popup>
  );
}

function ClaimCycle({ leaderboardID }: { leaderboardID: string }): ReactNode {
  const client = useIDosGamesClient();
  const close = usePopupClose();
  const celebrate = useCelebrate();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      tone="gold"
      size="lg"
      attract
      busy={busy}
      onClick={() => {
        setBusy(true);
        void client.leaderboard.claimCycleReward(leaderboardID).then((res) => {
          setBusy(false);
          if (!res.ok) return toast(errorText(res.error), "error");
          close();
          celebrate(grantedBy(res.data));
        });
      }}
    >
      {t("claim")}
    </Button>
  );
}
