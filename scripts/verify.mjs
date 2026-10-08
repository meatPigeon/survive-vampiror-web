import { createIDosGamesClient, MemoryStorage, NoopPlatformAdapter } from "@idosgames/core";

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
  passed = true;
  console.log(JSON.stringify({ ok: true, titleID, checks }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, titleID, checks, error: error.message }, null, 2));
} finally {
  client.auth.logout();
}
process.exitCode = passed ? 0 : 1;
