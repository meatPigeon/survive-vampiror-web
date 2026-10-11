import { generateKeyPairSync, sign } from 'node:crypto';
import { PublicKey } from '@solana/web3.js';
import { createIDosGamesClient, MemoryStorage, NoopPlatformAdapter } from '@idosgames/core';
import { loginWithWalletSolana } from '@idosgames/wallet';
import { loadGame, simulation } from '../tests/load-source.mjs';
const { freshProfile, readProfile } = await loadGame('player-profile');
const { captureCheckpoint } = await loadGame('checkpoint');
const titleID = 'FYVPZFCO-DEV';
// Disposable zero-fund test identity. Private material stays in this process only.
const { publicKey, privateKey } = generateKeyPairSync('ed25519');
const address = new PublicKey(publicKey.export({ type:'spki', format:'der' }).subarray(-32)).toBase58();
class TestPlatform extends NoopPlatformAdapter { getDeviceID() { return 'codex-solana-smoke'; } }
const makeClient = () => createIDosGamesClient({ titleID, platform:new TestPlatform(new MemoryStorage()) });
const delay = () => new Promise(resolve => setTimeout(resolve, 1100));
const check = (result, label) => { if (!result.ok) throw new Error(`${label} (${result.stage || result.reason}): ${result.error || result.reason}`); return result.data; };
async function login(client) {
  client.auth.setRememberSession(false);
  check(await loginWithWalletSolana({client,networkID:'solana',walletAddress:address,signMessage:async message => new Uint8Array(sign(null,message,privateKey))}), 'Solana signature login');
}
const first=makeClient(),second=makeClient();
try {
  await login(first);
  const userID=first.auth.context.userID;
  check(await first.blockchain.getUserState(),'Wallet state');
  const wallet=first.data.user.state?.Blockchain?.LastWalletLogin;
  if(wallet?.NetworkID !== 'solana' || wallet.Address !== address) throw new Error('Server wallet identity mismatch');
  const profile=freshProfile();profile.settings.music=43;
  const world=simulation.createEncounter(false, 271828);
  simulation.stepEncounter(world, 1/60, 1, 0);
  profile.checkpoint=captureCheckpoint(world, 'solana-recovery');
  if(!profile.checkpoint)throw new Error('Could not capture actual campaign checkpoint');
  check(await first.userCustomData.setPrivateData('horde_profile_v1',JSON.stringify(profile)),'Save');
  await delay();first.auth.logout();
  await login(second);
  if(second.auth.context.userID!==userID)throw new Error('Fresh client did not recover the same player');
  const saved=check(await second.userCustomData.getMyUserCustomData(),'Restore');
  const restored=readProfile(saved.Private?.horde_profile_v1?.Value);
  if(restored.notice || restored.profile.settings.music!==43 || restored.profile.checkpoint?.runId!=='solana-recovery' || restored.profile.checkpoint.world.zombies.length!==40 || !restored.profile.checkpoint.world.paused)throw new Error('Wallet campaign did not restore');
  await delay();
  // A different signer must not be able to impersonate the test wallet.
  const attacker=generateKeyPairSync('ed25519');
  const challenge=check(await second.auth.requestWalletChallenge(address,'solana'),'Challenge');
  await delay();
  const invalid=await second.auth.loginWithWallet(address,'solana','0x'+sign(null,Buffer.from(challenge.Message),attacker.privateKey).toString('hex'));
  if(invalid.ok)throw new Error('Invalid signature was accepted');
  if(!/signature/i.test(invalid.error || ''))throw new Error(`Unexpected rejection: ${invalid.error || invalid.reason}`);
  console.log(JSON.stringify({ok:true,titleID,checks:['Solana Ed25519 sign-in','server wallet identity','fresh-client same account','private campaign restored paused with 40 zombies','invalid signature rejected'],fundsSpent:0},null,2));
} finally {first.auth.logout();second.auth.logout();}
