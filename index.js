const express = require('express');
const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ========== CONFIG ==========
const ADMIN_PASSWORD = 'admin1234';
const API_KEY = 'my-secret-api-key';
const DISCORD_WEBHOOK_URL = '';
const QR_EXPIRE_SECONDS = 300;
const SERVER_URL = process.env.SERVER_URL || 'https://payment-server-4ojo.onrender.com';
// ============================

const transactions = {};
let qrPayloadBase = '';
if (!global.adminTokens) global.adminTokens = new Map();

// ========== หน้า ADMIN ==========
app.get('/admin', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Payment Server Admin</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',sans-serif;background:#0f172a;color:#e2e8f0;min-height:100vh}
.sidebar{position:fixed;left:0;top:0;bottom:0;width:220px;background:#1e293b;border-right:1px solid #334155;padding:20px 0;z-index:100}
.sidebar h1{color:#38bdf8;font-size:16px;font-weight:700;padding:0 20px 20px;border-bottom:1px solid #334155;margin-bottom:12px}
.nav-item{display:flex;align-items:center;gap:10px;padding:10px 20px;cursor:pointer;font-size:13px;color:#94a3b8;border-radius:0;transition:.2s}
.nav-item:hover{background:#334155;color:#e2e8f0}
.nav-item.active{background:#1d4ed8;color:white}
.nav-item .icon{font-size:16px;width:20px}
.main{margin-left:220px;padding:24px;max-width:900px}
.page{display:none}.page.active{display:block}
h2{font-size:20px;font-weight:700;color:#f1f5f9;margin-bottom:20px}
.card{background:#1e293b;border-radius:12px;padding:20px;margin-bottom:16px;border:1px solid #334155}
.card h3{font-size:14px;color:#94a3b8;margin-bottom:14px;font-weight:600;text-transform:uppercase;letter-spacing:.5px}
input,select,textarea{width:100%;padding:10px 14px;background:#0f172a;border:1px solid #334155;border-radius:8px;color:#e2e8f0;font-size:14px;margin-bottom:12px;outline:none}
input:focus,textarea:focus{border-color:#38bdf8}
textarea{font-family:monospace;font-size:12px;resize:vertical}
.btn{padding:10px 20px;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;transition:.2s}
.btn-primary{background:#38bdf8;color:#0f172a}.btn-primary:hover{background:#7dd3fc}
.btn-danger{background:#ef4444;color:white}.btn-danger:hover{background:#f87171}
.btn-gray{background:#334155;color:#e2e8f0}.btn-gray:hover{background:#475569}
.btn-green{background:#16a34a;color:white}.btn-green:hover{background:#22c55e}
.btn-full{width:100%}
.tag{display:inline-block;padding:2px 10px;border-radius:20px;font-size:11px;font-weight:600}
.tag-green{background:#064e3b;color:#6ee7b7}
.tag-red{background:#7f1d1d;color:#fca5a5}
.tag-yellow{background:#78350f;color:#fcd34d}
.tag-blue{background:#1e3a5f;color:#93c5fd}
.alert{padding:12px 16px;border-radius:8px;font-size:13px;margin-top:12px}
.alert-ok{background:#064e3b;color:#6ee7b7}
.alert-err{background:#7f1d1d;color:#fca5a5}
.alert-info{background:#1e3a5f;color:#93c5fd}
.code-block{background:#020617;border:1px solid #1e293b;border-radius:8px;padding:16px;font-family:monospace;font-size:12px;color:#94a3b8;overflow-x:auto;white-space:pre;margin-bottom:12px;position:relative}
.copy-btn{position:absolute;top:8px;right:8px;padding:4px 10px;background:#334155;color:#e2e8f0;border:none;border-radius:6px;font-size:11px;cursor:pointer}
.copy-btn:hover{background:#475569}
.tabs{display:flex;gap:4px;margin-bottom:16px;flex-wrap:wrap}
.tab{padding:6px 16px;background:#0f172a;border:1px solid #334155;border-radius:6px;font-size:12px;cursor:pointer;color:#94a3b8}
.tab.active{background:#1d4ed8;border-color:#1d4ed8;color:white}
.tab-content{display:none}.tab-content.active{display:block}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.qr-preview{text-align:center;padding:16px}
.qr-preview img{max-width:180px;border-radius:8px}
.txn-row{padding:10px;border-bottom:1px solid #1e293b;display:flex;align-items:center;gap:12px;font-size:13px}
.txn-row:last-child{border-bottom:none}
.response-box{background:#020617;border:1px solid #1e293b;border-radius:8px;padding:16px;font-family:monospace;font-size:12px;color:#6ee7b7;min-height:80px;white-space:pre-wrap;word-break:break-all}
.divider{height:1px;background:#334155;margin:16px 0}
label{font-size:12px;color:#64748b;display:block;margin-bottom:4px}
.row{display:flex;gap:12px;align-items:flex-end}
.row .flex1{flex:1}
#loginScreen{position:fixed;inset:0;background:#0f172a;display:flex;align-items:center;justify-content:center;z-index:999}
.login-box{background:#1e293b;border:1px solid #334155;border-radius:16px;padding:32px;width:100%;max-width:380px}
.login-box h1{color:#38bdf8;font-size:20px;margin-bottom:24px;text-align:center}
@media(max-width:640px){.sidebar{display:none}.main{margin-left:0}}
</style>
</head>
<body>

<!-- Login Screen -->
<div id="loginScreen">
  <div class="login-box">
    <h1>⚙️ Payment Admin</h1>
    <label>รหัสผ่าน</label>
    <input type="password" id="pwInput" placeholder="ใส่รหัสผ่าน" onkeydown="if(event.key==='Enter')login()" />
    <button class="btn btn-primary btn-full" onclick="login()">เข้าสู่ระบบ</button>
    <div id="loginMsg"></div>
  </div>
</div>

<!-- Sidebar -->
<div class="sidebar" id="sidebar" style="display:none">
  <h1>⚙️ Payment Admin</h1>
  <div class="nav-item active" onclick="showPage('dashboard')"><span class="icon">📊</span> Dashboard</div>
  <div class="nav-item" onclick="showPage('qrsetup')"><span class="icon">📱</span> ตั้งค่า QR</div>
  <div class="nav-item" onclick="showPage('docs')"><span class="icon">📖</span> คู่มือ API</div>
  <div class="nav-item" onclick="showPage('tester')"><span class="icon">🧪</span> ทดสอบ API</div>
  <div class="nav-item" onclick="showPage('transactions')"><span class="icon">📋</span> รายการ</div>
  <div style="position:absolute;bottom:16px;left:0;right:0;padding:0 20px">
    <button class="btn btn-danger btn-full" onclick="logout()">ออกจากระบบ</button>
  </div>
</div>

<!-- Main Content -->
<div class="main" id="mainContent" style="display:none">

  <!-- Dashboard -->
  <div id="page-dashboard" class="page active">
    <h2>📊 Dashboard</h2>
    <div class="grid2">
      <div class="card">
        <h3>สถานะ QR</h3>
        <div id="dashQRStatus" style="font-size:24px;font-weight:700;color:#38bdf8">—</div>
      </div>
      <div class="card">
        <h3>API Key</h3>
        <div style="font-size:12px;color:#94a3b8;word-break:break-all" id="dashApiKey">—</div>
      </div>
    </div>
    <div class="card">
      <h3>Server URL</h3>
      <div style="font-size:13px;color:#38bdf8" id="dashUrl">—</div>
    </div>
    <div class="card">
      <h3>Transaction ล่าสุด</h3>
      <div id="dashTxn"><p style="color:#475569;font-size:13px">ยังไม่มีรายการ</p></div>
    </div>
  </div>

  <!-- QR Setup -->
  <div id="page-qrsetup" class="page">
    <h2>📱 ตั้งค่า QR PromptPay</h2>
    <div class="card">
      <h3>QR ที่ใช้งานอยู่</h3>
      <div id="currentQR"><p style="color:#475569;font-size:13px">ยังไม่ได้อัปโหลด QR</p></div>
    </div>
    <div class="card">
      <h3>อัปโหลด QR ใหม่</h3>
      <p style="font-size:12px;color:#64748b;margin-bottom:14px">อัปโหลดรูป QR PromptPay ของบัญชีที่ต้องการรับเงิน ระบบจะแกะ payload อัตโนมัติ</p>
      <label>เลือกรูป QR (.png, .jpg)</label>
      <input type="file" id="qrFile" accept="image/*" />
      <button class="btn btn-primary btn-full" onclick="uploadQR()">📤 อัปโหลดและแกะ QR</button>
      <div id="uploadMsg"></div>
    </div>
  </div>

  <!-- Docs -->
  <div id="page-docs" class="page">
    <h2>📖 คู่มือ API</h2>

    <div class="card">
      <h3>Base URL</h3>
      <div class="code-block" id="docsBaseUrl">https://your-server.onrender.com<button class="copy-btn" onclick="copyCode(this)">Copy</button></div>
      <h3 style="margin-top:16px">Authentication</h3>
      <p style="font-size:13px;color:#94a3b8;margin-bottom:10px">ทุก request ต้องส่ง API Key ใน Header</p>
      <div class="code-block">Authorization: Bearer YOUR_API_KEY
Content-Type: application/json<button class="copy-btn" onclick="copyCode(this)">Copy</button></div>
    </div>

    <!-- Generate -->
    <div class="card">
      <h3>POST /api/v1/promptpay/generate — สร้าง QR</h3>
      <p style="font-size:12px;color:#64748b;margin-bottom:14px">สร้าง QR Code พร้อมยอดเงิน ได้ transactionId สำหรับเช็คสถานะ</p>
      <div class="tabs" id="genTabs">
        <div class="tab active" onclick="switchTab('gen','php')">PHP</div>
        <div class="tab" onclick="switchTab('gen','node')">Node.js</div>
        <div class="tab" onclick="switchTab('gen','curl')">cURL</div>
        <div class="tab" onclick="switchTab('gen','python')">Python</div>
      </div>
      <div id="gen-php" class="tab-content active">
        <div class="code-block" id="code-gen-php"><button class="copy-btn" onclick="copyCode(this)">Copy</button></div>
      </div>
      <div id="gen-node" class="tab-content">
        <div class="code-block" id="code-gen-node"><button class="copy-btn" onclick="copyCode(this)">Copy</button></div>
      </div>
      <div id="gen-curl" class="tab-content">
        <div class="code-block" id="code-gen-curl"><button class="copy-btn" onclick="copyCode(this)">Copy</button></div>
      </div>
      <div id="gen-python" class="tab-content">
        <div class="code-block" id="code-gen-python"><button class="copy-btn" onclick="copyCode(this)">Copy</button></div>
      </div>
      <div class="divider"></div>
      <h3 style="margin-bottom:10px">Response ตัวอย่าง</h3>
      <div class="code-block">{
  "status": "success",
  "data": {
    "transactionId": "TXN-1234567890-ABC123",
    "qr_url": "https://api.qrserver.com/v1/create-qr-code/?data=...",
    "payload": "00020101021229...",
    "amount": "1000",
    "currency": "THB",
    "expires_at": 1764246956
  }
}</div>
    </div>

    <!-- Check -->
    <div class="card">
      <h3>POST /api/v1/promptpay/check — เช็คสถานะ</h3>
      <p style="font-size:12px;color:#64748b;margin-bottom:14px">เรียกซ้ำทุก 3-5 วินาที เพื่อเช็คว่ามีเงินเข้าไหม</p>
      <div class="tabs" id="chkTabs">
        <div class="tab active" onclick="switchTab('chk','php')">PHP</div>
        <div class="tab" onclick="switchTab('chk','node')">Node.js</div>
        <div class="tab" onclick="switchTab('chk','curl')">cURL</div>
        <div class="tab" onclick="switchTab('chk','python')">Python</div>
      </div>
      <div id="chk-php" class="tab-content active">
        <div class="code-block" id="code-chk-php"><button class="copy-btn" onclick="copyCode(this)">Copy</button></div>
      </div>
      <div id="chk-node" class="tab-content">
        <div class="code-block" id="code-chk-node"><button class="copy-btn" onclick="copyCode(this)">Copy</button></div>
      </div>
      <div id="chk-curl" class="tab-content">
        <div class="code-block" id="code-chk-curl"><button class="copy-btn" onclick="copyCode(this)">Copy</button></div>
      </div>
      <div id="chk-python" class="tab-content">
        <div class="code-block" id="code-chk-python"><button class="copy-btn" onclick="copyCode(this)">Copy</button></div>
      </div>
      <div class="divider"></div>
      <h3 style="margin-bottom:10px">สถานะที่เป็นไปได้</h3>
      <div style="font-size:13px;color:#94a3b8;line-height:2">
        <span class="tag tag-yellow">pending</span> รอการชำระเงิน &nbsp;
        <span class="tag tag-green">success</span> ชำระสำเร็จ &nbsp;
        <span class="tag tag-red">error</span> QR หมดอายุ / ผิดพลาด
      </div>
    </div>

    <!-- Error Codes -->
    <div class="card">
      <h3>Error Codes</h3>
      <table style="width:100%;font-size:12px;border-collapse:collapse">
        <tr style="color:#64748b;border-bottom:1px solid #334155">
          <th style="text-align:left;padding:8px">Code</th>
          <th style="text-align:left;padding:8px">คำอธิบาย</th>
          <th style="text-align:left;padding:8px">HTTP</th>
        </tr>
        <tr style="border-bottom:1px solid #1e293b"><td style="padding:8px;font-family:monospace;color:#fca5a5">INVALID_API_KEY</td><td style="padding:8px;color:#94a3b8">API Key ไม่ถูกต้อง</td><td style="padding:8px;color:#94a3b8">401</td></tr>
        <tr style="border-bottom:1px solid #1e293b"><td style="padding:8px;font-family:monospace;color:#fca5a5">INVALID_AMOUNT</td><td style="padding:8px;color:#94a3b8">จำนวนเงินไม่ถูกต้อง</td><td style="padding:8px;color:#94a3b8">400</td></tr>
        <tr style="border-bottom:1px solid #1e293b"><td style="padding:8px;font-family:monospace;color:#fca5a5">QR_NOT_CONFIGURED</td><td style="padding:8px;color:#94a3b8">ยังไม่ได้ตั้งค่า QR ใน Admin</td><td style="padding:8px;color:#94a3b8">503</td></tr>
        <tr style="border-bottom:1px solid #1e293b"><td style="padding:8px;font-family:monospace;color:#fca5a5">TRANSACTION_NOT_FOUND</td><td style="padding:8px;color:#94a3b8">ไม่พบรายการ</td><td style="padding:8px;color:#94a3b8">404</td></tr>
        <tr><td style="padding:8px;font-family:monospace;color:#fca5a5">TRANSACTION_EXPIRED</td><td style="padding:8px;color:#94a3b8">QR หมดอายุแล้ว</td><td style="padding:8px;color:#94a3b8">400</td></tr>
      </table>
    </div>
  </div>

  <!-- Tester -->
  <div id="page-tester" class="page">
    <h2>🧪 ทดสอบ API</h2>

    <div class="card">
      <h3>ทดสอบ Generate QR</h3>
      <div class="row">
        <div class="flex1">
          <label>จำนวนเงิน (บาท)</label>
          <input type="number" id="testAmount" placeholder="เช่น 100" value="100" />
        </div>
        <div>
          <button class="btn btn-primary" onclick="testGenerate()">▶ สร้าง QR</button>
        </div>
      </div>
      <div id="testGenResult" style="display:none">
        <div class="divider"></div>
        <div class="grid2">
          <div>
            <label>Response</label>
            <div class="response-box" id="testGenResponse"></div>
          </div>
          <div id="testQRPreview" style="display:none">
            <label>QR Code</label>
            <div class="qr-preview"><img id="testQRImg" src="" /></div>
            <button class="btn btn-green btn-full" onclick="startPolling()">▶ เริ่ม Poll เช็คสถานะ</button>
          </div>
        </div>
      </div>
    </div>

    <div class="card" id="pollCard" style="display:none">
      <h3>เช็คสถานะ <span id="pollStatus"></span></h3>
      <div class="response-box" id="pollResponse"></div>
      <div style="margin-top:12px;display:flex;gap:8px">
        <button class="btn btn-gray" onclick="checkOnce()">🔄 เช็คครั้งเดียว</button>
        <button class="btn btn-danger" id="stopPollBtn" onclick="stopPolling()" style="display:none">⏹ หยุด Poll</button>
      </div>
    </div>
  </div>

  <!-- Transactions -->
  <div id="page-transactions" class="page">
    <h2>📋 รายการ Transaction</h2>
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
        <span style="font-size:13px;color:#64748b" id="txnCount">กำลังโหลด...</span>
        <button class="btn btn-gray" onclick="loadAllTxn()">🔄 รีเฟรช</button>
      </div>
      <div id="allTxnList"></div>
    </div>
  </div>

</div>

<script>
let token = sessionStorage.getItem('admin_token') || '';
let currentTxnId = '';
let pollTimer = null;
let serverUrl = '';
let apiKey = '';

function showMsg(id, msg, type) {
  const el = document.getElementById(id);
  if (!el) return;
  el.className = 'alert alert-' + type;
  el.textContent = msg;
}

async function login() {
  const pw = document.getElementById('pwInput').value;
  try {
    const res = await fetch('/admin/login', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({password:pw}) });
    const data = await res.json();
    if (data.status === 'ok') {
      token = data.token;
      sessionStorage.setItem('admin_token', token);
      initApp();
    } else {
      showMsg('loginMsg', '❌ รหัสผ่านไม่ถูกต้อง', 'err');
    }
  } catch(e) { showMsg('loginMsg', '❌ เชื่อมต่อไม่ได้', 'err'); }
}

async function initApp() {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('sidebar').style.display = '';
  document.getElementById('mainContent').style.display = '';

  try {
    const res = await fetch('/admin/info', { headers:{'Authorization':'Bearer '+token} });
    const data = await res.json();
    serverUrl = data.serverUrl;
    apiKey = data.apiKey;

    // Dashboard
    document.getElementById('dashQRStatus').innerHTML = data.hasQR
      ? '<span class="tag tag-green">✅ พร้อมใช้งาน</span>'
      : '<span class="tag tag-red">❌ ยังไม่มี QR</span>';
    document.getElementById('dashApiKey').textContent = data.apiKey;
    document.getElementById('dashUrl').textContent = data.serverUrl;

    // QR Setup
    if (data.hasQR) {
      document.getElementById('currentQR').innerHTML =
        '<div class="qr-preview"><img src="' + data.qrUrl + '" /></div>' +
        '<div style="font-size:11px;color:#475569;word-break:break-all;margin-top:8px">' + data.payload + '</div>';
    }

    // Docs - fill code examples
    fillDocs(data.serverUrl, data.apiKey);

    loadDashTxn();
  } catch(e) { console.error(e); }
}

function fillDocs(url, key) {
  document.getElementById('docsBaseUrl').childNodes[0].textContent = url + '\n';

  const genPhp = \`<?php
$curl = curl_init();
curl_setopt_array($curl, [
  CURLOPT_URL => '\${url}/api/v1/promptpay/generate',
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_CUSTOMREQUEST => 'POST',
  CURLOPT_POSTFIELDS => json_encode(['amount' => 1000]),
  CURLOPT_HTTPHEADER => [
    'Authorization: Bearer \${key}',
    'Content-Type: application/json'
  ],
]);
$response = curl_exec($curl);
curl_close($curl);
$data = json_decode($response, true);
$transactionId = $data['data']['transactionId'];
$qrUrl = $data['data']['qr_url'];\`;

  const genNode = \`import axios from 'axios';

const res = await axios.post(
  '\${url}/api/v1/promptpay/generate',
  { amount: 1000 },
  { headers: { 'Authorization': 'Bearer \${key}' } }
);
const { transactionId, qr_url } = res.data.data;\`;

  const genCurl = \`curl -X POST \${url}/api/v1/promptpay/generate \\\\
  -H "Authorization: Bearer \${key}" \\\\
  -H "Content-Type: application/json" \\\\
  -d '{"amount": 1000}'\`;

  const genPython = \`import requests

res = requests.post(
  '\${url}/api/v1/promptpay/generate',
  json={'amount': 1000},
  headers={'Authorization': 'Bearer \${key}'}
)
data = res.json()
transaction_id = data['data']['transactionId']\`;

  setCode('code-gen-php', genPhp);
  setCode('code-gen-node', genNode);
  setCode('code-gen-curl', genCurl);
  setCode('code-gen-python', genPython);

  const chkPhp = \`<?php
// เรียกซ้ำทุก 3-5 วินาทีจนกว่าจะ success หรือ error
$curl = curl_init();
curl_setopt_array($curl, [
  CURLOPT_URL => '\${url}/api/v1/promptpay/check',
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_CUSTOMREQUEST => 'POST',
  CURLOPT_POSTFIELDS => json_encode(['transactionId' => $transactionId]),
  CURLOPT_HTTPHEADER => [
    'Authorization: Bearer \${key}',
    'Content-Type: application/json'
  ],
]);
$response = curl_exec($curl);
curl_close($curl);
$result = json_decode($response, true);
// $result['status'] => 'pending' | 'success' | 'error'\`;

  const chkNode = \`// เรียกซ้ำทุก 3 วินาที
const checkPayment = async (transactionId) => {
  const res = await axios.post(
    '\${url}/api/v1/promptpay/check',
    { transactionId },
    { headers: { 'Authorization': 'Bearer \${key}' } }
  );
  return res.data; // status: pending | success | error
};

const timer = setInterval(async () => {
  const result = await checkPayment(transactionId);
  if (result.status === 'success') {
    clearInterval(timer);
    console.log('ชำระเงินสำเร็จ!');
  } else if (result.status === 'error') {
    clearInterval(timer);
    console.log('QR หมดอายุ');
  }
}, 3000);\`;

  const chkCurl = \`curl -X POST \${url}/api/v1/promptpay/check \\\\
  -H "Authorization: Bearer \${key}" \\\\
  -H "Content-Type: application/json" \\\\
  -d '{"transactionId": "TXN-xxx"}'\`;

  const chkPython = \`import requests, time

def check_payment(transaction_id):
    res = requests.post(
        '\${url}/api/v1/promptpay/check',
        json={'transactionId': transaction_id},
        headers={'Authorization': 'Bearer \${key}'}
    )
    return res.json()

# Poll ทุก 3 วินาที
while True:
    result = check_payment(transaction_id)
    if result['status'] == 'success':
        print('ชำระสำเร็จ!')
        break
    elif result['status'] == 'error':
        print('QR หมดอายุ')
        break
    time.sleep(3)\`;

  setCode('code-chk-php', chkPhp);
  setCode('code-chk-node', chkNode);
  setCode('code-chk-curl', chkCurl);
  setCode('code-chk-python', chkPython);
}

function setCode(id, code) {
  const el = document.getElementById(id);
  const btn = el.querySelector('.copy-btn');
  el.textContent = code;
  el.appendChild(btn);
}

function copyCode(btn) {
  const block = btn.parentElement;
  const text = block.textContent.replace('Copy','').trim();
  navigator.clipboard.writeText(text);
  btn.textContent = '✅';
  setTimeout(() => btn.textContent = 'Copy', 1500);
}

function switchTab(group, lang) {
  document.querySelectorAll('#' + group + 'Tabs .tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('[id^="' + group + '-"]').forEach(t => t.classList.remove('active'));
  event.target.classList.add('active');
  document.getElementById(group + '-' + lang).classList.add('active');
}

async function testGenerate() {
  const amount = document.getElementById('testAmount').value;
  if (!amount) return;
  try {
    const res = await fetch('/api/v1/promptpay/generate', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: parseFloat(amount) })
    });
    const data = await res.json();
    document.getElementById('testGenResult').style.display = '';
    document.getElementById('testGenResponse').textContent = JSON.stringify(data, null, 2);
    if (data.status === 'success') {
      currentTxnId = data.data.transactionId;
      document.getElementById('testQRImg').src = data.data.qr_url;
      document.getElementById('testQRPreview').style.display = '';
    }
  } catch(e) {
    document.getElementById('testGenResult').style.display = '';
    document.getElementById('testGenResponse').textContent = 'Error: ' + e.message;
  }
}

async function checkOnce() {
  if (!currentTxnId) return;
  const res = await fetch('/api/v1/promptpay/check', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ transactionId: currentTxnId })
  });
  const data = await res.json();
  document.getElementById('pollResponse').textContent = JSON.stringify(data, null, 2);
  updatePollStatus(data.status);
  return data.status;
}

function startPolling() {
  document.getElementById('pollCard').style.display = '';
  document.getElementById('stopPollBtn').style.display = '';
  pollTimer = setInterval(async () => {
    const status = await checkOnce();
    if (status === 'success' || status === 'error') stopPolling();
  }, 3000);
}

function stopPolling() {
  clearInterval(pollTimer);
  pollTimer = null;
  document.getElementById('stopPollBtn').style.display = 'none';
}

function updatePollStatus(status) {
  const el = document.getElementById('pollStatus');
  if (status === 'success') el.innerHTML = '<span class="tag tag-green">✅ สำเร็จ</span>';
  else if (status === 'error') el.innerHTML = '<span class="tag tag-red">❌ หมดอายุ</span>';
  else el.innerHTML = '<span class="tag tag-yellow">⏳ รอชำระ</span>';
}

async function loadDashTxn() {
  const res = await fetch('/admin/transactions', { headers:{'Authorization':'Bearer '+token} });
  const data = await res.json();
  const list = (data.transactions || []).reverse().slice(0,5);
  const el = document.getElementById('dashTxn');
  if (!list.length) { el.innerHTML = '<p style="color:#475569;font-size:13px">ยังไม่มีรายการ</p>'; return; }
  el.innerHTML = list.map(t => renderTxnRow(t)).join('');
}

async function loadAllTxn() {
  const res = await fetch('/admin/transactions', { headers:{'Authorization':'Bearer '+token} });
  const data = await res.json();
  const list = (data.transactions || []).reverse();
  document.getElementById('txnCount').textContent = 'ทั้งหมด ' + list.length + ' รายการ';
  const el = document.getElementById('allTxnList');
  if (!list.length) { el.innerHTML = '<p style="color:#475569;font-size:13px">ยังไม่มีรายการ</p>'; return; }
  el.innerHTML = list.map(t => renderTxnRow(t)).join('');
}

function renderTxnRow(t) {
  const color = t.status==='success'?'#6ee7b7':t.status==='pending'?'#fcd34d':'#f87171';
  const icon = t.status==='success'?'✅':t.status==='pending'?'⏳':'❌';
  return '<div class="txn-row">' +
    '<span style="font-size:16px">' + icon + '</span>' +
    '<span style="color:#e2e8f0;flex:1;font-size:13px">' + t.id + '</span>' +
    '<span style="color:#38bdf8;font-weight:600">' + t.amount + ' ฿</span>' +
    '<span style="color:' + color + ';font-size:12px">' + t.status + '</span>' +
    '</div>';
}

async function uploadQR() {
  const file = document.getElementById('qrFile').files[0];
  if (!file) { showMsg('uploadMsg','กรุณาเลือกไฟล์','err'); return; }
  showMsg('uploadMsg','⏳ กำลังแกะ QR...','info');
  const reader = new FileReader();
  reader.onload = async (e) => {
    const base64 = e.target.result.split(',')[1];
    try {
      const res = await fetch('/admin/upload-qr', {
        method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},
        body: JSON.stringify({image:base64, mimeType:file.type})
      });
      const data = await res.json();
      if (data.status==='ok') { showMsg('uploadMsg','✅ แกะ QR สำเร็จ!','ok'); setTimeout(()=>initApp(),1500); }
      else showMsg('uploadMsg','❌ '+(data.message||'ไม่สำเร็จ'),'err');
    } catch(e) { showMsg('uploadMsg','❌ เกิดข้อผิดพลาด','err'); }
  };
  reader.readAsDataURL(file);
}

function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('page-'+name).classList.add('active');
  event.currentTarget.classList.add('active');
  if (name === 'transactions') loadAllTxn();
}

function logout() {
  sessionStorage.removeItem('admin_token');
  location.reload();
}

if (token) initApp();
</script>
</body>
</html>`);
});

// ========== ADMIN APIs ==========
app.post('/admin/login', (req, res) => {
  if (req.body.password === ADMIN_PASSWORD) {
    const token = Buffer.from(Math.random().toString(36) + Date.now()).toString('base64');
    global.adminTokens.set(token, Date.now() + 86400000);
    return res.json({ status: 'ok', token });
  }
  res.status(401).json({ status: 'error', message: 'รหัสผ่านไม่ถูกต้อง' });
});

function checkAdmin(req, res) {
  const auth = (req.headers['authorization'] || '').replace('Bearer ', '').trim();
  const expiry = global.adminTokens.get(auth);
  if (!expiry || Date.now() > expiry) { res.status(401).json({ status: 'error' }); return false; }
  return true;
}

app.get('/admin/info', (req, res) => {
  if (!checkAdmin(req, res)) return;
  const hasQR = !!qrPayloadBase;
  res.json({
    status: 'ok', apiKey: API_KEY, serverUrl: SERVER_URL, hasQR,
    payload: hasQR ? qrPayloadBase : '',
    qrUrl: hasQR ? \`https://api.qrserver.com/v1/create-qr-code/?data=\${encodeURIComponent(qrPayloadBase)}&size=200x200\` : ''
  });
});

app.post('/admin/upload-qr', async (req, res) => {
  if (!checkAdmin(req, res)) return;
  const { image, mimeType } = req.body;
  if (!image) return res.status(400).json({ status: 'error', message: 'ไม่พบรูปภาพ' });
  try {
    const imageBuffer = Buffer.from(image, 'base64');
    const boundary = '----FormBoundary' + Math.random().toString(36);
    const mtype = mimeType || 'image/png';
    const header = Buffer.from(\`--\${boundary}\r\nContent-Disposition: form-data; name="file"; filename="qr.png"\r\nContent-Type: \${mtype}\r\n\r\n\`);
    const footer = Buffer.from(\`\r\n--\${boundary}--\r\n\`);
    const body = Buffer.concat([header, imageBuffer, footer]);
    const response = await fetch('https://api.qrserver.com/v1/read-qr-code/', {
      method: 'POST',
      headers: { 'Content-Type': \`multipart/form-data; boundary=\${boundary}\`, 'Content-Length': body.length.toString() },
      body
    });
    const result = await response.json();
    const payload = result?.[0]?.symbol?.[0]?.data;
    if (!payload) return res.status(400).json({ status: 'error', message: 'แกะ QR ไม่ได้ กรุณาใช้รูปที่ชัดขึ้น' });
    qrPayloadBase = payload;
    res.json({ status: 'ok', payload });
  } catch (e) { res.status(500).json({ status: 'error', message: e.message }); }
});

app.get('/admin/transactions', (req, res) => {
  if (!checkAdmin(req, res)) return;
  res.json({ transactions: Object.entries(transactions).map(([id, t]) => ({ id, ...t })) });
});

// ========== PUBLIC APIs ==========
function checkApiKey(req, res) {
  const key = (req.headers['authorization'] || '').replace('Bearer ', '').trim();
  if (key !== API_KEY) { res.status(401).json({ status: 'error', message: 'API Key ไม่ถูกต้อง', code: 'INVALID_API_KEY' }); return false; }
  return true;
}

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
  const qrUrl = \`https://api.qrserver.com/v1/create-qr-code/?data=\${encodeURIComponent(payload)}&size=300x300&ecc=M&format=png\`;
  transactions[transactionId] = { amount: amountFloat, status: 'pending', expiresAt, createdAt: Date.now() };
  await sendDiscord(\`🆕 QR ใหม่ | \${transactionId} | ยอด: \${amount} บาท\`);
  res.json({ status: 'success', data: { transactionId, qr_url: qrUrl, payload, amount: amount.toString(), currency: 'THB', expires_at: expiresAt } });
});

app.post('/api/v1/promptpay/check', (req, res) => {
  if (!checkApiKey(req, res)) return;
  const { transactionId } = req.body;
  if (!transactionId) return res.status(400).json({ status: 'error', message: 'ต้องระบุ transactionId', code: 'MISSING_TRANSACTION_ID' });
  const txn = transactions[transactionId];
  if (!txn) return res.status(404).json({ status: 'error', message: 'ไม่พบรายการ', code: 'TRANSACTION_NOT_FOUND' });
  const now = Math.floor(Date.now() / 1000);
  if (txn.status === 'pending' && now > txn.expiresAt) txn.status = 'error';
  if (txn.status === 'success') return res.json({ status: 'success', message: 'ชำระเงินสำเร็จ', transactionId, amount: txn.amount.toString(), currency: 'THB' });
  if (txn.status === 'error') return res.json({ status: 'error', message: 'QR หมดอายุ', code: 'TRANSACTION_EXPIRED' });
  res.json({ status: 'pending', message: 'รอการชำระเงิน', transactionId, amount: txn.amount.toString(), currency: 'THB', expires_at: txn.expiresAt, time_remaining: txn.expiresAt - now });
});

app.post('/api/notify', async (req, res) => {
  const { amount, appName } = req.body;
  console.log('📱 Notification:', req.body);
  if (amount) {
    const amountNum = parseFloat(amount);
    for (const [txnId, txn] of Object.entries(transactions)) {
      if (txn.status === 'pending' && Math.abs(txn.amount - amountNum) < 0.01) {
        txn.status = 'success';
        await sendDiscord(\`✅ เงินเข้า! | \${txnId} | ยอด: \${amount} บาท\`);
        break;
      }
    }
  }
  res.json({ status: 'ok' });
});

app.post('/api/log', (req, res) => { console.log('📋 Log:', req.body); res.json({ status: 'ok' }); });
app.get('/api/config', (req, res) => { res.json({ status: 'ok', notify_url: '/api/notify', log_url: '/api/log' }); });

function injectAmount(payload, amount) {
  const amountStr = amount.toFixed(2);
  const amountField = '54' + String(amountStr.length).padStart(2, '0') + amountStr;
  let p = payload.replace(/6304[0-9A-Fa-f]{4}$/, '').replace(/54\d{2}[\d.]+/, '');
  const insertAt = p.search(/5802|5902|6002/);
  if (insertAt > 0) p = p.substring(0, insertAt) + amountField + p.substring(insertAt);
  else p += amountField;
  p += '6304';
  return p + crc16(p);
}

function crc16(data) {
  let crc = 0xFFFF;
  for (let i = 0; i < data.length; i++) { crc ^= data.charCodeAt(i) << 8; for (let j = 0; j < 8; j++) crc = (crc & 0x8000) ? (crc << 1) ^ 0x1021 : crc << 1; }
  return ((crc & 0xFFFF).toString(16).toUpperCase()).padStart(4, '0');
}

async function sendDiscord(msg) {
  if (!DISCORD_WEBHOOK_URL) return;
  try { await fetch(DISCORD_WEBHOOK_URL, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({content:msg}) }); } catch(e) {}
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(\`✅ Server ทำงานที่ port \${PORT}\`));
