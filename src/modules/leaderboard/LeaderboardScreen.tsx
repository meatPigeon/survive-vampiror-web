import { RankRewardsPopup, MilestonesPopup } from './RewardPopups';
import { TopList } from './TopList';
import { formatClearTime, parseLevelBoard } from '../../shared/level-leaderboards';
import { LevelBoardPicker } from './LevelBoardPicker';
import { useBoardResults } from './useBoardResults';
import { useState, type ReactNode } from 'react';
import type { FeatureRegistry, FeatureScreenProps } from '@idosgames/module-sdk';
import { useIDosGamesClient } from '@idosgames/react';
import { Badge, Button, Center, configSection, EmptyState, formatAmount, Icon, outlined, panel, SectionTitle, Spinner, Tabs, Timer, toneSurface, useCatalog, useGameLayout, useNow, v } from '@idosgames/react/ui';
import { boardAction, enabledBoards, type LeaderboardSection } from './model';
import { t } from "./i18n";

// Leaderboards (Unity Runtime/UI/Leaderboard): the boards as tabs, a card with my score, my rank and
// the countdown, and the top list — the player highlighted. Rank rewards and score milestones open
// as popups (a list of rewards does not belong on the main screen). A game that has something to
// PLAY for the score registers a "play" feature, and a Play button appears here.



export function makeLeaderboardScreen(features: FeatureRegistry) {
  return function LeaderboardScreen({ args }: FeatureScreenProps): ReactNode {
    return (
      <Leaderboards
        features={features}
        initial={
          typeof args?.leaderboardID === "string" ? args.leaderboardID : null
        }
      />
    );
  };
}

