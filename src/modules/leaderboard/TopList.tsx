import type { ReactNode } from 'react';
import type { LeaderboardUserEntry } from '@idosgames/core';
import { Icon, formatAmount, outlined, panel, toneSurface, useStagger, v } from '@idosgames/react/ui';
import { formatClearTime } from '../../shared/level-leaderboards';
import { t } from './i18n';
const MEDALS = ['#ffd24a', '#d9e1f2', '#e0955a'];
export function TopList({
  users,
  me,
  timed,
}: {
  timed: boolean;
  users: LeaderboardUserEntry[];
  me: string | undefined;
}): ReactNode {
  const stagger = useStagger();
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", minWidth: 0, gap: 8 }}>
      {users.slice(0, 100).map((entry, i) => {
        const place = entry.Rank ?? i + 1;
        const mine = entry.UserID === me;
        const medal = place <= 3 ? MEDALS[place - 1] : undefined;
        const name =
          entry.PublicProfile?.Username ||
          (mine ? t("you") : `${t("player")} ${entry.UserID.slice(-4)}`);
        return (
          <div
            key={entry.UserID}
            style={{
              ...panel,
              padding: "8px 12px",
              display: "flex",
              alignItems: "center",
              gap: 12,
              border: mine ? `2px solid ${v.gold}` : panel.border,
              ...(mine
                ? toneSurface("blue")
                : { background: panel.background }),
              ...stagger(i),
            }}
          >
            <span
              style={{
                width: 34,
                height: 34,
                borderRadius: "50%",
                display: "grid",
                placeItems: "center",
                background: medal ?? v.wellSoft,
                ...outlined,
                fontSize: 15,
                color: medal ? "#5a3a00" : v.text,
                textShadow: medal ? "none" : outlined.textShadow,
                flex: "none",
              }}
            >
              {place}
            </span>
            <span
              style={{
                ...outlined,
                fontSize: 15,
                flex: 1,
                minWidth: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {name}
              {mine && entry.PublicProfile?.Username ? ` (${t("you")})` : ""}
            </span>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                ...outlined,
                fontSize: 16,
                color: v.gold,
                fontVariantNumeric: "tabular-nums",
                flexShrink: 0,
              }}
            >
              {!timed && <Icon glyph="star" size={18} />}
              {timed ? formatClearTime(entry.Score) : formatAmount(Number(entry.Score ?? 0))}
            </span>
          </div>
        );
      })}
    </div>
  );
}
