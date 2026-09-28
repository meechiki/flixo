/* Shared visual structure. Verification behavior lives in kyc.js. */
const identityCardArt = `<svg viewBox="0 0 320 210" fill="none" aria-hidden="true"><rect x="26" y="20" width="268" height="170" rx="18" fill="currentColor" opacity=".04" stroke="currentColor" stroke-width="2"/><rect x="47" y="43" width="50" height="8" rx="4" fill="currentColor" opacity=".2"/><rect x="47" y="69" width="84" height="96" rx="10" fill="currentColor" opacity=".08"/><circle cx="89" cy="104" r="17" fill="currentColor" opacity=".22"/><path d="M60 153c0-32 58-32 58 0" fill="currentColor" opacity=".22"/><path d="M153 83h105M153 103h78M153 137h105M153 155h60" stroke="currentColor" stroke-width="7" stroke-linecap="round" opacity=".16"/><path d="M10 53V16a8 8 0 018-8h37M265 8h37a8 8 0 018 8v37M310 157v37a8 8 0 01-8 8h-37M55 202H18a8 8 0 01-8-8v-37" stroke="#4f79eb" stroke-width="3" stroke-linecap="round"/></svg>`;
const selfieArt = `<svg viewBox="0 0 320 210" fill="none" aria-hidden="true"><ellipse cx="146" cy="86" rx="44" ry="53" fill="currentColor" opacity=".07" stroke="currentColor" stroke-width="2"/><path d="M65 201c1-78 162-78 162 0" fill="currentColor" opacity=".07"/><path d="M101 41C82 67 82 106 98 133M192 41c19 26 19 65 3 92" stroke="#4f79eb" stroke-width="3" stroke-linecap="round"/><rect x="176" y="126" width="103" height="65" rx="9" fill="var(--surface)" stroke="#4f79eb" stroke-width="2"/><rect x="188" y="140" width="26" height="37" rx="5" fill="#4f79eb" opacity=".14"/><path d="M225 145h39M225 157h29M225 171h39" stroke="#4f79eb" stroke-width="4" stroke-linecap="round" opacity=".35"/></svg>`;
function uploadPanel(type, title, description, artwork, tips) {
    return `<section data-kyc-step="${type === 'id-card' ? 1 : 2}" hidden>
      <div class="kyc-section-heading"><span class="kyc-kicker">${type === 'id-card' ? 'DOCUMENT PHOTO' : 'SELFIE PHOTO'}</span><h3>${title}</h3><p>${description}</p></div>
      <label class="kyc-dropzone" id="kyc-drop-${type}" for="kyc-${type}-file-input">
        <span class="kyc-document-art">${artwork}</span>
        <img id="kyc-${type}-preview" alt="ภาพที่เลือกสำหรับ${title}" hidden>
        <span class="kyc-upload-cta"><i class="fa-solid fa-arrow-up-from-bracket" aria-hidden="true"></i> <span id="kyc-${type}-action">ถ่ายรูปหรือเลือกภาพ</span></span>
        <span class="kyc-file-label" id="kyc-${type}-filename">JPG / PNG · ไม่เกิน 5 MB</span>
        <input class="kyc-file-input" id="kyc-${type}-file-input" type="file" accept="image/jpeg,image/png" onchange="handleKycFileSelect(event,'${type}')">
      </label>
      <ul class="kyc-photo-tips">${tips.map(t => `<li><i class="fa-solid fa-check" aria-hidden="true"></i>${t}</li>`).join('')}</ul>
    </section>`;
}
document.getElementById('kyc-dialogs').innerHTML = `
<div class="modal-overlay kyc-overlay" id="modal-kyc" role="dialog" aria-modal="true" aria-label="ยืนยันตัวตนกับ Flixo">
 <div class="kyc-shell">
  <aside class="kyc-rail">
   <div class="kyc-wordmark"><i class="fa-solid fa-shield-halved" aria-hidden="true"></i> FLIXO<span>VERIFICATION</span></div>
   <div class="kyc-rail-intro"><span class="kyc-kicker">KNOW EACH OTHER. TRADE BETTER.</span><h2>ความไว้ใจ<br>เริ่มต้นที่ตัวคุณ</h2><p>ยืนยันตัวตนให้คู่ซื้อขายมั่นใจ<br>แล้วเริ่มต้นดีลได้อย่างสบายใจ</p></div>
   <ol class="kyc-progress">
    <li><span class="kyc-step-number">1</span><div><strong>ข้อมูลของคุณ</strong><small>ชื่อตามบัตรและเลขประจำตัว</small></div></li>
    <li><span class="kyc-step-number">2</span><div><strong>บัตรประชาชน</strong><small>ภาพด้านหน้าบัตรที่ชัดเจน</small></div></li>
    <li><span class="kyc-step-number">3</span><div><strong>ภาพถ่ายคู่บัตร</strong><small>เห็นใบหน้าและบัตรในภาพเดียว</small></div></li>
    <li><span class="kyc-step-number">4</span><div><strong>ตรวจทานและส่ง</strong><small>เช็กความถูกต้องอีกครั้ง</small></div></li>
   </ol>
   <div class="kyc-rail-note"><i class="fa-solid fa-lock" aria-hidden="true"></i><p>เอกสารของคุณไม่แสดงต่อคู่ซื้อขาย<br>เฉพาะผู้ดูแลที่ได้รับสิทธิ์เท่านั้น</p></div>
  </aside>
  <div class="kyc-workspace">
   <header class="kyc-topbar"><span id="kyc-step-count">ขั้นตอน 1 / 4</span><button id="kyc-close" class="btn-icon" onclick="closeKycModal()" aria-label="ปิดการยืนยันตัวตน"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button></header>
   <div class="kyc-scroll-body">
    <div class="kyc-status-screen" id="kyc-result" hidden><div class="kyc-result-icon" id="kyc-result-icon"><i class="fa-regular fa-clock"></i></div><h3 id="kyc-result-title"></h3><p id="kyc-result-copy"></p><div class="kyc-result-reference" id="kyc-result-reference"></div></div>
    <div id="kyc-status-message" class="kyc-inline-notice" role="status" hidden></div>
    <form id="kyc-form" onsubmit="event.preventDefault(); kycNext(1)">
     <section data-kyc-step="0">
      <div class="kyc-section-heading"><span class="kyc-kicker">YOUR IDENTITY</span><h3 id="kyc-step-heading" tabindex="-1">เริ่มจากข้อมูลของคุณ</h3><p>กรอกให้ตรงกับบัตรประชาชน<br>เพื่อให้ผู้ดูแลตรวจสอบได้อย่างถูกต้อง</p></div>
      <div class="kyc-input-group"><label for="kyc-full-name">ชื่อ–นามสกุลตามบัตร</label><input id="kyc-full-name" type="text" autocomplete="name" minlength="3" maxlength="160" required placeholder="กรอกชื่อและนามสกุล"><span>ไม่ต้องใส่คำนำหน้าชื่อ</span></div>
      <div class="kyc-input-group"><label for="kyc-id-number">เลขประจำตัวประชาชน</label><input id="kyc-id-number" type="text" inputmode="numeric" autocomplete="off" pattern="[0-9]{13}" maxlength="13" required placeholder="ตัวเลข 13 หลัก" aria-describedby="kyc-id-help"><span id="kyc-id-help">ข้อมูลนี้ใช้ตรวจสอบตัวตนและไม่แสดงบนโปรไฟล์</span></div>
      <div class="kyc-prep"><span class="kyc-prep-icon"><i class="fa-regular fa-id-card" aria-hidden="true"></i></span><div><strong>เตรียมบัตรประชาชนไว้ใกล้ตัว</strong><p>ขั้นตอนถัดไปใช้ภาพหน้าบัตรและภาพคุณถือบัตร</p></div></div>
     </section>
     ${uploadPanel('id-card', 'ถ่ายด้านหน้าบัตร', 'ให้เห็นบัตรครบทั้งใบ และอ่านข้อความได้ชัดเจน', identityCardArt, ['เห็นครบทั้ง 4 มุม', 'ไม่มีแสงสะท้อนหรือภาพเบลอ', 'ใช้ด้านหน้าเท่านั้น ไม่ส่งเลข Laser'])}
     ${uploadPanel('selfie', 'ถ่ายภาพคุณพร้อมบัตร', 'ถือบัตรข้างใบหน้า ให้เห็นทั้งสองอย่างในภาพเดียว', selfieArt, ['เห็นใบหน้าและบัตรชัดเจน', 'ถอดหน้ากากและแว่นกันแดด', 'ใช้ภาพปัจจุบัน ไม่ใช้ฟิลเตอร์'])}
     <section data-kyc-step="3" hidden>
      <div class="kyc-section-heading"><span class="kyc-kicker">ONE LAST LOOK</span><h3>ทุกอย่างถูกต้องไหม?</h3><p>ตรวจทานอีกครั้งก่อนส่งให้ผู้ดูแล</p></div>
      <div class="kyc-review-card"><div class="kyc-card-caption">ข้อมูลส่วนตัว<button type="button" class="btn-link" onclick="kycGoTo(0)">แก้ไข</button></div><dl class="kyc-summary"><dt>ชื่อ–นามสกุล</dt><dd id="kyc-review-name"></dd><dt>เลขประจำตัว</dt><dd id="kyc-review-id"></dd></dl></div>
      <div class="kyc-review-images"><figure><img id="kyc-review-idCard" alt="ภาพบัตรที่จะส่ง"><figcaption>บัตรประชาชน<button type="button" class="btn-link" onclick="kycGoTo(1)">เปลี่ยนภาพ</button></figcaption></figure><figure><img id="kyc-review-selfie" alt="ภาพใบหน้าที่จะส่ง"><figcaption>ภาพถ่ายคู่บัตร<button type="button" class="btn-link" onclick="kycGoTo(2)">เปลี่ยนภาพ</button></figcaption></figure></div>
      <label class="kyc-consent"><input id="kyc-consent" type="checkbox"><span>ข้อมูลและเอกสารนี้เป็นของฉัน และฉันรับทราบการใช้ข้อมูลเพื่อยืนยันตัวตน</span></label>
      <details class="kyc-privacy"><summary>เราใช้และจัดเก็บข้อมูลอย่างไร?</summary><p>ผู้ดูแลที่ได้รับสิทธิ์เป็นผู้ตรวจเอกสาร ไม่มีการตรวจใบหน้าหรือความมีชีวิตอัตโนมัติ ภาพและข้อมูลในคำขอจะถูกลบตามรอบรายวันเมื่อครบ 30 วันนับจากส่ง ผลตรวจและประวัติการดำเนินการเก็บแยกจากรูป</p><button type="button" class="btn-link" onclick="openConsentWizard(2)">อ่านนโยบายความเป็นส่วนตัว</button></details>
     </section>
    </form>
    <p id="kyc-error" role="alert" class="kyc-error" tabindex="-1"></p>
   </div>
   <footer class="kyc-footer"><span class="kyc-footer-note" id="kyc-footer-note"><i class="fa-solid fa-lock" aria-hidden="true"></i> ตรวจสอบโดยผู้ดูแล</span><button id="kyc-back" class="kyc-back" onclick="kycNext(-1)">ย้อนกลับ</button><button id="kyc-next" class="kyc-primary" onclick="kycNext(1)">ถัดไป <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></button><button id="kyc-submit" class="kyc-primary" onclick="submitKyc()" hidden>ส่งยืนยันตัวตน</button><button id="kyc-status-refresh" class="kyc-back" onclick="refreshKycStatus()" hidden>ตรวจสถานะอีกครั้ง</button><button id="kyc-done" class="kyc-primary" onclick="closeKycModal()" hidden>กลับหน้าหลัก</button></footer>
  </div>
 </div>
</div>
<div class="modal-overlay kyc-overlay" id="modal-kyc-review" role="dialog" aria-modal="true" aria-labelledby="kyc-review-heading">
 <div class="kyc-review-shell"><header class="kyc-topbar"><div><span class="kyc-kicker">IDENTITY REVIEW</span><h2 id="kyc-review-heading">ตรวจเอกสารยืนยันตัวตน</h2></div><button class="btn-icon" onclick="closeModal('modal-kyc-review')" aria-label="ปิด"><i class="fa-solid fa-xmark"></i></button></header>
  <div class="kyc-admin-layout"><div class="kyc-admin-evidence"><div class="kyc-card-caption">หลักฐานประกอบ<span>กดภาพเพื่อขยาย</span></div><div class="kyc-review-images"><figure><button type="button" class="kyc-evidence-zoom" onclick="kycZoomEvidence(0)"><img id="kyc-evidence-0" alt="ขยายภาพบัตรประชาชน"></button><figcaption>01 / ด้านหน้าบัตร</figcaption></figure><figure><button type="button" class="kyc-evidence-zoom" onclick="kycZoomEvidence(1)"><img id="kyc-evidence-1" alt="ขยายภาพใบหน้าพร้อมบัตร"></button><figcaption>02 / ภาพถ่ายคู่บัตร</figcaption></figure></div></div>
   <div class="kyc-admin-decision"><span class="kyc-kicker">APPLICANT</span><h3 id="kyc-evidence-name"></h3><p id="kyc-evidence-id"></p><hr><h4>ตรวจสอบให้ครบก่อนตัดสินใจ</h4><ul class="kyc-photo-tips"><li>ชื่อและเลขบัตรตรงกับข้อมูลที่กรอก</li><li>บัตรไม่หมดอายุและอ่านได้ชัด</li><li>ใบหน้าในภาพสอดคล้องกับบัตร</li></ul><label class="kyc-consent"><input type="checkbox" id="kyc-reviewed"><span>ฉันตรวจข้อมูลและหลักฐานครบแล้ว</span></label><label class="kyc-reason-label" for="kyc-reject-reason">จุดที่ผู้ใช้ต้องแก้ไข</label><textarea id="kyc-reject-reason" rows="3" maxlength="500" placeholder="จำเป็นเมื่อขอให้ส่งใหม่ เช่น ภาพบัตรเบลอ อ่านชื่อไม่ได้"></textarea><p id="kyc-review-error" class="kyc-error" role="alert"></p><div class="kyc-admin-actions"><button class="kyc-back" onclick="adminResolveKyc(false)">ขอให้ส่งใหม่</button><button class="kyc-primary" onclick="adminResolveKyc(true)">อนุมัติเอกสาร</button></div></div>
  </div>
 </div>
</div>`;