function Leaderboards({
  features,
  initial,
}: {
  features: FeatureRegistry;
  initial: string | null;
}): ReactNode {
  const client = useIDosGamesClient();
  const catalog = useCatalog();
  const layout = useGameLayout();
  const now = useNow();
  const boards = enabledBoards(
    configSection<LeaderboardSection>(client, "Leaderboard"),
  );
  const [boardID, setBoardID] = useState<string | null>(initial);
  const board = boards.find((b) => b.LeaderboardID === boardID) ?? boards[0];
  const id = board?.LeaderboardID;

  const { top, progress, loading, error, load } = useBoardResults(id);
  const [popup, setPopup] = useState<"ranks" | "milestones" | null>(null);
  const timed = !!id && !!parseLevelBoard(id);
  if (!board || !id) return <EmptyState glyph="trophy" text={t("noBoards")} />;

  const me = client.auth.context?.userID;
  const users = (top?.TopUsers ?? [])
    .slice()
    .sort((a, b) => (a.Rank ?? 1e9) - (b.Rank ?? 1e9));
  // The live place: the table when the player is in it — `LastKnownRank` of the progress is the place
  // at the last recount, 0 for a player who has not been recounted yet (the table said #1 while the
  // card said "—").
  const myRank =
    users.find((u) => u.UserID === me)?.Rank || progress?.LastKnownRank || null;
  const milestoneCount = Object.keys(board.Milestones ?? {}).length;
  // An invites board asks to invite (the referral screen), any other one to play.
  const action = boardAction(board);
  const cta =
    action === "invite"
      ? features.get("invite")
        ? "invite"
        : null
      : features.get("play")
        ? "play"
        : null;

  const hero = (
    <div
      className="idos-shine"
      style={{
        ...panel,
        padding: 16,
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr)",
        minWidth: 0,
        gap: timed ? 8 : 10,
        justifyItems: "center",
        ...toneSurface("blue"),
      }}
    >
      <Icon glyph="trophy" size={timed ? 26 : 56} />
      <div style={{ ...outlined, fontSize: 20, textAlign: "center" }}>
        {catalog.localize(board.DisplayName ?? id)}
      </div>
      <Timer at={top?.CycleEndUtc} now={now} label={`⏱ ${t("endsIn")}`} />
      {timed && <small style={{ textAlign: "center", color: v.textDim }}>Fastest clears · all time<br />Combat time only. Pauses and travel excluded.<br />Campaign perks carry over between locations.</small>}
      <div style={{ display: "flex", gap: 18 }}>
        <Stat
          label={
            board.ScoreDisplayName
              ? catalog.localize(board.ScoreDisplayName)
              : t("myScore")
          }
          value={timed ? formatClearTime(progress?.CurrentScore) : formatAmount(Number(progress?.CurrentScore ?? 0))}
        />
        <Stat label={t("myRank")} value={myRank ? `#${myRank}` : "—"} />
      </div>
      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          justifyContent: "center",
        }}
      >
        {!timed && cta === "play" ? (
          <Button
            attract
            onClick={() => features.open("play")}
            data-tutorial-anchor="leaderboard:play"
          >
            ▶ {t("play")}
          </Button>
        ) : cta === "invite" ? (
          <Button
            attract
            onClick={() => features.open("invite")}
            data-tutorial-anchor="leaderboard:invite"
          >
            <Icon glyph="friends" size={18} /> {t("invite")}
          </Button>
        ) : null}
        {(board.RankRewards?.length ?? 0) > 0 ? (
          <Button tone="blue" size="sm" onClick={() => setPopup("ranks")}>
            <Icon glyph="gift" size={18} /> {t("rankRewards")}
          </Button>
        ) : null}
        {milestoneCount > 0 ? (
          <span style={{ position: "relative" }}>
            <Button
              tone="blue"
              size="sm"
              onClick={() => setPopup("milestones")}
            >
              <Icon glyph="star" size={18} /> {t("milestones")}
            </Button>
            <Badge count={progress?.HasUnclaimedMilestone ? 1 : 0} dot />
          </span>
        ) : null}
      </div>
    </div>
  );

  const list = (
    <div>
      <SectionTitle>{t("top")}</SectionTitle>
      {error ? <div role="status"><p>{error}</p><Button onClick={() => void load()}>Retry</Button></div> : loading ? (
        <Center minHeight={120}>
          <Spinner />
        </Center>
      ) : users.length === 0 ? (
        <EmptyState glyph="trophy" text={t("empty")} />
      ) : (
        <TopList users={users} me={me} timed={timed} />
      )}
    </div>
  );

  return (
    <div data-hide-overlay-balances style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 16, minWidth: 0 }}>
      {timed ? <LevelBoardPicker boards={boards} id={id} onChange={setBoardID} /> : <Tabs
        tabs={boards.map((b) => ({
          id: b.LeaderboardID,
          label: catalog.localize(b.DisplayName ?? b.LeaderboardID),
        }))}
        value={id}
        onChange={setBoardID}
      />}
      <Button size="sm" busy={loading} onClick={() => void load()}>Refresh times</Button>
      {layout === "desktop" ? (
        <div
          style={{
            display: "grid",
            gap: 20,
            gridTemplateColumns: "minmax(0, 5fr) minmax(0, 6fr)",
            alignItems: "start",
          }}
        >
          {hero}
          {list}
        </div>
      ) : (
        <>
          {hero}
          {list}
        </>
      )}
      {popup === "ranks" ? (
        <RankRewardsPopup
          def={board}
          myRank={myRank}
          onClose={() => setPopup(null)}
        />
      ) : null}
      {popup === "milestones" ? (
        <MilestonesPopup
          def={board}
          progress={progress}
          onClaimed={load}
          onClose={() => setPopup(null)}
        />
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }): ReactNode {
  return (
    <div style={{ display: "grid", justifyItems: "center" }}>
      <span style={{ ...outlined, fontSize: 12, color: v.textDim }}>
        {label}
      </span>
      <span style={{ ...outlined, fontSize: 20, color: v.gold }}>{value}</span>
    </div>
  );
}
