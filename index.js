const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ========== CONFIG (แก้ตรงนี้) ==========
const ADMIN_PASSWORD = 'admin1234';       // รหัสผ่านเข้าหน้า admin
const API_KEY = 'my-secret-api-key';      // key สำหรับเว็บเรียก API
const DISCORD_WEBHOOK_URL = '';           // ใส่ discord webhook (ถ้ามี)
const QR_EXPIRE_SECONDS = 300;            // QR หมดอายุ 5 นาที
// =========================================

// เก็บข้อมูลในหน่วยความจำ
const transactions = {};
let qrPayloadBase = '';  // payload ที่แกะจาก QR ที่อัปโหลด

// ========== ADMIN SESSION ==========
const adminSessions = new Set();

// ========== MULTER สำหรับรับรูป QR ==========
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// ========== SERVE หน้า ADMIN ==========
app.get('/admin', (req, res) => {
  const sessionId = req.headers['x-session-id'] || '';
  const isLoggedIn = adminSessions.has(sessionId);
  
  res.send(`<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Admin - Payment Server</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', sans-serif; background: #0f172a; color: #e2e8f0; min-height: 100vh; }
  .container { max-width: 600px; margin: 0 auto; padding: 20px; }
  h1 { color: #38bdf8; font-size: 22px; margin-bottom: 24px; padding-top: 20px; }
  h2 { color: #94a3b8; font-size: 15px; margin-bottom: 12px; }
  .card { background: #1e293b; border-radius: 12px; padding: 20px; margin-bottom: 16px; border: 1px solid #334155; }
  input, textarea { width: 100%; padding: 10px 14px; background: #0f172a; border: 1px solid #334155; border-radius: 8px; color: #e2e8f0; font-size: 14px; margin-bottom: 12px; }
  button { width: 100%; padding: 12px; background: #38bdf8; color: #0f172a; border: none; border-radius: 8px; font-size: 15px; font-weight: bold; cursor: pointer; }
  button:hover { background: #7dd3fc; }
  .btn-red { background: #ef4444; color: white; }
  .btn-red:hover { background: #f87171; }
  .status { padding: 10px 14px; border-radius: 8px; font-size: 13px; margin-top: 10px; display: none; }
  .status.ok { background: #064e3b; color: #6ee7b7; display: block; }
  .status.err { background: #7f1d1d; color: #fca5a5; display: block; }
  .info-box { background: #0f172a; border-radius: 8px; padding: 12px; font-size: 12px; color: #94a3b8; word-break: break-all; margin-top: 8px; }
  .qr-preview { text-align: center; margin: 12px 0; }
  .qr-preview img { max-width: 200px; border-radius: 8px; }
  label { font-size: 13px; color: #94a3b8; display: block; margin-bottom: 6px; }
  .tag { display: inline-block; background: #166534; color: #86efac; padding: 2px 8px; border-radius: 4px; font-size: 11px; margin-left: 8px; }
  .tag.red { background: #7f1d1d; color: #fca5a5; }
</style>
</head>
<body>
<div class="container">
  <h1>⚙️ Payment Server Admin</h1>
  
  ${!isLoggedIn ? `
  <div class="card" id="loginCard">
    <h2>🔐 เข้าสู่ระบบ</h2>
    <label>รหัสผ่าน</label>
    <input type="password" id="password" placeholder="ใส่รหัสผ่าน" />
    <button onclick="login()">เข้าสู่ระบบ</button>
    <div id="loginStatus" class="status"></div>
  </div>
  ` : `
  <div class="card">
    <h2>📱 QR ที่ใช้งานอยู่ 
      <span class="tag ${qrPayloadBase ? '' : 'red'}">${qrPayloadBase ? '✅ มี QR แล้ว' : '❌ ยังไม่มี QR'}</span>
    </h2>
    ${qrPayloadBase ? `
    <div class="qr-preview">
      <img src="https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(qrPayloadBase)}&size=200x200" />
    </div>
    <div class="info-box">Payload: ${qrPayloadBase.substring(0, 60)}...</div>
    ` : '<p style="color:#64748b;font-size:13px;">ยังไม่ได้อัปโหลด QR PromptPay</p>'}
  </div>

  <div class="card">
    <h2>📤 อัปโหลด QR PromptPay</h2>
    <p style="font-size:12px;color:#64748b;margin-bottom:12px;">อัปโหลดรูป QR PromptPay ของบัญชีที่ต้องการรับเงิน ระบบจะแกะ payload อัตโนมัติ</p>
    <label>เลือกรูป QR (.png, .jpg)</label>
    <input type="file" id="qrFile" accept="image/*" />
    <button onclick="uploadQR()">📤 อัปโหลดและแกะ QR</button>
    <div id="uploadStatus" class="status"></div>
  </div>

  <div class="card">
    <h2>🔑 API Key สำหรับเว็บ</h2>
    <div class="info-box">${API_KEY}</div>
    <p style="font-size:11px;color:#64748b;margin-top:8px;">ใช้ key นี้ใน Authorization: Bearer ของเว็บคุณ</p>
  </div>

  <div class="card">
    <h2>📊 รายการ Transaction ล่าสุด</h2>
    <div id="txnList"><p style="color:#64748b;font-size:13px;">กำลังโหลด...</p></div>
    <button onclick="loadTxn()" style="margin-top:12px;background:#334155;color:#e2e8f0;">🔄 รีเฟรช</button>
  </div>

  <div class="card">
    <button class="btn-red" onclick="logout()">ออกจากระบบ</button>
  </div>
  `}
</div>

<script>
const SESSION_KEY = 'admin_session';
let sessionId = localStorage.getItem(SESSION_KEY) || '';

async function login() {
  const pw = document.getElementById('password').value;
  const res = await fetch('/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: pw })
  });
  const data = await res.json();
  const el = document.getElementById('loginStatus');
  if (data.status === 'ok') {
    localStorage.setItem(SESSION_KEY, data.sessionId);
    location.reload();
  } else {
    el.className = 'status err';
    el.textContent = '❌ รหัสผ่านไม่ถูกต้อง';
  }
}

async function uploadQR() {
  const file = document.getElementById('qrFile').files[0];
  const el = document.getElementById('uploadStatus');
  if (!file) { el.className='status err'; el.textContent='กรุณาเลือกไฟล์ก่อน'; return; }
  
  el.className='status ok'; el.textContent='⏳ กำลังแกะ QR...';
  
  const reader = new FileReader();
  reader.onload = async (e) => {
    const base64 = e.target.result.split(',')[1];
    const res = await fetch('/admin/upload-qr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-session-id': localStorage.getItem(SESSION_KEY) },
      body: JSON.stringify({ image: base64, mimeType: file.type })
    });
    const data = await res.json();
    if (data.status === 'ok') {
      el.className='status ok'; el.textContent='✅ แกะ QR สำเร็จ! Payload: ' + data.payload.substring(0,40) + '...';
      setTimeout(() => location.reload(), 2000);
    } else {
      el.className='status err'; el.textContent='❌ ' + (data.message || 'แกะ QR ไม่สำเร็จ');
    }
  };
  reader.readAsDataURL(file);
}

async function loadTxn() {
  const res = await fetch('/admin/transactions', { headers: { 'x-session-id': localStorage.getItem(SESSION_KEY) } });
  const data = await res.json();
  const el = document.getElementById('txnList');
  if (!data.transactions || data.transactions.length === 0) {
    el.innerHTML = '<p style="color:#64748b;font-size:13px;">ยังไม่มีรายการ</p>'; return;
  }
  el.innerHTML = data.transactions.reverse().slice(0,10).map(t => \`
    <div style="padding:8px;border-bottom:1px solid #334155;font-size:12px;">
      <span style="color:\${t.status==='success'?'#6ee7b7':t.status==='pending'?'#fbbf24':'#f87171'}">\${t.status==='success'?'✅':t.status==='pending'?'⏳':'❌'} \${t.status}</span>
      <span style="color:#94a3b8;margin-left:8px;">\${t.amount} บาท</span>
      <span style="color:#475569;margin-left:8px;">\${t.id}</span>
    </div>
  \`).join('');
}

function logout() {
  localStorage.removeItem(SESSION_KEY);
  location.reload();
}

if (document.getElementById('txnList')) loadTxn();
</script>
</body>
</html>`);
});

