/* Manual identity review. Decisions come only from authenticated callables. */
const kycState = { status: 'unverified', reason: '', step: 0, images: {}, versions: {}, busy: false, timer: null, generation: 0, isAdmin: false, requestId: null, cursor: null };
document.getElementById('kyc-dialogs').innerHTML = `
<div class="modal-overlay" id="modal-kyc" role="dialog" aria-modal="true" aria-labelledby="kyc-step-heading">
 <div class="modal-card modal-lg kyc-modal">
  <div class="modal-header"><div><span class="kyc-eyebrow">FLIXO · IDENTITY</span><h2 id="kyc-step-heading" tabindex="-1">ยืนยันตัวตนของคุณ</h2></div><button id="kyc-close" class="close-btn" onclick="closeKycModal()" aria-label="ปิด">&times;</button></div>
  <div class="modal-body">
   <ol class="kyc-progress"><li>1 ข้อมูล</li><li>2 รูปภาพ</li><li>3 ตรวจทาน</li></ol>
   <p class="kyc-notice">ตรวจเอกสารโดยผู้ดูแลระบบ ไม่ใช่การตรวจใบหน้าหรือความมีชีวิตอัตโนมัติ</p>
   <p id="kyc-status-message" class="kyc-status" role="status" hidden></p>
   <form id="kyc-form" onsubmit="event.preventDefault()">
    <section data-kyc-step="0"><h3>เตรียมบัตรประชาชนตัวจริง</h3><p class="modal-desc">ใช้ข้อมูลของคุณเอง ชื่อและเลขบัตรต้องตรงกับเอกสาร</p>
     <div class="form-group"><label for="kyc-full-name">ชื่อ–นามสกุลตามบัตร</label><input id="kyc-full-name" type="text" autocomplete="name" minlength="3" maxlength="160" required placeholder="ชื่อและนามสกุล"></div>
     <div class="form-group"><label for="kyc-id-number">เลขประจำตัวประชาชน 13 หลัก</label><input id="kyc-id-number" type="text" inputmode="numeric" autocomplete="off" pattern="[0-9]{13}" maxlength="13" required placeholder="กรอกตัวเลข 13 หลัก"></div>
     <p class="form-help">การตรวจรูปแบบเลขบัตรไม่ได้ยืนยันว่าบัตรเป็นของจริง ผู้ดูแลจะตรวจหลักฐานอีกครั้ง</p>
    </section>
    <section data-kyc-step="1" hidden><h3>แนบภาพที่อ่านได้ชัดเจน</h3><p class="modal-desc">JPG หรือ PNG ไม่เกิน 5 MB ต่อภาพ ไม่ใช้ภาพหน้าจอหรือภาพที่แก้ไขข้อมูล</p>
     <div class="kyc-upload-grid">
      <div class="kyc-upload-box"><div class="upload-icon"><i class="fa-solid fa-id-card"></i></div><label for="kyc-id-card-file-input">ด้านหน้าบัตรประชาชน</label><p>เห็นครบ 4 มุม ไม่มีแสงสะท้อน ไม่ต้องส่งด้านหลังหรือเลข Laser</p><input id="kyc-id-card-file-input" type="file" accept="image/jpeg,image/png" capture="environment" onchange="handleKycFileSelect(event,'id-card')"><span id="kyc-id-card-filename">ยังไม่ได้เลือกภาพ</span><img id="kyc-id-card-preview" alt="ตัวอย่างภาพบัตร" hidden></div>
      <div class="kyc-upload-box"><div class="upload-icon"><i class="fa-solid fa-camera"></i></div><label for="kyc-selfie-file-input">ใบหน้าพร้อมถือบัตร</label><p>เห็นใบหน้าและบัตรชัด ไม่ใส่หน้ากากหรือแว่นกันแดด ถ่ายในที่สว่าง</p><input id="kyc-selfie-file-input" type="file" accept="image/jpeg,image/png" capture="user" onchange="handleKycFileSelect(event,'selfie')"><span id="kyc-selfie-filename">ยังไม่ได้เลือกภาพ</span><img id="kyc-selfie-preview" alt="ตัวอย่างภาพใบหน้าพร้อมบัตร" hidden></div>
     </div>
    </section>
    <section data-kyc-step="2" hidden><h3>ตรวจสอบก่อนส่ง</h3><dl class="kyc-summary"><dt>ชื่อ–นามสกุล</dt><dd id="kyc-review-name"></dd><dt>เลขประจำตัวประชาชน</dt><dd id="kyc-review-id"></dd></dl>
     <div class="kyc-review-images"><img id="kyc-review-idCard" alt="ภาพบัตรที่จะส่ง"><img id="kyc-review-selfie" alt="ภาพใบหน้าที่จะส่ง"></div>
     <div class="kyc-notice"><strong>เอกสารใช้เพื่ออะไร?</strong><p>ใช้ประกอบการตรวจยืนยันตัวตนโดยผู้ดูแลที่ได้รับสิทธิ์ ภาพและเลขบัตรไม่แสดงให้คู่ซื้อขายเห็น หากไม่ผ่าน คุณจะเห็นเหตุผลและส่งใหม่ได้ รูปและข้อมูลในคำขอจะถูกลบตามรอบรายวันเมื่อครบ 30 วันนับจากส่ง ส่วนผลตรวจและประวัติการดำเนินการเก็บแยกจากรูป</p><button type="button" class="btn-link" onclick="openConsentWizard(2)">อ่านนโยบายความเป็นส่วนตัว</button></div>
     <label class="kyc-consent"><input id="kyc-consent" type="checkbox"><span>ฉันยืนยันว่าข้อมูลและเอกสารเป็นของฉัน และรับทราบการใช้ข้อมูลเพื่อให้ผู้ดูแลตรวจสอบตัวตน</span></label>
    </section>
   </form><p id="kyc-error" role="alert" class="kyc-error"></p>
  </div>
  <div class="modal-footer"><button class="btn-secondary" onclick="refreshKycStatus()">ตรวจสถานะ</button><button id="kyc-back" class="btn-secondary" onclick="kycNext(-1)">ย้อนกลับ</button><button id="kyc-next" class="btn-primary" onclick="kycNext(1)">ถัดไป</button><button id="kyc-submit" class="btn-primary" onclick="submitKyc()" hidden>ส่งให้ผู้ดูแลตรวจสอบ</button></div>
 </div>
</div>
<div class="modal-overlay" id="modal-kyc-review" role="dialog" aria-modal="true" aria-labelledby="kyc-review-heading">
 <div class="modal-card modal-lg kyc-modal"><div class="modal-header"><h2 id="kyc-review-heading">ตรวจเอกสารยืนยันตัวตน</h2><button class="close-btn" onclick="closeModal('modal-kyc-review')" aria-label="ปิด">&times;</button></div>
  <div class="modal-body"><p id="kyc-evidence-name"></p><p id="kyc-evidence-id"></p><div class="kyc-review-images"><img id="kyc-evidence-0" alt="บัตรประชาชน"><img id="kyc-evidence-1" alt="ใบหน้าพร้อมบัตร"></div><p>ตรวจชื่อ เลขบัตร วันหมดอายุ ความชัดเจน และภาพใบหน้าว่าสอดคล้องกัน หากข้อมูลไม่พอให้ขอส่งใหม่</p><label class="kyc-consent"><input type="checkbox" id="kyc-reviewed"><span>ตรวจภาพและข้อมูลครบแล้ว พร้อมบันทึกผลโดยใช้สิทธิ์ของฉัน</span></label><label for="kyc-reject-reason">เหตุผลที่ให้ผู้ใช้แก้ไข (จำเป็นเมื่อปฏิเสธ)</label><textarea id="kyc-reject-reason" rows="3" maxlength="500" placeholder="เช่น ภาพบัตรสะท้อนแสง อ่านเลขบัตรไม่ได้"></textarea><p id="kyc-review-error" class="kyc-error" role="alert"></p></div>
  <div class="modal-footer"><button class="btn-danger" onclick="adminResolveKyc(false)">ขอให้ส่งใหม่</button><button class="btn-success" onclick="adminResolveKyc(true)">อนุมัติ</button></div>
 </div>
</div>`;
async function kycCall(name, data = {}) {
    if (!auth?.currentUser || auth.currentUser.isAnonymous) throw new Error('กรุณาเข้าสู่ระบบด้วย Google หรือบัญชีที่ยืนยันแล้วก่อนส่งเอกสาร');
    return (await firebase.app().functions('asia-southeast1').httpsCallable(name)(data)).data;
}
function kycError(error) {
    if (['functions/not-found', 'functions/unavailable', 'functions/internal'].includes(error.code)) return 'ระบบยืนยันตัวตนยังไม่พร้อมให้บริการ กรุณาลองใหม่ภายหลัง';
    return error.message || 'ดำเนินการไม่สำเร็จ กรุณาลองใหม่';
}
function stopKycSession() {
    clearInterval(kycState.timer);
    kycState.generation++;
    kycState.status = 'unverified';
    kycState.reason = '';
    kycState.images = {};
    kycState.versions = {};
    kycState.isAdmin = false;
    kycState.serviceError = '';
    document.querySelectorAll('#modal-kyc img').forEach(img => img.removeAttribute('src'));
    document.getElementById('kyc-form').reset();
    document.getElementById('modal-kyc').style.display = 'none';
    document.getElementById('modal-kyc-review').style.display = 'none';
    clearKycEvidence();
}
function startKycSession() {
    stopKycSession();
    state.loggedInUser.kycStatus = 'unverified'; // Legacy demo approvals are not evidence of verification.
    refreshKycStatus();
    kycState.timer = setInterval(() => {
        if (document.visibilityState === 'visible') {
            refreshKycStatus();
            if (kycState.isAdmin && state.activeTab === 'admin') refreshKycQueue();
        }
    }, 30000);
}
async function refreshKycStatus() {
    const generation = kycState.generation;
    try {
        const result = await kycCall('kycStatus');
        if (generation !== kycState.generation || !state.loggedInUser) return;
        kycState.status = result.status;
        kycState.reason = result.reason || '';
        kycState.serviceError = '';
        const token = await auth.currentUser.getIdTokenResult();
        if (generation !== kycState.generation) return;
        kycState.isAdmin = token.claims.kycAdmin === true;
        if (kycState.isAdmin) {
            document.getElementById('tab-admin').style.display = '';
            refreshKycQueue();
        }
    } catch (error) {
        if (generation !== kycState.generation) return;
        kycState.status = 'unverified';
        kycState.serviceError = kycError(error);
    }
    if (state.loggedInUser) renderProfileKyc();
    if (document.getElementById('modal-kyc').style.display === 'flex') renderKycStep();
}
function applyRealKycStatus() {
    if (!state.loggedInUser) return;
    state.loggedInUser.kycStatus = ({ approved: 'verified', rejected: 'failed', uploading: 'pending', pending: 'pending' })[kycState.status] || 'unverified';
}
function openKycModal() {
    if (kycState.busy) return;
    document.getElementById('kyc-form').reset();
    kycState.images = {};
    kycState.versions = {};
    kycState.generation++;
    kycState.step = 0;
    for (const key of ['id-card', 'selfie']) {
        const preview = document.getElementById(`kyc-${key}-preview`);
        preview.removeAttribute('src'); preview.hidden = true;
        document.getElementById(`kyc-${key}-filename`).textContent = 'ยังไม่ได้เลือกภาพ';
    }
    document.getElementById('kyc-error').textContent = '';
    openModal('modal-kyc');
    renderKycStep();
    refreshKycStatus();
}
function closeKycModal() {
    if (kycState.busy) return;
    kycState.generation++;
    kycState.images = {};
    kycState.versions = {};
    for (const img of document.querySelectorAll('#modal-kyc img')) img.removeAttribute('src');
    document.getElementById('kyc-form').reset();
    closeModal('modal-kyc');
}
function renderKycStep() {
    const statusOnly = ['approved', 'pending', 'uploading'].includes(kycState.status);
    document.querySelectorAll('[data-kyc-step]').forEach(el => { el.hidden = statusOnly || Number(el.dataset.kycStep) !== kycState.step; });
    document.querySelectorAll('.kyc-progress li').forEach((el, i) => {
        el.classList.toggle('current', i === kycState.step);
        el.setAttribute('aria-current', i === kycState.step ? 'step' : 'false');
    });
    const box = document.getElementById('kyc-status-message');
    box.hidden = !statusOnly && kycState.status !== 'rejected' && !kycState.serviceError;
    box.textContent = kycState.serviceError || ({ approved: 'ยืนยันตัวตนแล้ว • ตรวจสอบโดยผู้ดูแลระบบ', pending: 'ได้รับเอกสารแล้ว • กำลังรอผู้ดูแลตรวจสอบ คุณกลับมาเช็กสถานะได้ภายหลัง', uploading: 'กำลังรับเอกสาร กรุณาตรวจสอบสถานะอีกครั้ง', rejected: `กรุณาแก้ไขและส่งใหม่: ${kycState.reason}` })[kycState.status] || '';
    document.getElementById('kyc-back').hidden = statusOnly || kycState.step === 0;
    document.getElementById('kyc-next').hidden = statusOnly || kycState.step === 2;
    document.getElementById('kyc-submit').hidden = statusOnly || kycState.step !== 2;
    document.getElementById('kyc-submit').disabled = kycState.busy || Boolean(kycState.serviceError);
    document.getElementById('kyc-submit').textContent = kycState.busy ? 'กำลังส่งเอกสาร…' : 'ส่งให้ผู้ดูแลตรวจสอบ';
    document.getElementById('kyc-close').disabled = kycState.busy;
    document.getElementById('kyc-back').disabled = kycState.busy;
}
function kycNext(direction) {
    document.getElementById('kyc-error').textContent = '';
    if (direction > 0) {
        if (kycState.step === 0 && !document.getElementById('kyc-form').reportValidity()) return;
        if (kycState.step === 0 && !kycValidId(document.getElementById('kyc-id-number').value)) {
            document.getElementById('kyc-error').textContent = 'เลขบัตรไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง'; return;
        }
        if (kycState.step === 1 && (!kycState.images.idCard || !kycState.images.selfie)) {
            document.getElementById('kyc-error').textContent = 'กรุณาแนบภาพให้ครบและรอประมวลผลภาพ'; return;
        }
    }
    kycState.step = Math.max(0, Math.min(2, kycState.step + direction));
    document.getElementById('kyc-review-name').textContent = document.getElementById('kyc-full-name').value;
    document.getElementById('kyc-review-id').textContent = document.getElementById('kyc-id-number').value.replace(/^\d{9}/, '•••••••••');
    for (const type of ['idCard', 'selfie']) document.getElementById(`kyc-review-${type}`).src = kycState.images[type] || '';
    renderKycStep();
    document.getElementById('kyc-step-heading').focus();
}
function kycValidId(value) {
    if (!/^[1-9]\d{12}$/.test(value) || /^(\d)\1{12}$/.test(value)) return false;
    return (11 - [...value.slice(0, 12)].reduce((sum, n, i) => sum + Number(n) * (13 - i), 0) % 11) % 10 === Number(value[12]);
}
async function handleKycFileSelect(event, type) {
    const file = event.target.files[0];
    const key = type === 'id-card' ? 'idCard' : 'selfie';
    const version = (kycState.versions[key] || 0) + 1;
    kycState.versions[key] = version;
    delete kycState.images[key];
    const preview = document.getElementById(`kyc-${type}-preview`);
    preview.hidden = true; preview.removeAttribute('src');
    const label = document.getElementById(`kyc-${type}-filename`);
    label.textContent = 'ยังไม่ได้เลือกภาพ';
    if (!file || !validateImageFile(file)) { event.target.value = ''; return; }
    const generation = kycState.generation;
    label.textContent = 'กำลังเตรียมภาพ…';
    const url = URL.createObjectURL(file);
    try {
        const img = new Image(); img.src = url; await img.decode();
        if (Math.min(img.width, img.height) < 400) throw new Error('ภาพเล็กเกินไป ใช้ภาพด้านสั้นอย่างน้อย 400 พิกเซล');
        const ratio = Math.min(1, 1600 / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * ratio); canvas.height = Math.round(img.height * ratio);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        const data = canvas.toDataURL('image/jpeg', 0.9);
        if (data.length > 3 * 1024 * 1024) throw new Error('ภาพใหญ่เกินไป กรุณาเลือกภาพใหม่');
        if (generation !== kycState.generation || kycState.versions[key] !== version) return;
        kycState.images[key] = data;
        preview.src = data; preview.hidden = false; label.textContent = file.name;
    } catch (error) {
        if (generation === kycState.generation && kycState.versions[key] === version) {
            label.textContent = 'ใช้ภาพนี้ไม่ได้';
            document.getElementById('kyc-error').textContent = error.message || 'อ่านรูปภาพไม่สำเร็จ';
        }
    } finally { URL.revokeObjectURL(url); }
}
async function submitKyc() {
    if (kycState.busy) return;
    if (!document.getElementById('kyc-consent').checked) {
        document.getElementById('kyc-error').textContent = 'กรุณาอ่านและรับทราบการใช้ข้อมูลก่อนส่ง'; return;
    }
    kycState.busy = true; renderKycStep();
    const generation = kycState.generation;
    try {
        const result = await kycCall('kycSubmit', { fullName: document.getElementById('kyc-full-name').value.trim(), idNumber: document.getElementById('kyc-id-number').value, idCard: kycState.images.idCard, selfie: kycState.images.selfie, consent: true });
        if (generation !== kycState.generation || !state.loggedInUser) return;
        kycState.status = result.status; kycState.images = {};
        document.getElementById('kyc-form').reset();
        document.querySelectorAll('#modal-kyc img').forEach(img => img.removeAttribute('src'));
        document.getElementById('kyc-error').textContent = '';
        renderProfileKyc();
    } catch (error) { document.getElementById('kyc-error').textContent = kycError(error); }
    finally { kycState.busy = false; renderKycStep(); }
}
async function refreshKycQueue(next = false) {
    const generation = kycState.generation;
    try {
        const result = await kycCall('kycList', { cursor: next ? kycState.cursor : null });
        if (generation !== kycState.generation) return;
        state.kycQueue = result.items.map(item => ({ ...item, status: 'pending' }));
        kycState.cursor = result.cursor;
        kycState.queueError = '';
    } catch (error) {
        if (generation !== kycState.generation) return;
        state.kycQueue = []; kycState.queueError = kycError(error);
    }
    renderAdminPanel();
}
function renderKycQueue() {
    const body = document.getElementById('admin-kyc-queue-tbody');
    body.replaceChildren();
    if (!state.kycQueue.length) {
        const cell = body.insertRow().insertCell(); cell.colSpan = 5;
        cell.textContent = kycState.queueError || 'ไม่มีคำขอที่รอตรวจสอบ';
    }
    for (const request of state.kycQueue) {
        const row = body.insertRow();
        for (const text of [request.fullName, new Date(request.submittedAt).toLocaleString('th-TH'), 'บัตรและภาพถ่าย', 'รอตรวจโดยผู้ดูแล']) row.insertCell().textContent = text;
        const button = document.createElement('button'); button.className = 'btn-secondary btn-sm'; button.textContent = 'ตรวจเอกสาร';
        button.onclick = () => openKycReview(request.id); row.insertCell().append(button);
    }
    document.getElementById('kyc-queue-next').hidden = !kycState.cursor;
}
function clearKycEvidence() {
    document.querySelectorAll('#modal-kyc-review img').forEach(img => img.removeAttribute('src'));
    document.getElementById('kyc-evidence-id')?.replaceChildren();
    document.getElementById('kyc-evidence-name')?.replaceChildren();
    kycState.requestId = null;
}
async function openKycReview(id) {
    clearKycEvidence();
    const generation = kycState.generation;
    try {
        const d = await kycCall('kycEvidence', { requestId: id });
        if (generation !== kycState.generation) return;
        kycState.requestId = id;
        document.getElementById('kyc-evidence-name').textContent = d.fullName;
        document.getElementById('kyc-evidence-id').textContent = d.idNumber;
        d.images.forEach((src, i) => { document.getElementById(`kyc-evidence-${i}`).src = src; });
        document.getElementById('kyc-reviewed').checked = false;
        document.getElementById('kyc-reject-reason').value = '';
        document.getElementById('kyc-review-error').textContent = '';
        openModal('modal-kyc-review');
    } catch (error) { showToast(kycError(error), 'error'); }
}
async function adminResolveKyc(approve) {
    if (kycState.reviewBusy) return;
    kycState.reviewBusy = true;
    document.querySelectorAll('#modal-kyc-review button').forEach(button => button.disabled = true);
    try {
        await kycCall('kycResolve', { requestId: kycState.requestId, decision: approve ? 'approved' : 'rejected', reason: document.getElementById('kyc-reject-reason').value.trim(), reviewed: document.getElementById('kyc-reviewed').checked });
        closeModal('modal-kyc-review'); clearKycEvidence(); await refreshKycQueue();
        showToast('บันทึกผลตรวจแล้ว', 'success');
    } catch (error) { document.getElementById('kyc-review-error').textContent = kycError(error); }
    finally {
        kycState.reviewBusy = false;
        document.querySelectorAll('#modal-kyc-review button').forEach(button => button.disabled = false);
    }
}
