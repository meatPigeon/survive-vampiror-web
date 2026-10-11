import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const source = await readFile(new URL('../src/base/login/solana-standard.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const { supportsSolanaMessages, solanaAccount, signChallenge } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const account = { address: 'test', chains: ['solana:mainnet'], features: ['solana:signMessage'] };
const wallet = signMessage => ({ chains: ['solana:mainnet'], features: { 'standard:connect': { connect() {} }, 'solana:signMessage': { signMessage } } });
test('standalone sign-in excludes incompatible wallets and non-Solana accounts', () => {
  assert.equal(supportsSolanaMessages(wallet(() => {})), true);
  assert.equal(supportsSolanaMessages({ chains: ['eip155:1'], features: wallet(() => {}).features }), false);
  assert.equal(supportsSolanaMessages({ chains: ['solana:mainnet'], features: {} }), false);
  assert.equal(solanaAccount([{ ...account, features: [] }, { ...account, chains: ['eip155:1'] }, account]), account);
});
test('login signer passes the exact server challenge and rejects altered messages or malformed signatures', async () => {
  const message = new TextEncoder().encode('Login challenge'), signature = new Uint8Array(64);
  assert.equal(await signChallenge(wallet(async input => { assert.equal(input.account, account); assert.deepEqual(input.message, message); return [{ signedMessage: message, signature }]; }), account, message), signature);
  for (const output of [[], [{ signedMessage: new Uint8Array(message.length), signature }], [{ signedMessage: message, signature: new Uint8Array(63) }]]) {
    await assert.rejects(signChallenge(wallet(async () => output), account, message), /did not sign/);
  }
});
test('declining the wallet signature rejects authentication without fabricating a signature', async () => {
  await assert.rejects(signChallenge(wallet(async () => { throw new Error('User rejected'); }), account, new Uint8Array()), /User rejected/);
});
