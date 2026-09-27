'use strict';
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');
const sharp = require('sharp');
const { validThaiId, identity, validDecision } = require('./validation');
const app = initializeApp();
// A dedicated database and bucket isolate identity documents from legacy app rules.
const database = getFirestore(app, 'flixo-kyc');
const opts = { region: 'asia-southeast1', memory: '512MiB', timeoutSeconds: 60, maxInstances: 5 };
function requireUser(request) {
  if (!identity(request.auth)) throw new HttpsError('unauthenticated', 'กรุณาเข้าสู่ระบบด้วยอีเมลที่ยืนยันแล้วหรือ OTP จริง');
  if (process.env.KYC_ENABLED !== 'true' || !process.env.KYC_BUCKET) throw new HttpsError('failed-precondition', 'ระบบยืนยันตัวตนยังไม่เปิดรับเอกสาร');
  return request.auth.uid;
}
function requireAdmin(request) {
  const uid = requireUser(request);
  if (request.auth.token.kycAdmin !== true) throw new HttpsError('permission-denied', 'ไม่มีสิทธิ์ตรวจเอกสาร');
  return uid;
}
function bucket() { return getStorage().bucket(process.env.KYC_BUCKET); }
function publicStatus(data) {
  return { status: data?.status || 'unverified', requestId: data?.requestId || null, reason: data?.reason || '', updatedAt: data?.updatedAt?.toMillis?.() || null };
}
async function imageBytes(value) {
  if (typeof value !== 'string' || value.length > 3 * 1024 * 1024 || !/^data:image\/(jpeg|png);base64,/.test(value)) throw new HttpsError('invalid-argument', 'รูปภาพไม่ถูกต้องหรือใหญ่เกินไป');
  try {
    const bytes = Buffer.from(value.split(',')[1], 'base64');
    const image = sharp(bytes, { limitInputPixels: 24000000 });
    const meta = await image.metadata();
    if (!['jpeg', 'png'].includes(meta.format) || Math.min(meta.width, meta.height) < 400) throw Error('invalid image');
    return await image.rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 90 }).toBuffer();
  } catch (_) { throw new HttpsError('invalid-argument', 'ใช้ภาพ JPG/PNG ที่อ่านได้ชัดและด้านสั้นอย่างน้อย 400 พิกเซล'); }
}
exports.kycStatus = onCall(opts, async request => {
  const uid = requireUser(request);
  return publicStatus((await database.doc(`statuses/${uid}`).get()).data());
});
exports.kycSubmit = onCall(opts, async request => {
  const uid = requireUser(request);
  const d = request.data || {};
  if (!validThaiId(d.idNumber) || typeof d.fullName !== 'string' || d.fullName.trim().length < 3 || d.fullName.length > 160 || d.consent !== true) throw new HttpsError('invalid-argument', 'ตรวจสอบชื่อ เลขบัตร และการรับทราบการใช้ข้อมูล');
  const statusRef = database.doc(`statuses/${uid}`);
  const requestRef = database.collection('requests').doc();
  // Claim one submission before processing photos. Expired upload leases can retry.
  await database.runTransaction(async tx => {
    const s = (await tx.get(statusRef)).data();
    if (['pending', 'approved'].includes(s?.status)) throw new HttpsError('already-exists', 'มีคำขอรอตรวจหรือยืนยันแล้ว');
    if (s?.status === 'uploading' && Date.now() - s.updatedAt.toMillis() < 120000) throw new HttpsError('already-exists', 'กำลังส่งเอกสาร กรุณารอสักครู่');
    tx.set(statusRef, { status: 'uploading', requestId: requestRef.id, reason: '', updatedAt: FieldValue.serverTimestamp() });
  });
  const paths = [`evidence/${uid}/${requestRef.id}/id.jpg`, `evidence/${uid}/${requestRef.id}/selfie.jpg`];
  try {
    const images = await Promise.all([imageBytes(d.idCard), imageBytes(d.selfie)]);
    for (let i = 0; i < paths.length; i++) await bucket().file(paths[i]).save(images[i], { resumable: false, metadata: { contentType: 'image/jpeg', cacheControl: 'private, no-store' } });
    await database.runTransaction(async tx => {
      const s = (await tx.get(statusRef)).data();
      if (s?.requestId !== requestRef.id || s.status !== 'uploading') throw new HttpsError('aborted', 'กรุณาส่งเอกสารใหม่');
      tx.create(requestRef, { uid, fullName: d.fullName.trim(), idNumber: d.idNumber, paths, status: 'pending', consentVersion: 'manual-kyc-v1', submittedAt: FieldValue.serverTimestamp() });
      tx.set(statusRef, { status: 'pending', requestId: requestRef.id, reason: '', updatedAt: FieldValue.serverTimestamp() });
    });
    return { status: 'pending', requestId: requestRef.id };
  } catch (error) {
    await Promise.allSettled(paths.map(path => bucket().file(path).delete({ ignoreNotFound: true })));
    await database.runTransaction(async tx => {
      const s = (await tx.get(statusRef)).data();
      if (s?.requestId === requestRef.id && s.status === 'uploading') tx.set(statusRef, { status: 'unverified', requestId: null, reason: '', updatedAt: FieldValue.serverTimestamp() });
    });
    if (error instanceof HttpsError) throw error;
    throw new HttpsError('internal', 'ส่งเอกสารไม่สำเร็จ กรุณาลองใหม่');
  }
});
exports.kycList = onCall(opts, async request => {
  requireAdmin(request);
  const cursor = request.data?.cursor;
  let query = database.collection('requests').where('status', '==', 'pending').orderBy('__name__').limit(25);
  if (cursor) query = query.startAfter(String(cursor));
  const snapshot = await query.get();
  return { items: snapshot.docs.map(doc => ({ id: doc.id, fullName: doc.data().fullName, submittedAt: doc.data().submittedAt.toMillis() })), cursor: snapshot.size === 25 ? snapshot.docs.at(-1).id : null };
});
exports.kycEvidence = onCall(opts, async request => {
  const reviewer = requireAdmin(request);
  const id = request.data?.requestId;
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id || '')) throw new HttpsError('invalid-argument', 'คำขอไม่ถูกต้อง');
  const ref = database.doc(`requests/${id}`);
  const d = (await ref.get()).data();
  if (!d || d.status !== 'pending') throw new HttpsError('not-found', 'ไม่มีคำขอรอตรวจ');
  const images = [];
  for (const path of d.paths) images.push('data:image/jpeg;base64,' + (await bucket().file(path).download())[0].toString('base64'));
  await database.collection('audit').add({ action: 'view', requestId: id, reviewer, at: FieldValue.serverTimestamp() });
  return { fullName: d.fullName, idNumber: d.idNumber, images };
});
exports.kycResolve = onCall(opts, async request => {
  const reviewer = requireAdmin(request);
  const d = request.data || {};
  if (!validDecision(d) || d.reviewed !== true) throw new HttpsError('invalid-argument', 'ตรวจสอบหลักฐานและระบุเหตุผลเมื่อปฏิเสธ');
  const ref = database.doc(`requests/${d.requestId}`);
  await database.runTransaction(async tx => {
    const record = (await tx.get(ref)).data();
    if (!record || record.status !== 'pending') throw new HttpsError('failed-precondition', 'คำขอนี้ได้รับการตัดสินแล้ว');
    if (record.uid === reviewer) throw new HttpsError('permission-denied', 'ไม่สามารถตรวจคำขอของตนเอง');
    const reason = d.decision === 'rejected' ? d.reason.trim() : '';
    tx.update(ref, { status: d.decision, reason, reviewer, reviewedAt: FieldValue.serverTimestamp() });
    tx.set(database.doc(`statuses/${record.uid}`), { status: d.decision, requestId: d.requestId, reason, updatedAt: FieldValue.serverTimestamp() });
    tx.create(database.collection('audit').doc(), { action: d.decision, requestId: d.requestId, reviewer, reason, at: FieldValue.serverTimestamp() });
  });
  return { status: d.decision };
});

// Documents are retained for at most 30 days plus the daily cleanup interval.
// Decision/audit metadata is kept separately; no evidence is written to logs.
exports.kycCleanup = onSchedule({ schedule: 'every 24 hours', region: opts.region, timeoutSeconds: 540 }, async () => {
  if (process.env.KYC_ENABLED !== 'true' || !process.env.KYC_BUCKET) return;
  const cutoff = new Date(Date.now() - 30 * 86400000);
  const old = await database.collection('requests').where('submittedAt', '<', cutoff).limit(100).get();
  for (const doc of old.docs) {
    const d = doc.data();
    // Atomically retire the request before removing files; cleanup may retry.
    await database.runTransaction(async tx => {
      const current = (await tx.get(doc.ref)).data();
      if (!current) return;
      if (current.status === 'pending') {
        tx.set(database.doc(`statuses/${d.uid}`), { status: 'rejected', requestId: doc.id, reason: 'คำขอหมดอายุ กรุณาส่งเอกสารใหม่', updatedAt: FieldValue.serverTimestamp() });
      }
      tx.update(doc.ref, { status: 'expired' });
    });
    for (const path of d.paths) await bucket().file(path).delete({ ignoreNotFound: true });
    await doc.ref.delete();
  }
});
