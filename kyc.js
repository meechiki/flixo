/* Manual identity review. Decisions come only from authenticated callables. */
const kycState = { status: 'unverified', reason: '', step: 0, images: {}, versions: {}, busy: false, timer: null, generation: 0, isAdmin: false, requestId: null, cursor: null };
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
    kycState.serviceChecked = false;
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
        kycState.submissionId = result.requestId;
        kycState.reason = result.reason || '';
        kycState.serviceError = '';
        kycState.serviceChecked = true;
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
        kycState.serviceChecked = true;
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
        document.getElementById(`kyc-drop-${key}`).classList.remove('has-image');
        document.getElementById(`kyc-${key}-action`).textContent = 'ถ่ายรูปหรือเลือกภาพ';
        document.getElementById(`kyc-${key}-filename`).textContent = 'JPG / PNG · ไม่เกิน 5 MB';
    }
    document.getElementById('kyc-error').textContent = '';
    openModal('modal-kyc');
    renderKycStep();
    refreshKycStatus();
    document.getElementById('kyc-full-name').focus();
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
    const needsLogin = !auth?.currentUser || auth.currentUser.isAnonymous;
    const unavailable = !kycState.serviceChecked || Boolean(kycState.serviceError);
    document.getElementById('kyc-form').hidden = needsLogin || unavailable || statusOnly;
    document.querySelectorAll('[data-kyc-step]').forEach(el => { el.hidden = statusOnly || Number(el.dataset.kycStep) !== kycState.step; });
    document.querySelectorAll('.kyc-progress li').forEach((el, i) => {
        el.classList.toggle('current', i === kycState.step);
        el.classList.toggle('complete', statusOnly || i < kycState.step);
        el.setAttribute('aria-current', i === kycState.step ? 'step' : 'false');
    });
    const box = document.getElementById('kyc-status-message');
    box.hidden = statusOnly || (!needsLogin && !unavailable && kycState.status !== 'rejected');
    box.textContent = needsLogin ? 'ต้องเข้าสู่ระบบด้วย Google หรือบัญชี Firebase ที่ยืนยันแล้วก่อนส่งเอกสาร กรุณาเข้าสู่ระบบก่อนเริ่มกรอกข้อมูล' : !kycState.serviceChecked ? 'กำลังตรวจสอบว่าระบบรับเอกสารพร้อมใช้งาน…' : kycState.serviceError || ({ approved: 'ยืนยันตัวตนแล้ว • ตรวจสอบโดยผู้ดูแลระบบ', pending: 'ได้รับเอกสารแล้ว • กำลังรอผู้ดูแลตรวจสอบ คุณกลับมาเช็กสถานะได้ภายหลัง', uploading: 'กำลังรับเอกสาร กรุณาตรวจสอบสถานะอีกครั้ง', rejected: `กรุณาแก้ไขและส่งใหม่: ${kycState.reason}` })[kycState.status] || '';
    document.getElementById('kyc-back').hidden = statusOnly || needsLogin || unavailable || kycState.step === 0;
    document.getElementById('kyc-next').hidden = statusOnly || needsLogin || unavailable || kycState.step === 3;
    document.getElementById('kyc-submit').hidden = statusOnly || needsLogin || unavailable || kycState.step !== 3;
    document.getElementById('kyc-login').hidden = statusOnly || !needsLogin;
    document.getElementById('kyc-submit').disabled = kycState.busy || Boolean(kycState.serviceError);
    document.getElementById('kyc-submit').textContent = kycState.busy ? 'กำลังส่งเอกสาร…' : 'ส่งยืนยันตัวตน';
    document.getElementById('kyc-close').disabled = kycState.busy;
    document.getElementById('kyc-back').disabled = kycState.busy;
    document.getElementById('kyc-step-count').textContent = statusOnly ? 'สถานะการยืนยันตัวตน' : `ขั้นตอน ${kycState.step + 1} / 4`;
    document.getElementById('kyc-status-refresh').hidden = needsLogin || (!statusOnly && !kycState.serviceError);
    document.getElementById('kyc-done').hidden = !statusOnly;
    document.getElementById('kyc-footer-note').hidden = statusOnly || needsLogin || unavailable || kycState.step > 0;
    document.getElementById('kyc-result').hidden = !statusOnly;
    if (statusOnly) {
        const approved = kycState.status === 'approved';
        document.getElementById('kyc-result-icon').innerHTML = approved ? '<i class="fa-solid fa-check" aria-hidden="true"></i>' : '<i class="fa-regular fa-clock" aria-hidden="true"></i>';
        document.getElementById('kyc-result-title').textContent = approved ? 'ยืนยันตัวตนเรียบร้อย' : kycState.status === 'uploading' ? 'กำลังรับเอกสารของคุณ' : 'ได้รับเอกสารแล้ว';
        document.getElementById('kyc-result-copy').textContent = approved ? 'ผู้ดูแลตรวจสอบเอกสารแล้ว คุณกลับไปเริ่มต้นซื้อขายได้เลย' : 'ผู้ดูแลจะตรวจสอบข้อมูลและรูปภาพ คุณปิดหน้านี้และกลับมาเช็กผลได้ภายหลัง';
        document.getElementById('kyc-result-reference').textContent = kycState.submissionId ? `เลขคำขอ · ${kycState.submissionId}` : 'สถานะจะอัปเดตเมื่อมีผลตรวจ';
    }
}
function kycNext(direction) {
    if (kycState.busy || ['approved', 'pending', 'uploading'].includes(kycState.status)) return;
    if (direction > 0 && (!auth?.currentUser || auth.currentUser.isAnonymous || !kycState.serviceChecked || kycState.serviceError)) { renderKycStep(); return; }
    document.getElementById('kyc-error').textContent = '';
    if (direction > 0) {
        if (kycState.step === 0 && !document.getElementById('kyc-form').reportValidity()) return;
        if (kycState.step === 0 && !kycValidId(document.getElementById('kyc-id-number').value)) {
            document.getElementById('kyc-error').textContent = 'เลขบัตรไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง'; return;
        }
        if ((kycState.step === 1 && !kycState.images.idCard) || (kycState.step === 2 && !kycState.images.selfie)) {
            document.getElementById('kyc-error').textContent = 'เลือกภาพและรอให้ภาพตัวอย่างแสดงก่อนดำเนินการต่อ'; return;
        }
    }
    kycState.step = Math.max(0, Math.min(3, kycState.step + direction));
    document.getElementById('kyc-review-name').textContent = document.getElementById('kyc-full-name').value;
    document.getElementById('kyc-review-id').textContent = document.getElementById('kyc-id-number').value.replace(/^\d{9}/, '•••••••••');
    for (const type of ['idCard', 'selfie']) document.getElementById(`kyc-review-${type}`).src = kycState.images[type] || '';
    renderKycStep();
    const heading = document.querySelector(`[data-kyc-step="${kycState.step}"] h3`);
    heading.setAttribute('tabindex', '-1'); heading.focus();
    document.querySelector('#modal-kyc .kyc-scroll-body').scrollTop = 0;
}
async function kycGoToLogin() {
    if (kycState.busy) return;
    closeKycModal();
    try { localStorage.removeItem('flixo_saved_session'); } catch (_) {}
    try { await auth?.signOut(); } catch (_) {}
    resetSessionState();
    document.getElementById('btn-login-google')?.focus();
}
function kycGoTo(step) {
    if (kycState.busy || step < 0 || step > 2) return;
    kycState.step = step; renderKycStep();
    document.querySelector('#modal-kyc .kyc-scroll-body').scrollTop = 0;
}
function kycZoomEvidence(index) {
    const image = document.getElementById(`kyc-evidence-${index}`);
    image.closest('figure').classList.toggle('expanded');
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
    document.getElementById(`kyc-drop-${type}`).classList.remove('has-image');
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
        document.getElementById(`kyc-drop-${type}`).classList.add('has-image');
        document.getElementById(`kyc-${type}-action`).textContent = 'เปลี่ยนภาพ';
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
        kycState.status = result.status; kycState.submissionId = result.requestId; kycState.images = {};
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
    document.querySelectorAll('#modal-kyc-review figure').forEach(el => el.classList.remove('expanded'));
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
