import {
  randomBytes,
  createCipheriv,
  createDecipheriv,
  createHash,
} from 'crypto';

// Mã hóa/giải mã secret (token, cookie, API key) trước khi lưu DB.
// Thuật toán AES-256-GCM. Khóa lấy từ env APP_ENCRYPTION_KEY (bất kỳ chuỗi nào,
// được băm SHA-256 thành khóa 32 byte). Định dạng lưu: "ivB64:tagB64:cipherB64".
// PHẢI trùng thuật toán với bot/lib/crypto.js để hai bên giải mã chéo được.

function getKey(): Buffer {
  const secret = process.env.APP_ENCRYPTION_KEY;
  if (!secret) {
    throw new Error(
      'APP_ENCRYPTION_KEY chưa được đặt trong môi trường. Thêm vào .env.local trước khi lưu/đọc secret.',
    );
  }
  return createHash('sha256').update(secret).digest();
}

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
}

export function decrypt(payload: string): string {
  const [ivB64, tagB64, dataB64] = payload.split(':');
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error('Chuỗi mã hóa không hợp lệ (thiếu iv/tag/ciphertext).');
  }
  const decipher = createDecipheriv('aes-256-gcm', getKey(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return decipher.update(Buffer.from(dataB64, 'base64')).toString('utf8') + decipher.final('utf8');
}

// Che secret khi trả về client: chỉ lộ vài ký tự cuối, không bao giờ trả giá trị thô.
export function mask(plain: string | null | undefined): string {
  if (!plain) return '';
  if (plain.length <= 4) return '••••';
  return '••••' + plain.slice(-4);
}
