const express = require('express');
const app = express();
app.use(express.json());

// เก็บข้อมูล transaction ในหน่วยความจำ
const transactions = {};

// ========== CONFIG ==========
const API_KEYS = ['YOUR_SECRET_API_KEY']; // เปลี่ยนเป็น key ที่คุณต้องการ
const DISCORD_WEBHOOK_URL = 'YOUR_DISCORD_WEBHOOK_URL'; // ใส่ webhook discord ของคุณ
const QR_EXPIRE_SECONDS = 300; // QR หมดอายุใน 5 นาที
// ============================

// ตรวจสอบ API Key
function checkApiKey(req, res) {
  const auth = req.headers['authorization'] || '';
  const key = auth.replace('Bearer ', '').trim();
  if (!API_KEYS.includes(key)) {
    res.status(401).json({ status: 'error', message: 'API Key ไม่ถูกต้อง', code: 'INVALID_API_KEY' });
    return false;
  }
  return true;
}

// ส่งแจ้งเตือนไป Discord
async function sendDiscord(message) {
  if (!DISCORD_WEBHOOK_URL || DISCORD_WEBHOOK_URL === 'YOUR_DISCORD_WEBHOOK_URL') return;
  try {
    await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: message })
    });
  } catch (e) {
    console.error('Discord error:', e.message);
  }
}

// ========== ENDPOINT 1: สร้าง QR ==========
app.post('/api/v1/promptpay/generate', async (req, res) => {
  if (!checkApiKey(req, res)) return;

  const { amount } = req.body;
  if (!amount || isNaN(amount) || amount <= 0) {
    return res.status(400).json({ status: 'error', message: 'จำนวนเงินไม่ถูกต้อง', code: 'INVALID_AMOUNT' });
  }

  const transactionId = 'TXN-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6).toUpperCase();
  const expiresAt = Math.floor(Date.now() / 1000) + QR_EXPIRE_SECONDS;

  // เก็บ transaction
  transactions[transactionId] = {
    amount,
    status: 'pending',
    expiresAt,
    createdAt: Date.now()
  };

  // สร้าง QR URL (ใช้ promptpay ของคุณ — ใส่เบอร์ PromptPay ตรงนี้)
  const PROMPTPAY_NUMBER = 'YOUR_PROMPTPAY_NUMBER'; // เช่น 0812345678
  const amountFormatted = parseFloat(amount).toFixed(2);
  const payload = generatePromptPayPayload(PROMPTPAY_NUMBER, amountFormatted);
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(payload)}&size=300x300&ecc=M&format=png`;

  await sendDiscord(`🆕 QR ใหม่ | ${transactionId} | ยอด: ${amount} บาท`);

  res.json({
    status: 'success',
    data: {
      transactionId,
      qr_url: qrUrl,
      payload,
      amount: amount.toString(),
      currency: 'THB',
      expires_at: expiresAt
    }
  });
});

// ========== ENDPOINT 2: เช็คสถานะ ==========
app.post('/api/v1/promptpay/check', (req, res) => {
  if (!checkApiKey(req, res)) return;

  const { transactionId } = req.body;
  if (!transactionId) {
    return res.status(400).json({ status: 'error', message: 'ต้องระบุ Transaction ID', code: 'MISSING_TRANSACTION_ID' });
  }

  const txn = transactions[transactionId];
  if (!txn) {
    return res.status(404).json({ status: 'error', message: 'ไม่พบรายการ', code: 'TRANSACTION_NOT_FOUND' });
  }

  const now = Math.floor(Date.now() / 1000);
  if (txn.status === 'pending' && now > txn.expiresAt) {
    txn.status = 'error';
  }

  if (txn.status === 'success') {
    return res.json({ status: 'success', message: 'ชำระเงินสำเร็จ', transactionId, amount: txn.amount.toString(), currency: 'THB' });
  }

  if (txn.status === 'error') {
    return res.json({ status: 'error', message: 'QR หมดอายุหรือเกิดข้อผิดพลาด', code: 'TRANSACTION_EXPIRED' });
  }

  res.json({
    status: 'pending',
    message: 'รอการชำระเงิน',
    transactionId,
    amount: txn.amount.toString(),
    currency: 'THB',
    expires_at: txn.expiresAt,
    time_remaining: txn.expiresAt - now
  });
});

// ========== ENDPOINT 3: รับแจ้งเตือนจากมือถือ (APK ส่งมา) ==========
app.post('/api/notify', async (req, res) => {
  const { transactionId, amount, appName, text } = req.body;
  console.log('📱 Notification จากมือถือ:', req.body);

  // หา transaction ที่ตรงกับยอดเงิน
  if (amount) {
    for (const [txnId, txn] of Object.entries(transactions)) {
      if (txn.status === 'pending' && parseFloat(txn.amount) === parseFloat(amount)) {
        txn.status = 'success';
        await sendDiscord(`✅ เงินเข้า! | ${txnId} | ยอด: ${amount} บาท | แอป: ${appName || 'ไม่ระบุ'}`);
        break;
      }
    }
  }

  res.json({ status: 'ok' });
});

// ========== ENDPOINT 4: รับ log จากมือถือ ==========
app.post('/api/log', (req, res) => {
  console.log('📋 Log จากมือถือ:', req.body);
  res.json({ status: 'ok' });
});

// ========== ENDPOINT 5: config สำหรับ APK ==========
app.get('/api/config', (req, res) => {
  res.json({
    status: 'ok',
    notify_url: '/api/notify',
    log_url: '/api/log',
    discord_webhook: DISCORD_WEBHOOK_URL
  });
});

// ========== ฟังก์ชันสร้าง PromptPay Payload ==========
function generatePromptPayPayload(phoneNumber, amount) {
  const phone = phoneNumber.replace(/[^0-9]/g, '').replace(/^0/, '66');
  const merchantId = '0066' + phone;
  const merchantIdField = '0016A000000677010111' + '01' + String(merchantId.length).padStart(2, '0') + merchantId;
  const amountField = '5405' + String(amount.length).padStart(2, '0') + amount;
  const payload = '000201' + '010212' + '29' + String(merchantIdField.length).padStart(2, '0') + merchantIdField + '5303764' + amountField + '5802TH' + '6304';
  const crc = crc16(payload);
  return payload + crc;
}

function crc16(data) {
  let crc = 0xFFFF;
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) ? (crc << 1) ^ 0x1021 : crc << 1;
    }
  }
  return ((crc & 0xFFFF).toString(16).toUpperCase()).padStart(4, '0');
}

// เริ่ม server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server ทำงานที่ port ${PORT}`);
});