// ========== ADMIN LOGIN ==========
app.post('/admin/login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    const sessionId = Math.random().toString(36).substr(2) + Date.now().toString(36);
    adminSessions.add(sessionId);
    setTimeout(() => adminSessions.delete(sessionId), 24 * 60 * 60 * 1000); // หมดอายุ 24 ชม.
    return res.json({ status: 'ok', sessionId });
  }
  res.status(401).json({ status: 'error', message: 'รหัสผ่านไม่ถูกต้อง' });
});

// ========== ADMIN อัปโหลด QR ==========
app.post('/admin/upload-qr', async (req, res) => {
  const sessionId = req.headers['x-session-id'] || '';
  if (!adminSessions.has(sessionId)) return res.status(401).json({ status: 'error', message: 'ไม่ได้รับอนุญาต' });

  const { image, mimeType } = req.body;
  if (!image) return res.status(400).json({ status: 'error', message: 'ไม่พบรูปภาพ' });

  try {
    // ใช้ API แกะ QR จากรูป
    const imageBuffer = Buffer.from(image, 'base64');
    const formData = new FormData();
    const blob = new Blob([imageBuffer], { type: mimeType || 'image/png' });
    formData.append('file', blob, 'qr.png');

    const response = await fetch('https://api.qrserver.com/v1/read-qr-code/', {
      method: 'POST',
      body: formData
    });
    const result = await response.json();
    
    const payload = result?.[0]?.symbol?.[0]?.data;
    if (!payload) return res.status(400).json({ status: 'error', message: 'แกะ QR ไม่ได้ กรุณาใช้รูปที่ชัดขึ้น' });

    qrPayloadBase = payload;
    console.log('✅ QR Payload ใหม่:', payload.substring(0, 50));
    res.json({ status: 'ok', payload });
  } catch (e) {
    console.error('QR decode error:', e);
    res.status(500).json({ status: 'error', message: 'เกิดข้อผิดพลาด: ' + e.message });
  }
});

