const crypto = require('crypto');

// Mã hóa/giải mã secret — BẢN SONG SINH của src/lib/crypto.ts (phải trùng thuật toán).
// AES-256-GCM, khóa = SHA-256(APP_ENCRYPTION_KEY). Định dạng "ivB64:tagB64:cipherB64".

function getKey() {
  const secret = process.env.APP_ENCRYPTION_KEY;
  if (!secret) {
    throw new Error('APP_ENCRYPTION_KEY chưa được đặt trong .env.local — không thể giải mã secret.');
  }
  return crypto.createHash('sha256').update(secret).digest();
}

function encrypt(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
}

function decrypt(payload) {
  const [ivB64, tagB64, dataB64] = String(payload).split(':');
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error('Chuỗi mã hóa không hợp lệ (thiếu iv/tag/ciphertext).');
  }
  const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return decipher.update(Buffer.from(dataB64, 'base64')).toString('utf8') + decipher.final('utf8');
}

module.exports = { encrypt, decrypt };
