'use strict';
function validThaiId(value) {
  if (!/^[1-9]\d{12}$/.test(value || '') || /^(\d)\1{12}$/.test(value)) return false;
  const sum = [...value.slice(0, 12)].reduce((n, digit, i) => n + Number(digit) * (13 - i), 0);
  return (11 - sum % 11) % 10 === Number(value[12]);
}
function identity(auth) {
  if (!auth || auth.token?.firebase?.sign_in_provider === 'anonymous') return null;
  const t = auth.token || {};
  return t.phone_number || (t.email_verified === true && t.email) || null;
}
function validDecision(data) {
  return ['approved', 'rejected'].includes(data.decision) &&
    typeof data.requestId === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(data.requestId) &&
    (data.decision !== 'rejected' || (typeof data.reason === 'string' && data.reason.trim().length >= 5 && data.reason.length <= 500));
}
module.exports = { validThaiId, identity, validDecision };