// ========== ADMIN ดู Transactions ==========
app.get('/admin/transactions', (req, res) => {
  const sessionId = req.headers['x-session-id'] || '';
  if (!adminSessions.has(sessionId)) return res.status(401).json({ status: 'error' });
  
  const list = Object.entries(transactions).map(([id, t]) => ({ id, ...t }));
  res.json({ transactions: list });
});

// ========== API: สร้าง QR ==========
app.post('/api/v1/promptpay/generate', async (req, res) => {
  if (!checkApiKey(req, res)) return;

  const { amount } = req.body;
  if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
    return res.status(400).json({ status: 'error', message: 'จำนวนเงินไม่ถูกต้อง', code: 'INVALID_AMOUNT' });
  }
  if (!qrPayloadBase) {
    return res.status(503).json({ status: 'error', message: 'ยังไม่ได้ตั้งค่า QR กรุณาอัปโหลด QR ใน Admin ก่อน', code: 'QR_NOT_CONFIGURED' });
  }

  const transactionId = 'TXN-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6).toUpperCase();
  const expiresAt = Math.floor(Date.now() / 1000) + QR_EXPIRE_SECONDS;
  const amountFloat = parseFloat(amount);

  // แทรกยอดเงินเข้าไปใน payload เดิม
  const payload = injectAmountToPayload(qrPayloadBase, amountFloat);
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(payload)}&size=300x300&ecc=M&format=png`;

  transactions[transactionId] = { amount: amountFloat, status: 'pending', expiresAt, createdAt: Date.now() };

  await sendDiscord(`🆕 QR ใหม่ | ${transactionId} | ยอด: ${amount} บาท`);

  res.json({
    status: 'success',
    data: { transactionId, qr_url: qrUrl, payload, amount: amount.toString(), currency: 'THB', expires_at: expiresAt }
  });
});

// ========== API: เช็คสถานะ ==========
app.post('/api/v1/promptpay/check', (req, res) => {
  if (!checkApiKey(req, res)) return;

  const { transactionId } = req.body;
  if (!transactionId) return res.status(400).json({ status: 'error', message: 'ต้องระบุ transactionId', code: 'MISSING_ID' });

  const txn = transactions[transactionId];
  if (!txn) return res.status(404).json({ status: 'error', message: 'ไม่พบรายการ', code: 'NOT_FOUND' });

  const now = Math.floor(Date.now() / 1000);
  if (txn.status === 'pending' && now > txn.expiresAt) txn.status = 'error';

  if (txn.status === 'success') return res.json({ status: 'success', message: 'ชำระเงินสำเร็จ', transactionId, amount: txn.amount.toString(), currency: 'THB' });
  if (txn.status === 'error') return res.json({ status: 'error', message: 'QR หมดอายุ', code: 'EXPIRED' });

  res.json({ status: 'pending', message: 'รอการชำระเงิน', transactionId, amount: txn.amount.toString(), currency: 'THB', expires_at: txn.expiresAt, time_remaining: txn.expiresAt - now });
});

// ========== API: รับ Notification จากมือถือ ==========
app.post('/api/notify', async (req, res) => {
  const { amount, appName } = req.body;
  console.log('📱 Notification:', req.body);

  if (amount) {
    const amountNum = parseFloat(amount);
    for (const [txnId, txn] of Object.entries(transactions)) {
      if (txn.status === 'pending' && Math.abs(txn.amount - amountNum) < 0.01) {
        txn.status = 'success';
        await sendDiscord(`✅ เงินเข้า! | ${txnId} | ยอด: ${amount} บาท | แอป: ${appName || 'ไม่ระบุ'}`);
        break;
      }
    }
  }
  res.json({ status: 'ok' });
});

// ========== API: Log และ Config สำหรับ APK ==========
app.post('/api/log', (req, res) => { console.log('📋 Log:', req.body); res.json({ status: 'ok' }); });
app.get('/api/config', (req, res) => { res.json({ status: 'ok', notify_url: '/api/notify', log_url: '/api/log' }); });

// ========== ฟังก์ชัน Helper ==========
function checkApiKey(req, res) {
  const auth = req.headers['authorization'] || '';
  const key = auth.replace('Bearer ', '').trim();
  if (key !== API_KEY) {
    res.status(401).json({ status: 'error', message: 'API Key ไม่ถูกต้อง', code: 'INVALID_API_KEY' });
    return false;
  }
  return true;
}

function injectAmountToPayload(payload, amount) {
  // ลบ amount เดิมออก (field 54) แล้วใส่ใหม่
  const amountStr = amount.toFixed(2);
  const amountField = '54' + String(amountStr.length).padStart(2, '0') + amountStr;
  
  // ถ้า payload มี field 54 อยู่แล้ว ให้แทนที่
  let newPayload = payload.replace(/6304[0-9A-F]{4}$/, ''); // ตัด CRC เดิมออก
  newPayload = newPayload.replace(/5403[0-9.]+|5404[0-9.]+|5405[0-9.]+|5406[0-9.]+/, ''); // ตัด amount เดิม
  
  // หา position ก่อน field 58 หรือ 59 หรือ 60 แล้วแทรก amount
  const insertBefore = newPayload.search(/5802|5902|6002/);
  if (insertBefore > 0) {
    newPayload = newPayload.substring(0, insertBefore) + amountField + newPayload.substring(insertBefore);
  } else {
    newPayload += amountField;
  }
  
  newPayload += '6304';
  const crc = crc16(newPayload);
  return newPayload + crc;
}

function crc16(data) {
  let crc = 0xFFFF;
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) { crc = (crc & 0x8000) ? (crc << 1) ^ 0x1021 : crc << 1; }
  }
  return ((crc & 0xFFFF).toString(16).toUpperCase()).padStart(4, '0');
}

async function sendDiscord(message) {
  if (!DISCORD_WEBHOOK_URL) return;
  try {
    await fetch(DISCORD_WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: message }) });
  } catch (e) { console.error('Discord error:', e.message); }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server ทำงานที่ port ${PORT}`));
