import { createIDosGamesClient, MemoryStorage, NoopPlatformAdapter } from "@idosgames/core";
import { simulation, loadGame } from '../tests/load-source.mjs';
const { captureCheckpoint } = await loadGame('checkpoint');
const { freshProfile, readProfile } = await loadGame('player-profile');
const { PROFILE_KEY } = await loadGame('save-store');

const titleID = process.env.IDOS_TITLE_ID || "FYVPZFCO-DEV";
if (!/^[A-Z0-9]{8}-DEV$/.test(titleID)) {
  console.error(JSON.stringify({ ok: false, error: "Verification requires a DEV title." }));
  process.exit(1);
}

class VerificationPlatform extends NoopPlatformAdapter {
  getDeviceID() { return `codex-environment-smoke-${titleID}`; }
}

const client = createIDosGamesClient({
  titleID,
  platform: new VerificationPlatform(new MemoryStorage()),
});
client.auth.setRememberSession(false);
const checks = [];
let passed = false;
let customDataCalledAt = 0;
async function customDataCall(call) {
  const delay = Math.max(0, 650 - (Date.now() - customDataCalledAt));
  if (delay) await new Promise(resolve => setTimeout(resolve, delay));
  try { return await call(); } finally { customDataCalledAt = Date.now(); }
}
try {
  const login = await client.auth.loginWithDeviceID();
  if (!login.ok) throw new Error(`Guest login failed: ${login.reason} ${login.error || ""}`);
  checks.push({ name: "guest-login", ok: client.auth.isLoggedIn });
  if (!client.auth.isLoggedIn || !login.data.User) throw new Error("Login did not bootstrap player state.");
  checks.push({ name: "player-bootstrap", ok: true });

  const config = await client.title.getTitlePublicConfiguration();
  if (!config.ok) throw new Error(`Title config failed: ${config.reason} ${config.error || ""}`);
  if (!client.data.config.titlePublicConfiguration) throw new Error("Title configuration cache is empty.");
  checks.push({ name: "title-configuration", ok: true });
  const definitions = await customDataCall(() => client.userCustomData.getUserCustomDataDefinitions());
  if (!definitions.ok) throw new Error('Could not read player-data definitions.');
  const key = definitions.data.Keys?.[PROFILE_KEY];
  if (key?.Bucket !== 'Private' || key.ValueType !== 'Json' || key.MaxValueLengthBytes < 131072) throw new Error('The horde private save key is missing or too small.');
  checks.push({ name: 'horde-save-schema', ok: true });

  // This stable, dedicated DEV smoke player is separate from any browser player.
  const before = await customDataCall(() => client.userCustomData.getMyUserCustomData());
  if (!before.ok) throw new Error('Could not read the smoke player save.');
  const previous = before.data.Private?.[PROFILE_KEY]?.Value;
  const profile = freshProfile(), world = simulation.createEncounter(false, 314159);
  simulation.stepEncounter(world, 1 / 60, 1, 0);
  profile.settings.music = 37; profile.checkpoint = captureCheckpoint(world, 'verify-save-roundtrip');
  profile.retryCheckpoint = captureCheckpoint(simulation.createEncounter(false, 314159), 'verify-save-roundtrip');
  if (!profile.checkpoint) throw new Error('Game checkpoint could not serialize.');
  const payload = JSON.stringify(profile);
  const saved = await customDataCall(() => client.userCustomData.setPrivateData(PROFILE_KEY, payload));
  if (!saved.ok) throw new Error(`Private save failed: ${saved.error || saved.reason}`);
  try {
    const reread = await customDataCall(() => client.userCustomData.getMyUserCustomData());
    if (!reread.ok) throw new Error(`Could not reread the saved checkpoint: ${reread.reason} ${reread.error || ''}`);
    const restored = readProfile(reread.data.Private?.[PROFILE_KEY]?.Value);
    if (restored.notice || restored.profile.settings.music !== 37 || restored.profile.checkpoint?.runId !== 'verify-save-roundtrip' || restored.profile.checkpoint.world.zombies.length !== 40 || !restored.profile.checkpoint.world.paused || restored.profile.retryCheckpoint?.world.status !== 'ready') throw new Error('The saved checkpoint did not round trip.');
    checks.push({ name: 'horde-private-checkpoint-roundtrip', ok: true, bytes: Buffer.byteLength(payload) });
  } finally {
    // Preserve prior smoke data; no reset or deletion of title/player configuration.
    if (previous != null) {
      const restored = await customDataCall(() => client.userCustomData.setPrivateData(PROFILE_KEY, previous));
      if (!restored.ok) throw new Error('Could not restore the previous smoke-player save.');
    }
  }
  passed = true;
  console.log(JSON.stringify({ ok: true, titleID, checks }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, titleID, checks, error: error.message }, null, 2));
} finally {
  client.auth.logout();
}
process.exitCode = passed ? 0 : 1;
