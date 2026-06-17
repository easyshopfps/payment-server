const express = require('express');
const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ========== CONFIG (แก้ตรงนี้) ==========
const ADMIN_PASSWORD = 'admin1234';
const API_KEY = 'my-secret-api-key';
const DISCORD_WEBHOOK_URL = '';
const QR_EXPIRE_SECONDS = 300;
// =========================================

const transactions = {};
let qrPayloadBase = '';

// ========== หน้า ADMIN ==========
app.get('/admin', (req, res) => {
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
  input { width: 100%; padding: 10px 14px; background: #0f172a; border: 1px solid #334155; border-radius: 8px; color: #e2e8f0; font-size: 14px; margin-bottom: 12px; }
  button { width: 100%; padding: 12px; background: #38bdf8; color: #0f172a; border: none; border-radius: 8px; font-size: 15px; font-weight: bold; cursor: pointer; margin-bottom: 8px; }
  button:hover { background: #7dd3fc; }
  .btn-red { background: #ef4444; color: white; }
  .btn-gray { background: #334155; color: #e2e8f0; }
  .status { padding: 10px 14px; border-radius: 8px; font-size: 13px; margin-top: 10px; }
  .ok { background: #064e3b; color: #6ee7b7; }
  .err { background: #7f1d1d; color: #fca5a5; }
  .info-box { background: #0f172a; border-radius: 8px; padding: 12px; font-size: 12px; color: #94a3b8; word-break: break-all; margin-top: 8px; }
  .qr-preview { text-align: center; margin: 12px 0; }
  .qr-preview img { max-width: 180px; border-radius: 8px; }
  label { font-size: 13px; color: #94a3b8; display: block; margin-bottom: 6px; }
  .hidden { display: none; }
  .tag-green { display:inline-block; background:#166534; color:#86efac; padding:2px 8px; border-radius:4px; font-size:11px; margin-left:8px; }
  .tag-red { display:inline-block; background:#7f1d1d; color:#fca5a5; padding:2px 8px; border-radius:4px; font-size:11px; margin-left:8px; }
</style>
</head>
<body>
<div class="container">
  <h1>⚙️ Payment Server Admin</h1>

  <!-- หน้า Login -->
  <div id="loginSection" class="card">
    <h2>🔐 เข้าสู่ระบบ</h2>
    <label>รหัสผ่าน</label>
    <input type="password" id="pwInput" placeholder="ใส่รหัสผ่าน" onkeydown="if(event.key==='Enter')login()" />
    <button onclick="login()">เข้าสู่ระบบ</button>
    <div id="loginMsg"></div>
  </div>

  <!-- หน้าหลัง Login -->
  <div id="mainSection" class="hidden">

    <div class="card">
      <h2>📱 QR ที่ใช้งานอยู่ <span id="qrTag"></span></h2>
      <div id="qrPreview"></div>
    </div>

    <div class="card">
      <h2>📤 อัปโหลด QR PromptPay</h2>
      <p style="font-size:12px;color:#64748b;margin-bottom:12px;">อัปโหลดรูป QR ของบัญชีที่ต้องการรับเงิน</p>
      <label>เลือกรูป QR (.png, .jpg)</label>
      <input type="file" id="qrFile" accept="image/*" />
      <button onclick="uploadQR()">📤 อัปโหลดและแกะ QR</button>
      <div id="uploadMsg"></div>
    </div>

    <div class="card">
      <h2>🔑 API Key</h2>
      <div class="info-box" id="apiKeyBox"></div>
      <p style="font-size:11px;color:#64748b;margin-top:8px;">ใช้ใน Authorization: Bearer ของเว็บ</p>
    </div>

    <div class="card">
      <h2>📊 Transaction ล่าสุด</h2>
      <div id="txnList"><p style="color:#64748b;font-size:13px;">กำลังโหลด...</p></div>
      <button class="btn-gray" onclick="loadTxn()" style="margin-top:12px;">🔄 รีเฟรช</button>
    </div>

    <div class="card">
      <button class="btn-red" onclick="logout()">ออกจากระบบ</button>
    </div>

  </div>
</div>

<script>
let token = sessionStorage.getItem('admin_token') || '';

function showMsg(elId, msg, type) {
  const el = document.getElementById(elId);
  el.className = type;
  el.textContent = msg;
}

async function login() {
  const pw = document.getElementById('pwInput').value;
  try {
    const res = await fetch('/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pw })
    });
    const data = await res.json();
    if (data.status === 'ok') {
      token = data.token;
      sessionStorage.setItem('admin_token', token);
      showMain();
    } else {
      showMsg('loginMsg', '❌ รหัสผ่านไม่ถูกต้อง', 'status err');
    }
  } catch(e) {
    showMsg('loginMsg', '❌ เชื่อมต่อ server ไม่ได้', 'status err');
  }
}

async function showMain() {
  document.getElementById('loginSection').classList.add('hidden');
  document.getElementById('mainSection').classList.remove('hidden');
  
  // โหลด config
  try {
    const res = await fetch('/admin/info', { headers: { 'Authorization': 'Bearer ' + token } });
    const data = await res.json();
    document.getElementById('apiKeyBox').textContent = data.apiKey;
    if (data.hasQR) {
      document.getElementById('qrTag').innerHTML = '<span class="tag-green">✅ มี QR แล้ว</span>';
      document.getElementById('qrPreview').innerHTML = '<div class="qr-preview"><img src="' + data.qrUrl + '" /></div><div class="info-box">Payload: ' + data.payload + '</div>';
    } else {
      document.getElementById('qrTag').innerHTML = '<span class="tag-red">❌ ยังไม่มี QR</span>';
      document.getElementById('qrPreview').innerHTML = '<p style="color:#64748b;font-size:13px;">ยังไม่ได้อัปโหลด QR</p>';
    }
  } catch(e) {}
  
  loadTxn();
}

async function uploadQR() {
  const file = document.getElementById('qrFile').files[0];
  if (!file) { showMsg('uploadMsg', 'กรุณาเลือกไฟล์ก่อน', 'status err'); return; }
  showMsg('uploadMsg', '⏳ กำลังแกะ QR...', 'status ok');
  
  const reader = new FileReader();
  reader.onload = async (e) => {
    const base64 = e.target.result.split(',')[1];
    try {
      const res = await fetch('/admin/upload-qr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ image: base64, mimeType: file.type })
      });
      const data = await res.json();
      if (data.status === 'ok') {
        showMsg('uploadMsg', '✅ แกะ QR สำเร็จ!', 'status ok');
        setTimeout(() => showMain(), 1500);
      } else {
        showMsg('uploadMsg', '❌ ' + (data.message || 'แกะ QR ไม่สำเร็จ'), 'status err');
      }
    } catch(e) {
      showMsg('uploadMsg', '❌ เกิดข้อผิดพลาด', 'status err');
    }
  };
  reader.readAsDataURL(file);
}

async function loadTxn() {
  try {
    const res = await fetch('/admin/transactions', { headers: { 'Authorization': 'Bearer ' + token } });
    const data = await res.json();
    const el = document.getElementById('txnList');
    if (!data.transactions || data.transactions.length === 0) {
      el.innerHTML = '<p style="color:#64748b;font-size:13px;">ยังไม่มีรายการ</p>'; return;
    }
    el.innerHTML = data.transactions.reverse().slice(0,10).map(t =>
      '<div style="padding:8px;border-bottom:1px solid #334155;font-size:12px;">' +
      '<span style="color:' + (t.status==='success'?'#6ee7b7':t.status==='pending'?'#fbbf24':'#f87171') + '">' +
      (t.status==='success'?'✅':t.status==='pending'?'⏳':'❌') + ' ' + t.status + '</span>' +
      '<span style="color:#94a3b8;margin-left:8px;">' + t.amount + ' บาท</span>' +
      '<span style="color:#475569;margin-left:8px;font-size:10px;">' + t.id + '</span></div>'
    ).join('');
  } catch(e) {}
}

function logout() {
  sessionStorage.removeItem('admin_token');
  token = '';
  document.getElementById('mainSection').classList.add('hidden');
  document.getElementById('loginSection').classList.remove('hidden');
}

// ถ้ามี token อยู่แล้วให้ข้าม login
if (token) showMain();
</script>
</body>
</html>`);
});

// ========== ADMIN LOGIN ==========
app.post('/admin/login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    const token = Buffer.from(Math.random().toString(36) + Date.now()).toString('base64');
    // เก็บ token ใน memory 24 ชม.
    if (!global.adminTokens) global.adminTokens = new Map();
    global.adminTokens.set(token, Date.now() + 86400000);
    return res.json({ status: 'ok', token });
  }
  res.status(401).json({ status: 'error', message: 'รหัสผ่านไม่ถูกต้อง' });
});

function checkAdmin(req, res) {
  if (!global.adminTokens) global.adminTokens = new Map();
  const auth = (req.headers['authorization'] || '').replace('Bearer ', '').trim();
  const expiry = global.adminTokens.get(auth);
  if (!expiry || Date.now() > expiry) {
    res.status(401).json({ status: 'error', message: 'กรุณา login ใหม่' });
    return false;
  }
  return true;
}

// ========== ADMIN INFO ==========
app.get('/admin/info', (req, res) => {
  if (!checkAdmin(req, res)) return;
  const hasQR = !!qrPayloadBase;
  res.json({
    status: 'ok',
    apiKey: API_KEY,
    hasQR,
    payload: hasQR ? qrPayloadBase.substring(0, 60) + '...' : '',
    qrUrl: hasQR ? `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(qrPayloadBase)}&size=200x200` : ''
  });
});

// ========== ADMIN อัปโหลด QR ==========
app.post('/admin/upload-qr', async (req, res) => {
  if (!checkAdmin(req, res)) return;
  const { image, mimeType } = req.body;
  if (!image) return res.status(400).json({ status: 'error', message: 'ไม่พบรูปภาพ' });

  try {
    const imageBuffer = Buffer.from(image, 'base64');
    const FormData = (await import('node:stream')).PassThrough;
    
    // ใช้ multipart form
    const boundary = '----FormBoundary' + Math.random().toString(36);
    const mtype = mimeType || 'image/png';
    const header = Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="qr.png"\r\nContent-Type: ${mtype}\r\n\r\n`
    );
    const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
    const body = Buffer.concat([header, imageBuffer, footer]);

    const response = await fetch('https://api.qrserver.com/v1/read-qr-code/', {
      method: 'POST',
      headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}`, 'Content-Length': body.length.toString() },
      body
    });
    const result = await response.json();
    const payload = result?.[0]?.symbol?.[0]?.data;
    if (!payload) return res.status(400).json({ status: 'error', message: 'แกะ QR ไม่ได้ กรุณาใช้รูปที่ชัดขึ้น' });

    qrPayloadBase = payload;
    console.log('✅ QR Payload ใหม่:', payload.substring(0, 50));
    res.json({ status: 'ok', payload });
  } catch (e) {
    console.error('QR error:', e);
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// ========== ADMIN TRANSACTIONS ==========
app.get('/admin/transactions', (req, res) => {
  if (!checkAdmin(req, res)) return;
  const list = Object.entries(transactions).map(([id, t]) => ({ id, ...t }));
  res.json({ transactions: list });
});

// ========== API: สร้าง QR ==========
app.post('/api/v1/promptpay/generate', async (req, res) => {
  if (!checkApiKey(req, res)) return;
  const { amount } = req.body;
  if (!amount || isNaN(amount) || parseFloat(amount) <= 0)
    return res.status(400).json({ status: 'error', message: 'จำนวนเงินไม่ถูกต้อง', code: 'INVALID_AMOUNT' });
  if (!qrPayloadBase)
    return res.status(503).json({ status: 'error', message: 'ยังไม่ได้ตั้งค่า QR ใน Admin', code: 'QR_NOT_CONFIGURED' });

  const transactionId = 'TXN-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6).toUpperCase();
  const expiresAt = Math.floor(Date.now() / 1000) + QR_EXPIRE_SECONDS;
  const amountFloat = parseFloat(amount);
  const payload = injectAmount(qrPayloadBase, amountFloat);
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(payload)}&size=300x300&ecc=M&format=png`;

  transactions[transactionId] = { amount: amountFloat, status: 'pending', expiresAt, createdAt: Date.now() };
  await sendDiscord(`🆕 QR ใหม่ | ${transactionId} | ยอด: ${amount} บาท`);

  res.json({ status: 'success', data: { transactionId, qr_url: qrUrl, payload, amount: amount.toString(), currency: 'THB', expires_at: expiresAt } });
});

// ========== API: เช็คสถานะ ==========
app.post('/api/v1/promptpay/check', (req, res) => {
  if (!checkApiKey(req, res)) return;
  const { transactionId } = req.body;
  if (!transactionId) return res.status(400).json({ status: 'error', message: 'ต้องระบุ transactionId' });
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

app.post('/api/log', (req, res) => { console.log('📋 Log:', req.body); res.json({ status: 'ok' }); });
app.get('/api/config', (req, res) => { res.json({ status: 'ok', notify_url: '/api/notify', log_url: '/api/log' }); });

// ========== Helper Functions ==========
function checkApiKey(req, res) {
  const key = (req.headers['authorization'] || '').replace('Bearer ', '').trim();
  if (key !== API_KEY) { res.status(401).json({ status: 'error', message: 'API Key ไม่ถูกต้อง', code: 'INVALID_API_KEY' }); return false; }
  return true;
}

function injectAmount(payload, amount) {
  const amountStr = amount.toFixed(2);
  const amountField = '54' + String(amountStr.length).padStart(2, '0') + amountStr;
  let p = payload.replace(/6304[0-9A-Fa-f]{4}$/, '');
  p = p.replace(/54\d{2}[\d.]+/, '');
  const insertAt = p.search(/5802|5902|6002/);
  if (insertAt > 0) p = p.substring(0, insertAt) + amountField + p.substring(insertAt);
  else p += amountField;
  p += '6304';
  return p + crc16(p);
}

function crc16(data) {
  let crc = 0xFFFF;
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) crc = (crc & 0x8000) ? (crc << 1) ^ 0x1021 : crc << 1;
  }
  return ((crc & 0xFFFF).toString(16).toUpperCase()).padStart(4, '0');
}

async function sendDiscord(msg) {
  if (!DISCORD_WEBHOOK_URL) return;
  try { await fetch(DISCORD_WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: msg }) }); } catch(e) {}
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server ทำงานที่ port ${PORT}`));
