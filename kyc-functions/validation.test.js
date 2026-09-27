'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const { validThaiId, identity, validDecision } = require('./validation');
// Synthetic checksum fixture, not a person's submitted identity.
const first = '123456789012';
const fixtureId = first + ((11 - [...first].reduce((s, n, i) => s + Number(n) * (13 - i), 0) % 11) % 10);
test('rejects malformed, repeated and invalid checksum IDs', () => {
  assert.equal(validThaiId(fixtureId), true);
  for (const value of ['', '0000000000000', '1111111111111', fixtureId.slice(0, 12), fixtureId.slice(0, 12) + ((Number(fixtureId[12]) + 1) % 10)]) assert.equal(validThaiId(value), false);
});
test('identity requires verified auth, never an anonymous or unverified email', () => {
  assert.equal(identity(null), null);
  assert.equal(identity({ token: { firebase: { sign_in_provider: 'anonymous' }, email: 'test@example.invalid', email_verified: true } }), null);
  assert.equal(identity({ token: { email: 'test@example.invalid', email_verified: false } }), null);
});
test('rejection requires a useful reason', () => {
  assert.equal(validDecision({ requestId: 'request-1', decision: 'rejected', reason: '' }), false);
  assert.equal(validDecision({ requestId: '../secret', decision: 'approved' }), false);
});
function setup() {
  const rows = new Map(), files = new Map(); let sequence = 0;
  const ref = path => ({ path, id: path.split('/').at(-1), get: async () => snapshot(path), delete: async () => rows.delete(path) });
  const snapshot = path => ({ data: () => rows.get(path) });
  const tx = { get: async r => snapshot(r.path), set: (r, d) => rows.set(r.path, d), create: (r, d) => { if (rows.has(r.path)) throw Error('exists'); rows.set(r.path, d); }, update: (r, d) => rows.set(r.path, { ...rows.get(r.path), ...d }) };
  const db = { doc: ref, collection: name => ({ doc: () => ref(name + '/r' + (++sequence)), add: async data => rows.set(name + '/r' + (++sequence), data) }), runTransaction: async fn => fn(tx) };
  class HttpsError extends Error { constructor(code, message) { super(message); this.code = code; } }
  const file = path => ({ save: async b => files.set(path, b), delete: async () => files.delete(path), download: async () => [files.get(path)] });
  const image = () => ({ metadata: async () => ({ format: 'jpeg', width: 1200, height: 800 }), rotate() { return this; }, resize() { return this; }, jpeg() { return this; }, toBuffer: async () => Buffer.from('test-image') });
  const mocks = { 'firebase-functions/v2/https': { onCall: (_, fn) => fn, HttpsError }, 'firebase-functions/v2/scheduler': { onSchedule: (_, fn) => fn }, 'firebase-admin/app': { initializeApp: () => ({}) }, 'firebase-admin/firestore': { getFirestore: () => db, FieldValue: { serverTimestamp: () => ({ toMillis: () => Date.now() }) } }, 'firebase-admin/storage': { getStorage: () => ({ bucket: () => ({ file }) }) }, sharp: image, './validation': require('./validation') };
  const context = { exports: {}, require: name => mocks[name], process: { env: { KYC_ENABLED: 'true', KYC_BUCKET: 'private-test-bucket' } }, Buffer, Date };
  vm.runInNewContext(fs.readFileSync(require.resolve('./index'), 'utf8'), context);
  const user = { uid: 'owner-uid', token: { email: 'owner@example.invalid', email_verified: true, firebase: { sign_in_provider: 'google.com' } } };
  const admin = { uid: 'reviewer-uid', token: { ...user.token, kycAdmin: true } };
  const payload = { fullName: 'Synthetic Test', idNumber: fixtureId, consent: true, idCard: 'data:image/jpeg;base64,dGVzdA==', selfie: 'data:image/jpeg;base64,dGVzdA==' };
  return { api: context.exports, user, admin, payload, rows, files, context };
}
test('server refuses anonymous sessions and disabled intake', async () => {
  const s = setup();
  await assert.rejects(s.api.kycSubmit({ auth: null, data: s.payload }), e => e.code === 'unauthenticated');
  s.context.process.env.KYC_ENABLED = 'false';
  await assert.rejects(s.api.kycSubmit({ auth: s.user, data: s.payload }), e => e.code === 'failed-precondition');
  assert.equal(s.rows.size, 0);
});
test('submission stays pending, rejects duplicates, and status omits ID/photos', async () => {
  const s = setup();
  const result = await s.api.kycSubmit({ auth: s.user, data: s.payload });
  assert.equal(result.status, 'pending'); assert.equal(s.files.size, 2);
  await assert.rejects(s.api.kycSubmit({ auth: s.user, data: s.payload }), e => e.code === 'already-exists');
  const status = await s.api.kycStatus({ auth: s.user });
  assert.equal(status.status, 'pending'); assert.equal(status.idNumber, undefined); assert.equal(status.images, undefined);
});
test('failed image validation releases the submission lock without approving', async () => {
  const s = setup();
  await assert.rejects(s.api.kycSubmit({ auth: s.user, data: { ...s.payload, selfie: 'not-an-image' } }), e => e.code === 'invalid-argument');
  assert.equal(s.rows.get('statuses/owner-uid').status, 'unverified'); assert.equal(s.files.size, 0);
});
test('only a different privileged reviewer may approve, and replay is refused', async () => {
  const s = setup(); const { requestId } = await s.api.kycSubmit({ auth: s.user, data: s.payload });
  const data = { requestId, decision: 'approved', reviewed: true };
  await assert.rejects(s.api.kycResolve({ auth: s.user, data }), e => e.code === 'permission-denied');
  await assert.rejects(s.api.kycResolve({ auth: { ...s.admin, uid: s.user.uid }, data }), e => e.code === 'permission-denied');
  await assert.rejects(s.api.kycResolve({ auth: s.admin, data: { ...data, reviewed: false } }), e => e.code === 'invalid-argument');
  await s.api.kycResolve({ auth: s.admin, data });
  assert.equal(s.rows.get('statuses/owner-uid').status, 'approved');
  await assert.rejects(s.api.kycResolve({ auth: s.admin, data }), e => e.code === 'failed-precondition');
});
test('rejected applicant sees reason and can resubmit', async () => {
  const s = setup(); const { requestId } = await s.api.kycSubmit({ auth: s.user, data: s.payload });
  await s.api.kycResolve({ auth: s.admin, data: { requestId, decision: 'rejected', reviewed: true, reason: 'Image unreadable' } });
  assert.equal((await s.api.kycStatus({ auth: s.user })).reason, 'Image unreadable');
  assert.equal((await s.api.kycSubmit({ auth: s.user, data: s.payload })).status, 'pending');
});
