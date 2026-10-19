import { defineModule, type Module } from "@idosgames/module-sdk";
import { configSection } from "@idosgames/react/ui";
import {
  makeLeaderboardScreen,
} from "./LeaderboardScreen";
import { makeCycleRewardWatcher } from "./RewardPopups";
import { hasTitleData, type LeaderboardSection } from "./model";
import { t } from "./i18n";

// Leaderboards as a feature of the game. The always-on watcher pops up the reward of a finished
// round and keeps the badge (a rank reward or a milestone waiting).
export const leaderboardModule: Module = defineModule({
  id: "leaderboard",
  meta: { name: "Leaderboards", type: "app", engine: "dom" },
  setup(ctx) {
    ctx.features.register({
      id: "leaderboard",
      label: t("title"),
      icon: "trophy",
      group: "events",
      order: 30,
      primary: true,
      available: false,
      Screen: makeLeaderboardScreen(ctx.features),
    });
    ctx.features.setAvailable(
      "leaderboard",
      hasTitleData(
        configSection<LeaderboardSection>(ctx.client, "Leaderboard"),
      ),
      "no enabled leaderboard on the title",
    );
    ctx.registerPanel({
      id: "cycle-reward",
      slot: "modal",
      activeOnly: false,
      component: makeCycleRewardWatcher(ctx.features),
    });
    ctx.exposeToAgent({
      state: () => ({ ui: "dom", feature: "leaderboard" }),
      describeActions: {},
    });
  },
});
