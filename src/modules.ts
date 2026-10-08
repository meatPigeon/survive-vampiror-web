import type { Module } from "@idosgames/module-sdk";
import { inventoryModule } from "./modules/inventory";
import { questsModule } from "./modules/quests";
import { friendsModule } from "./modules/friends";
import { inviteModule } from "./modules/invite";
import { mailboxModule } from "./modules/mailbox";
import { profileModule } from "./modules/profile";
import { hordeModule } from "./modules/horde";

export const modules: Module[] = [
  inventoryModule,
  questsModule,
  friendsModule,
  inviteModule,
  mailboxModule,
  profileModule,
  hordeModule,
];
