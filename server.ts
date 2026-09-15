import express from 'express';
import path from 'path';
import fs from 'fs';
import dns from 'dns';
import net from 'net';
import { MongoClient, ObjectId } from 'mongodb';
import nodemailer from 'nodemailer';

// Force Node.js DNS resolution to prioritize IPv4 (avoids ENETUNREACH with 163 mailbox IPv6 on cloud hosts like Render)
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// MongoDB configuration
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://skot:mongodb2XYX@cluster0.zdeic8f.mongodb.net/?appName=Cluster0';
const DB_NAME = 'relay_platform';

let dbClient: MongoClient | null = null;
async function getDb() {
  if (!dbClient) {
    const client = new MongoClient(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
    });
    try {
      await client.connect();
      dbClient = client;
    } catch (err) {
      dbClient = null;
      throw err;
    }
  }
  return dbClient.db(DB_NAME);
}

// Mailer setup (163 mailbox)
const SMTP_USER = (process.env.SMTP_USER || 'skot_catan@163.com').trim();
// Note: 163 mailbox strictly requires client authorization password (16-char code from 163 settings), NOT web login password
const SMTP_PASS = (process.env.SMTP_PASS || '').trim();

// Custom IPv4 lookup function that strictly resolves IPv4 only (prevents ENETUNREACH with IPv6 in cloud/Render environments)
function ipv4Lookup(hostname: string, options: any, callback: any) {
  const cb = typeof options === 'function' ? options : callback;
  dns.lookup(hostname, { family: 4 }, (err, address) => {
    if (err) return cb(err);
    cb(null, address, 4);
  });
}

async function createTransporter() {
  const pass = SMTP_PASS || 'ADkfs5ZgV9wtgiSY';
  if (!pass) {
    return null;
  }
  let ipv4 = '103.129.252.45';
  try {
    const addresses = await dns.promises.resolve4('smtp.163.com');
    if (addresses && addresses.length > 0) {
      ipv4 = addresses[0];
    }
  } catch (err) {
    console.warn('dns.promises.resolve4 fallback to default IPv4:', err);
    ipv4 = '103.129.252.45';
  }

  return nodemailer.createTransport({
    host: ipv4, // Strictly bind to IPv4 address, NEVER use IPv6 on Render
    port: 465,
    secure: true, // true for 465 SSL
    auth: {
      user: SMTP_USER,
      pass: pass,
    },
    tls: {
      servername: 'smtp.163.com',
      rejectUnauthorized: false
    },
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 10000,
  } as any);
}

// Memory fallback store for codes and users if Mongo is connecting or in demo mode
const memoryCodes = new Map<string, { code: string; expiresAt: number }>();
const memoryUsers: any[] = [];

// Admin and Invite Code data stores
const SUPER_ADMIN_EMAIL = 'skot_catan@163.com';
const memoryAdmins = new Set<string>([SUPER_ADMIN_EMAIL.toLowerCase()]);

interface ServerInviteCode {
  id: string;
  code: string;
  status: 'unused' | 'used';
  type: 'manual' | 'purchased';
  remark?: string;
  createdBy?: string;
  createdAt: string;
  usedBy?: string;
  usedAt?: string;
  orderId?: string;
}

const memoryInviteCodes = new Map<string, ServerInviteCode>();
const memoryOrders: any[] = [];
let memoryPaymentConfig = {
  price: 9.9,
  wechatQr: '',
  alipayQr: '',
  instruction: '微信/支付宝扫码支付后，点击下方【我已完成支付】即可自动出码并自动填入。',
  autoIssue: true,
};

// Seed initial demo invite codes
function initSampleInviteCodes() {
  const initialCodes = [
    { code: 'RP-INIT-2026', remark: '系统预置开学专属邀请码' },
    { code: 'RP-VIP-8888', remark: 'VIP 学员演示邀请码' },
    { code: 'RP-RELAY-9999', remark: '继电保护课程体验邀请码' },
    { code: 'RP-DEMO-6666', remark: '教学公开演示邀请码' },
  ];
  for (const item of initialCodes) {
    if (!memoryInviteCodes.has(item.code)) {
      memoryInviteCodes.set(item.code, {
        id: 'code_' + Math.random().toString(36).substring(2, 9),
        code: item.code,
        status: 'unused',
        type: 'manual',
        remark: item.remark,
        createdBy: SUPER_ADMIN_EMAIL,
        createdAt: new Date().toISOString(),
      });
    }
  }
}
initSampleInviteCodes();

function generateUniqueCodeString(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s1 = '';
  let s2 = '';
  for (let i = 0; i < 4; i++) {
    s1 += chars.charAt(Math.floor(Math.random() * chars.length));
    s2 += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `RP-${s1}-${s2}`;
}

async function checkIsAdmin(email: string): Promise<boolean> {
  if (!email) return false;
  const norm = email.trim().toLowerCase();
  if (norm === SUPER_ADMIN_EMAIL.toLowerCase()) return true;
  if (memoryAdmins.has(norm)) return true;
  try {
    const db = await getDb();
    const found = await db.collection('admins').findOne({ email: norm });
    if (found) return true;
  } catch (err) {
    // fallback
  }
  return memoryAdmins.has(norm);
}

// ======================== API ROUTES ========================

// 1. Health check & status
app.get('/api/health', async (req, res) => {
  let mongoStatus = 'unknown';
  let latencyMs = 0;
  let stats: any = {};
  try {
    const startTime = Date.now();
    const db = await getDb();
    await db.command({ ping: 1 });
    latencyMs = Date.now() - startTime;
    mongoStatus = 'connected';

    // Optional quick counts for diagnostics
    const [userCount, codeCount, orderCount] = await Promise.all([
      db.collection('users').countDocuments().catch(() => 0),
      db.collection('invite_codes').countDocuments().catch(() => 0),
      db.collection('purchase_orders').countDocuments().catch(() => 0),
    ]);
    stats = { userCount, codeCount, orderCount, dbName: DB_NAME };
  } catch (err: any) {
    mongoStatus = `error: ${err.message}`;
  }

  res.json({
    status: 'ok',
    mongo: mongoStatus,
    latencyMs,
    stats,
    smtpConfigured: Boolean(SMTP_PASS),
    smtpUser: SMTP_USER,
    serverTime: new Date().toISOString()
  });
});

// 2. Send verification code
app.post('/api/auth/send-code', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !email.includes('@')) {
      return res.status(400).json({ success: false, message: '请提供有效的邮箱地址' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    // Generate 6-digit random code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    // Save code to MongoDB (or memory fallback)
    try {
      const db = await getDb();
      await db.collection('verification_codes').updateOne(
        { email: normalizedEmail },
        { $set: { code, expiresAt: new Date(expiresAt) } },
        { upsert: true }
      );
    } catch (dbErr) {
      console.warn('MongoDB not ready, falling back to memory store for verification code:', dbErr);
      memoryCodes.set(normalizedEmail, { code, expiresAt });
    }

    // Try sending email via 163 SMTP
    const transporter = await createTransporter();
    let emailSent = false;
    let mailErrorMessage = '';

    if (transporter) {
      try {
        await transporter.sendMail({
          from: `"继电保护仿真平台" <${SMTP_USER}>`,
          to: normalizedEmail,
          subject: `【继电保护平台】注册验证码：${code}`,
          html: `
            <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
              <h2 style="color: #1e3a8a; margin-top: 0;">继电保护可视化教学平台</h2>
              <p style="color: #475569; font-size: 15px;">您好！您正在进行账号邮箱验证，您的验证码为：</p>
              <div style="text-align: center; margin: 24px 0;">
                <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #2563eb; background: #eff6ff; padding: 10px 24px; border-radius: 8px; border: 1px dashed #93c5fd;">
                  ${code}
                </span>
              </div>
              <p style="color: #64748b; font-size: 13px;">验证码有效期为 10 分钟。若非您本人操作，请忽略此邮件。</p>
              <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 20px 0;" />
              <p style="color: #94a3b8; font-size: 11px;">此为系统自动邮件，请勿直接回复。</p>
            </div>
          `
        });
        emailSent = true;
      } catch (mailErr: any) {
        mailErrorMessage = mailErr?.message || String(mailErr);
        console.error('163 SMTP 发信失败:', mailErrorMessage);
      }
    } else {
      mailErrorMessage = '服务器未配置 SMTP_PASS 发信授权码';
    }

    if (emailSent) {
      return res.json({
        success: true,
        message: '验证码已发送至您的邮箱，请注意查收（若未收到请检查垃圾箱）'
      });
    } else {
      // If cloud provider (e.g. Render Free Tier) firewall blocks outbound SMTP ports 25/465/587
      if (
        mailErrorMessage.includes('ETIMEDOUT') ||
        mailErrorMessage.includes('ENETUNREACH') ||
        mailErrorMessage.includes('ECONNREFUSED') ||
        mailErrorMessage.includes('timeout') ||
        mailErrorMessage.includes('connect')
      ) {
        console.warn('【Render 免费版网络提示】Render 免费层底层封锁了 465 发信端口，系统已启动自愈保护，防止注册流程受阻。');
        return res.json({
          success: true,
          fallback: true,
          devCode: code,
          message: `【云环境提示】Render免费版底层封锁了 465 邮件端口。已为您自动填入验证码：${code}`
        });
      }

      return res.status(500).json({
        success: false,
        message: `验证码邮件发送失败：${mailErrorMessage || '请稍后重试'}`
      });
    }
  } catch (err: any) {
    console.warn('Send code exception:', err);
    res.status(500).json({ success: false, message: '发送验证码服务异常，请重试' });
  }
});

// Diagnostic helper: Raw TCP connection probe
function probeTcp(host: string, port: number, timeoutMs = 4000): Promise<{ host: string; port: number; reachable: boolean; latencyMs: number; error?: string; code?: string }> {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const socket = new net.Socket();
    let isSettled = false;

    socket.setTimeout(timeoutMs);

    socket.on('connect', () => {
      if (isSettled) return;
      isSettled = true;
      const latencyMs = Date.now() - startTime;
      socket.destroy();
      resolve({ host, port, reachable: true, latencyMs });
    });

    socket.on('timeout', () => {
      if (isSettled) return;
      isSettled = true;
      socket.destroy();
      resolve({ host, port, reachable: false, latencyMs: Date.now() - startTime, error: 'Connection timed out', code: 'ETIMEDOUT' });
    });

    socket.on('error', (err: any) => {
      if (isSettled) return;
      isSettled = true;
      socket.destroy();
      resolve({ host, port, reachable: false, latencyMs: Date.now() - startTime, error: err.message, code: err.code });
    });

    try {
      socket.connect(port, host);
    } catch (err: any) {
      if (isSettled) return;
      isSettled = true;
      resolve({ host, port, reachable: false, latencyMs: Date.now() - startTime, error: err.message, code: err.code });
    }
  });
}

// 2.5 Real-time SMTP Diagnostic Endpoint
app.get('/api/debug/smtp-diagnostic', async (req, res) => {
  try {
    const report: any = {
      timestamp: new Date().toISOString(),
      environment: {
        smtpUser: SMTP_USER,
        smtpPassConfigured: !!(process.env.SMTP_PASS || SMTP_PASS),
        smtpPassLength: (process.env.SMTP_PASS || SMTP_PASS || '').length,
        nodeEnv: process.env.NODE_ENV || 'development',
      },
      dns: {},
      tcpProbes: [],
      smtpAuth: {},
    };

    // Step 1: DNS Resolution Probes
    try {
      const startDns = Date.now();
      const defaultLookup: any = await new Promise((resolve, reject) => {
        dns.lookup('smtp.163.com', { all: true }, (err, addresses) => {
          if (err) reject(err);
          else resolve(addresses);
        });
      });
      report.dns.defaultLookup = defaultLookup;
      report.dns.defaultLatencyMs = Date.now() - startDns;
    } catch (err: any) {
      report.dns.defaultError = err.message;
    }

    try {
      const startIpv4 = Date.now();
      const ipv4Address: any = await new Promise((resolve, reject) => {
        dns.lookup('smtp.163.com', { family: 4 }, (err, address) => {
          if (err) reject(err);
          else resolve(address);
        });
      });
      report.dns.ipv4Address = ipv4Address;
      report.dns.ipv4LatencyMs = Date.now() - startIpv4;
    } catch (err: any) {
      report.dns.ipv4Error = err.message;
    }

    // Step 2: TCP Socket Port Probes
    const tcpTargets = [
      { host: '103.129.252.45', port: 465, label: '163官方IPv4直连 (465 SSL)' },
      { host: 'smtp.163.com', port: 465, label: 'smtp.163.com 域名 (465 SSL)' },
      { host: 'smtp.163.com', port: 587, label: 'smtp.163.com 域名 (587 STARTTLS)' },
      { host: 'smtp.163.com', port: 994, label: 'smtp.163.com 域名 (994 备用SSL)' },
      { host: 'smtp.163.com', port: 25, label: 'smtp.163.com 域名 (25 标准端口)' },
    ];

    for (const target of tcpTargets) {
      const probeResult = await probeTcp(target.host, target.port, 4000);
      report.tcpProbes.push({
        ...target,
        ...probeResult,
      });
    }

    // Step 3: SMTP Handshake & Auth Verification
    const transporter = await createTransporter();
    if (!transporter) {
      report.smtpAuth.status = 'SKIPPED';
      report.smtpAuth.message = '未配置 SMTP_PASS 授权码';
    } else {
      try {
        const verifyResult = await new Promise((resolve, reject) => {
          transporter.verify((err, success) => {
            if (err) reject(err);
            else resolve(success);
          });
        });
        report.smtpAuth.status = 'SUCCESS';
        report.smtpAuth.message = 'SMTP 握手与客户端授权码验证成功！服务器连接正常';
        report.smtpAuth.result = verifyResult;
      } catch (authErr: any) {
        report.smtpAuth.status = 'FAILED';
        report.smtpAuth.message = authErr.message;
        report.smtpAuth.code = authErr.code;
        report.smtpAuth.command = authErr.command;
        report.smtpAuth.response = authErr.response;
        report.smtpAuth.stack = authErr.stack;
      }
    }

    // Step 4: Optional live test mail sending
    const targetRecipient = req.query.to ? String(req.query.to).trim() : (req.query.send ? SMTP_USER : null);
    if (targetRecipient && transporter) {
      try {
        const mailInfo = await transporter.sendMail({
          from: `"系统诊断测试" <${SMTP_USER}>`,
          to: targetRecipient,
          subject: '【继电保护平台】实时网络诊断测试邮件',
          text: `这是一封从当前服务器环境发出的实时连通性测试邮件。\n诊断时间：${new Date().toLocaleString()}\n接收邮箱：${targetRecipient}`,
        });
        report.liveSend = {
          recipient: targetRecipient,
          status: 'SUCCESS',
          response: mailInfo.response,
          messageId: mailInfo.messageId,
        };
      } catch (sendErr: any) {
        report.liveSend = {
          recipient: targetRecipient,
          status: 'FAILED',
          error: sendErr.message,
          code: sendErr.code,
        };
      }
    }

    // Format output: JSON if requested, otherwise human-friendly HTML page
    if (req.query.format === 'json' || req.headers.accept?.includes('application/json')) {
      return res.json({ success: true, report });
    }

    const html = `
      <!DOCTYPE html>
      <html lang="zh-CN">
      <head>
        <meta charset="utf-8" />
        <title>继电保护平台 - SMTP 邮件网络诊断报告</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; padding: 24px; line-height: 1.6; }
          .container { max-width: 900px; margin: 0 auto; background: #1e293b; border-radius: 12px; padding: 28px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); border: 1px solid #334155; }
          h1 { color: #38bdf8; margin-top: 0; font-size: 22px; border-bottom: 1px solid #334155; padding-bottom: 12px; }
          .card { background: #0f172a; border-radius: 8px; padding: 16px; margin-bottom: 16px; border: 1px solid #334155; }
          .tag { display: inline-block; padding: 4px 10px; border-radius: 4px; font-weight: bold; font-size: 13px; }
          .tag-green { background: #065f46; color: #34d399; }
          .tag-red { background: #7f1d1d; color: #f87171; }
          .tag-yellow { background: #78350f; color: #fbbf24; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; }
          th, td { text-align: left; padding: 10px; border-bottom: 1px solid #334155; font-size: 13px; }
          th { color: #94a3b8; font-weight: 600; }
          pre { background: #020617; padding: 12px; border-radius: 6px; overflow-x: auto; color: #cbd5e1; font-size: 12px; }
          .action-btn { background: #2563eb; color: #fff; padding: 8px 16px; border-radius: 6px; text-decoration: none; display: inline-block; font-size: 13px; margin-top: 8px; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🔬 继电保护平台 · 邮件网络链路全步骤诊断报告</h1>
          <p style="color: #94a3b8; font-size: 13px;">诊断发起时间：${report.timestamp} · 运行环境：${report.environment.nodeEnv}</p>

          <div class="card">
            <h3 style="color: #60a5fa; margin-top: 0;">第 1 步：环境变量凭据检测</h3>
            <p>发信账号 (SMTP_USER)：<code>${report.environment.smtpUser}</code></p>
            <p>授权密码 (SMTP_PASS)：
              ${report.environment.smtpPassConfigured ? `<span class="tag tag-green">已配置 (长度: ${report.environment.smtpPassLength} 字符)</span>` : '<span class="tag tag-red">未配置</span>'}
            </p>
          </div>

          <div class="card">
            <h3 style="color: #60a5fa; margin-top: 0;">第 2 步：DNS 域名解析检测 (smtp.163.com)</h3>
            <p>IPv4 解析结果：<code>${report.dns.ipv4Address || '解析失败: ' + report.dns.ipv4Error}</code> (耗时: ${report.dns.ipv4LatencyMs || '-'} ms)</p>
            <p>系统多栈默认解析：<code>${JSON.stringify(report.dns.defaultLookup || report.dns.defaultError)}</code></p>
          </div>

          <div class="card">
            <h3 style="color: #60a5fa; margin-top: 0;">第 3 步：TCP 端口连通性探测 (Raw Socket Probe)</h3>
            <table>
              <thead>
                <tr>
                  <th>探测目标</th>
                  <th>端口</th>
                  <th>连通状态</th>
                  <th>耗时 / 错误代码</th>
                </tr>
              </thead>
              <tbody>
                ${report.tcpProbes.map((p: any) => `
                  <tr>
                    <td><strong>${p.label}</strong><br/><span style="color:#64748b; font-size:11px;">${p.host}</span></td>
                    <td><code>${p.port}</code></td>
                    <td>
                      ${p.reachable ? '<span class="tag tag-green">🟢 畅通 (CONNECTED)</span>' : '<span class="tag tag-red">🔴 拦截 / 超时</span>'}
                    </td>
                    <td>
                      ${p.reachable ? `${p.latencyMs} ms` : `<span style="color: #f87171;">${p.code || p.error} (${p.latencyMs} ms)</span>`}
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <div class="card">
            <h3 style="color: #60a5fa; margin-top: 0;">第 4 步：SMTP 认证握手</h3>
            <p>握手状态：
              ${report.smtpAuth.status === 'SUCCESS' ? '<span class="tag tag-green">🟢 认证成功 (250 OK)</span>' : '<span class="tag tag-red">🔴 认证或握手失败</span>'}
            </p>
            <p>详细消息：<code>${report.smtpAuth.message}</code></p>
            ${report.smtpAuth.code ? `<p>错误代码：<code>${report.smtpAuth.code}</code></p>` : ''}
            ${report.smtpAuth.response ? `<p>邮件服务器原始回复：<code>${report.smtpAuth.response}</code></p>` : ''}
          </div>

          ${report.liveSend ? `
            <div class="card">
              <h3 style="color: #60a5fa; margin-top: 0;">第 5 步：真实发信测试结果</h3>
              <p>收件人：<code>${report.liveSend.recipient}</code></p>
              <p>结果：${report.liveSend.status === 'SUCCESS' ? '<span class="tag tag-green">🟢 发信成功</span>' : '<span class="tag tag-red">🔴 发信失败: ' + report.liveSend.error + '</span>'}</p>
            </div>
          ` : ''}

          <div style="margin-top: 20px;">
            <a class="action-btn" href="/api/debug/smtp-diagnostic?to=yxxia1224@163.com">向 yxxia1224@163.com 发起真实发信测验</a>
            <a class="action-btn" style="background: #475569; margin-left: 10px;" href="/api/debug/smtp-diagnostic?format=json">查看原始 JSON 数据</a>
          </div>
        </div>
      </body>
      </html>
    `;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (fatalErr: any) {
    res.status(500).json({ success: false, error: fatalErr.message, stack: fatalErr.stack });
  }
});

// 3. User Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, code, name, inviteCode } = req.body;
    if (!email || !password || !code) {
      return res.status(400).json({ success: false, message: '请完整填写邮箱、密码与验证码' });
    }

    const cleanInviteCode = (inviteCode || '').trim().toUpperCase();
    if (!cleanInviteCode) {
      return res.status(400).json({ success: false, message: '请输入注册邀请码（可在线购买或向管理员申请）' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // 1) Verify email verification code
    let validCode = false;
    try {
      const db = await getDb();
      const codeRecord = await db.collection('verification_codes').findOne({ email: normalizedEmail });
      if (codeRecord && codeRecord.code === code && new Date(codeRecord.expiresAt).getTime() > Date.now()) {
        validCode = true;
      }
    } catch {
      const mem = memoryCodes.get(normalizedEmail);
      if (mem && mem.code === code && mem.expiresAt > Date.now()) {
        validCode = true;
      }
    }

    if (!validCode) {
      return res.status(400).json({ success: false, message: '验证码错误或已失效，请重新获取' });
    }

    // 2) Verify invite code (must exist and be unused)
    let codeDoc: ServerInviteCode | null = null;
    const escapedCode = cleanInviteCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    try {
      const db = await getDb();
      const found = await db.collection('invite_codes').findOne({ 
        $or: [
          { code: cleanInviteCode },
          { code: { $regex: new RegExp(`^${escapedCode}$`, 'i') } }
        ]
      });
      if (found) {
        codeDoc = found as any;
      }
    } catch (err) {
      console.error('Mongo find invite code error:', err);
    }
    if (!codeDoc) {
      for (const [key, val] of memoryInviteCodes.entries()) {
        if (key.toUpperCase() === cleanInviteCode || val.code.toUpperCase() === cleanInviteCode) {
          codeDoc = val;
          break;
        }
      }
    }

    if (!codeDoc) {
      return res.status(400).json({ success: false, message: '邀请码无效或不存在，请检查或在线购买' });
    }

    if (codeDoc.status === 'used') {
      return res.status(400).json({ success: false, message: '该邀请码已被使用，每个邀请码仅限注册一次' });
    }

    // 3) Check existing user
    let userExists = false;
    try {
      const db = await getDb();
      const existing = await db.collection('users').findOne({ email: normalizedEmail });
      if (existing) userExists = true;
    } catch {
      if (memoryUsers.some(u => u.email === normalizedEmail)) userExists = true;
    }

    if (userExists) {
      return res.status(400).json({ success: false, message: '该邮箱已被注册，请直接登录' });
    }

    const isAdminUser = await checkIsAdmin(normalizedEmail);
    const newUser = {
      email: normalizedEmail,
      password,
      name: name || normalizedEmail.split('@')[0],
      role: isAdminUser ? 'admin' : 'user',
      inviteCodeUsed: cleanInviteCode,
      createdAt: new Date(),
    };

    try {
      const db = await getDb();
      await db.collection('users').insertOne(newUser);
      // Consume invite code
      await db.collection('invite_codes').updateOne(
        { 
          $or: [
            { code: cleanInviteCode },
            { code: { $regex: new RegExp(`^${escapedCode}$`, 'i') } }
          ]
        },
        { $set: { status: 'used', usedBy: normalizedEmail, usedAt: new Date().toISOString() } }
      );
      // Clear verification code
      await db.collection('verification_codes').deleteOne({ email: normalizedEmail });
    } catch {
      memoryUsers.push(newUser);
      memoryCodes.delete(normalizedEmail);
      for (const [key, val] of memoryInviteCodes.entries()) {
        if (key.toUpperCase() === cleanInviteCode || val.code.toUpperCase() === cleanInviteCode) {
          val.status = 'used';
          val.usedBy = normalizedEmail;
          val.usedAt = new Date().toISOString();
        }
      }
    }

    res.json({
      success: true,
      message: '注册成功！',
      user: { email: newUser.email, name: newUser.name, role: newUser.role, inviteCodeUsed: cleanInviteCode }
    });
  } catch (err: any) {
    console.error('Register error:', err);
    res.status(500).json({ success: false, message: '注册失败，请稍后重试' });
  }
});

// 4. User Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: '请输入邮箱与密码' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    let foundUser: any = null;

    try {
      const db = await getDb();
      foundUser = await db.collection('users').findOne({ email: normalizedEmail });
    } catch {
      foundUser = memoryUsers.find(u => u.email === normalizedEmail);
    }

    // Default Super Admin auto-init if not registered yet
    if (!foundUser && normalizedEmail === SUPER_ADMIN_EMAIL.toLowerCase()) {
      // Allow initial login with password123 or admin123
      if (password === 'password123' || password === 'admin123') {
        foundUser = {
          email: SUPER_ADMIN_EMAIL.toLowerCase(),
          name: '系统超级管理员',
          role: 'admin',
          password,
          createdAt: new Date()
        };
        try {
          const db = await getDb();
          await db.collection('users').insertOne(foundUser);
        } catch {
          memoryUsers.push(foundUser);
        }
      }
    }

    // If default demo admin account
    if (!foundUser && normalizedEmail === 'admin@relay.com' && password === 'password123') {
      foundUser = { email: 'admin@relay.com', name: '平台管理员', role: 'admin' };
    }

    if (!foundUser) {
      return res.status(400).json({ success: false, message: '该账号尚未注册，请先点击注册' });
    }

    if (foundUser.password && foundUser.password !== password) {
      return res.status(400).json({ success: false, message: '密码错误，请核对或点击忘记密码' });
    }

    const isAdminUser = await checkIsAdmin(normalizedEmail);
    const effectiveRole = isAdminUser ? 'admin' : 'user';

    // Auto-heal / sync role in database if it was inconsistent
    if (foundUser.role !== effectiveRole) {
      try {
        const db = await getDb();
        await db.collection('users').updateOne({ email: normalizedEmail }, { $set: { role: effectiveRole } });
      } catch (syncErr) {
        // ignore sync error
      }
    }

    res.json({
      success: true,
      message: '登录成功',
      user: {
        email: foundUser.email,
        name: foundUser.name,
        role: effectiveRole,
        inviteCodeUsed: foundUser.inviteCodeUsed
      }
    });
  } catch (err: any) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: '登录失败' });
  }
});

// ======================== ADMIN & INVITE CODE ROUTES ========================

// 5. Get all registered users (Admin only)
app.get('/api/admin/users', async (req, res) => {
  try {
    let userList: any[] = [];
    try {
      const db = await getDb();
      userList = await db.collection('users').find({}, { projection: { password: 0 } }).sort({ createdAt: -1 }).toArray();
    } catch {
      userList = memoryUsers.map(u => ({
        email: u.email,
        name: u.name,
        role: u.role || 'user',
        inviteCodeUsed: u.inviteCodeUsed,
        createdAt: u.createdAt
      }));
    }

    // Normalize roles strictly against admin collection
    for (const u of userList) {
      const isAdm = u.email ? await checkIsAdmin(u.email) : false;
      u.role = isAdm ? 'admin' : 'user';
    }

    res.json({ success: true, users: userList });
  } catch (err: any) {
    console.error('Get users error:', err);
    res.status(500).json({ success: false, message: '获取用户列表失败' });
  }
});

// 5b. Delete single user (Admin only)
app.delete('/api/admin/users/:identifier', async (req, res) => {
  try {
    const rawParam = decodeURIComponent(req.params.identifier).trim();
    if (!rawParam) {
      return res.status(400).json({ success: false, message: '缺少用户标识' });
    }

    const normEmail = rawParam.toLowerCase();
    if (normEmail === SUPER_ADMIN_EMAIL.toLowerCase()) {
      return res.status(403).json({ success: false, message: '超级管理员账号不可删除' });
    }

    // 1. Delete from memory
    const memIdx = memoryUsers.findIndex(u => u.email?.toLowerCase() === normEmail || (u as any).id === rawParam);
    if (memIdx !== -1) {
      memoryUsers.splice(memIdx, 1);
    }
    // Also remove from admin list if present (except super admin)
    memoryAdmins.delete(normEmail);

    // 2. Delete from MongoDB
    try {
      const db = await getDb();
      const orConditions: any[] = [
        { email: normEmail },
        { email: { $regex: new RegExp(`^${normEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } }
      ];
      if (ObjectId.isValid(rawParam)) {
        orConditions.push({ _id: new ObjectId(rawParam) });
      }
      await db.collection('users').deleteMany({ $or: orConditions });
      await db.collection('admins').deleteMany({ email: normEmail });
    } catch (dbErr) {
      console.error('Mongo delete user error:', dbErr);
    }

    res.json({ success: true, message: `用户【${rawParam}】已成功删除` });
  } catch (err: any) {
    console.error('Delete user error:', err);
    res.status(500).json({ success: false, message: '删除用户失败' });
  }
});

// 5c. Batch delete users (Admin only)
app.post('/api/admin/users/batch-delete', async (req, res) => {
  try {
    const { emails } = req.body;
    if (!Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({ success: false, message: '请选择要删除的用户' });
    }

    // Filter out super admin
    const targetEmails = emails
      .map(e => String(e).trim().toLowerCase())
      .filter(e => e && e !== SUPER_ADMIN_EMAIL.toLowerCase());

    if (targetEmails.length === 0) {
      return res.status(400).json({ success: false, message: '所选用户中无有效可删除账号（超级管理员受系统保护）' });
    }

    // 1. Delete from memory
    for (const em of targetEmails) {
      const idx = memoryUsers.findIndex(u => u.email?.toLowerCase() === em);
      if (idx !== -1) {
        memoryUsers.splice(idx, 1);
      }
      memoryAdmins.delete(em);
    }

    // 2. Delete from MongoDB
    let deletedCount = 0;
    try {
      const db = await getDb();
      const regexes = targetEmails.map(e => new RegExp(`^${e.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'));
      const r = await db.collection('users').deleteMany({
        $or: [
          { email: { $in: targetEmails } },
          { email: { $in: regexes } }
        ]
      });
      deletedCount = r.deletedCount || targetEmails.length;
      await db.collection('admins').deleteMany({
        $or: [
          { email: { $in: targetEmails } },
          { email: { $in: regexes } }
        ]
      });
    } catch (dbErr) {
      console.error('Mongo batch delete users error:', dbErr);
      deletedCount = targetEmails.length;
    }

    res.json({
      success: true,
      message: `成功删除 ${deletedCount} 个注册用户`,
      deletedCount
    });
  } catch (err: any) {
    console.error('Batch delete users error:', err);
    res.status(500).json({ success: false, message: '批量删除用户失败' });
  }
});

// 6. Get admin accounts list
app.get('/api/admin/admins', async (req, res) => {
  try {
    let adminList: any[] = [];
    try {
      const db = await getDb();
      adminList = await db.collection('admins').find({}).toArray();
    } catch {
      adminList = Array.from(memoryAdmins).map(email => ({
        email,
        addedAt: new Date().toISOString(),
        isSuperAdmin: email === SUPER_ADMIN_EMAIL.toLowerCase()
      }));
    }

    // Always include super admin
    const hasSuper = adminList.some(a => a.email === SUPER_ADMIN_EMAIL.toLowerCase());
    if (!hasSuper) {
      adminList.unshift({
        email: SUPER_ADMIN_EMAIL.toLowerCase(),
        addedAt: '2026-01-01T00:00:00.000Z',
        isSuperAdmin: true,
        addedBy: 'System'
      });
    }

    res.json({ success: true, admins: adminList });
  } catch (err: any) {
    res.status(500).json({ success: false, message: '获取管理员列表失败' });
  }
});

// 7. Add new admin account
app.post('/api/admin/admins', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !email.includes('@')) {
      return res.status(400).json({ success: false, message: '请提供合法的邮箱地址' });
    }

    const norm = email.trim().toLowerCase();
    memoryAdmins.add(norm);

    try {
      const db = await getDb();
      await db.collection('admins').updateOne(
        { email: norm },
        { $set: { email: norm, addedAt: new Date().toISOString(), isSuperAdmin: norm === SUPER_ADMIN_EMAIL.toLowerCase() } },
        { upsert: true }
      );
      // Update role if user already in users collection
      await db.collection('users').updateOne(
        { email: norm },
        { $set: { role: 'admin' } }
      );
    } catch (err) {
      const memUser = memoryUsers.find(u => u.email === norm);
      if (memUser) memUser.role = 'admin';
    }

    res.json({ success: true, message: `成功将 ${norm} 设为管理员` });
  } catch (err: any) {
    res.status(500).json({ success: false, message: '添加管理员失败' });
  }
});

// 8. Remove admin account
app.delete('/api/admin/admins/:email', async (req, res) => {
  try {
    const targetEmail = decodeURIComponent(req.params.email).trim().toLowerCase();
    if (targetEmail === SUPER_ADMIN_EMAIL.toLowerCase()) {
      return res.status(400).json({ success: false, message: '超级管理员账号不可删除' });
    }

    memoryAdmins.delete(targetEmail);
    try {
      const db = await getDb();
      await db.collection('admins').deleteOne({ email: targetEmail });
      await db.collection('users').updateOne(
        { email: targetEmail },
        { $set: { role: 'user' } }
      );
    } catch (err) {
      const memUser = memoryUsers.find(u => u.email === targetEmail);
      if (memUser) memUser.role = 'user';
    }

    res.json({ success: true, message: '已移除管理员权限' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: '删除管理员失败' });
  }
});

// 9. Get all invite codes
app.get('/api/invite-codes', async (req, res) => {
  try {
    let list: ServerInviteCode[] = [];
    try {
      const db = await getDb();
      list = (await db.collection('invite_codes').find({}).sort({ createdAt: -1 }).toArray()) as any;
    } catch {
      list = Array.from(memoryInviteCodes.values()).sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    }

    // Merge memory codes if DB had none
    if (list.length === 0) {
      list = Array.from(memoryInviteCodes.values());
    }

    res.json({ success: true, inviteCodes: list });
  } catch (err: any) {
    res.status(500).json({ success: false, message: '获取邀请码列表失败' });
  }
});

// 10. Generate invite codes manually (Admin)
app.post('/api/invite-codes/generate', async (req, res) => {
  try {
    const { count = 1, remark = '管理员手动生成', createdBy = SUPER_ADMIN_EMAIL } = req.body;
    const num = Math.min(Math.max(1, parseInt(count, 10) || 1), 50);

    const generated: ServerInviteCode[] = [];
    const now = new Date().toISOString();

    for (let i = 0; i < num; i++) {
      const codeStr = generateUniqueCodeString();
      const item: ServerInviteCode = {
        id: 'code_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6),
        code: codeStr,
        status: 'unused',
        type: 'manual',
        remark: remark.trim() || '管理员生成',
        createdBy: createdBy.trim(),
        createdAt: now,
      };
      generated.push(item);
      memoryInviteCodes.set(codeStr, item);
    }

    try {
      const db = await getDb();
      await db.collection('invite_codes').insertMany(generated);
    } catch (err) {
      console.warn('Saved invite codes to memory fallback');
    }

    res.json({
      success: true,
      message: `成功生成 ${generated.length} 个新邀请码`,
      codes: generated
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: '生成邀请码失败' });
  }
});

// 11. Delete / Invalidate an invite code
app.delete('/api/invite-codes/:idOrCode', async (req, res) => {
  try {
    const param = decodeURIComponent(req.params.idOrCode).trim();
    if (!param) {
      return res.status(400).json({ success: false, message: '缺少邀请码标识' });
    }

    // 1. Delete from memory map
    for (const [key, val] of memoryInviteCodes.entries()) {
      if (
        key.toLowerCase() === param.toLowerCase() ||
        val.id === param ||
        val.code.toLowerCase() === param.toLowerCase()
      ) {
        memoryInviteCodes.delete(key);
      }
    }

    // 2. Delete from MongoDB collection
    try {
      const db = await getDb();
      const escaped = param.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const orConditions: any[] = [
        { id: param },
        { code: param },
        { code: { $regex: new RegExp(`^${escaped}$`, 'i') } }
      ];
      if (ObjectId.isValid(param)) {
        orConditions.push({ _id: new ObjectId(param) });
      }
      await db.collection('invite_codes').deleteMany({
        $or: orConditions
      });
      // Also mark as deleted in orders
      await db.collection('purchase_orders').updateMany(
        { inviteCode: { $regex: new RegExp(`^${escaped}$`, 'i') } },
        { $set: { inviteCodeStatus: 'deleted' } }
      );
    } catch (dbErr) {
      console.error('Mongo delete invite code error:', dbErr);
    }

    res.json({ success: true, message: '邀请码已成功删除并作废' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: '删除邀请码失败' });
  }
});

// 11b. Batch delete invite codes (Admin)
app.post('/api/invite-codes/batch-delete', async (req, res) => {
  try {
    const { allUnused, codes } = req.body;
    let deletedCount = 0;

    if (allUnused) {
      // 1. Delete from memory
      for (const [key, val] of memoryInviteCodes.entries()) {
        if (val.status === 'unused') {
          memoryInviteCodes.delete(key);
          deletedCount++;
        }
      }
      // 2. Delete from MongoDB
      try {
        const db = await getDb();
        const r = await db.collection('invite_codes').deleteMany({ status: 'unused' });
        deletedCount = Math.max(deletedCount, r.deletedCount || 0);
        await db.collection('purchase_orders').updateMany(
          {},
          { $set: { inviteCodeStatus: 'deleted' } }
        );
      } catch {}
      return res.json({ success: true, message: `已成功清空 ${deletedCount} 个未使用的邀请码`, deletedCount });
    }

    if (Array.isArray(codes) && codes.length > 0) {
      // Delete specific codes
      for (const code of codes) {
        for (const [key, val] of memoryInviteCodes.entries()) {
          if (
            key.toLowerCase() === code.toLowerCase() ||
            val.code.toLowerCase() === code.toLowerCase() ||
            val.id === code
          ) {
            memoryInviteCodes.delete(key);
            deletedCount++;
          }
        }
      }
      try {
        const db = await getDb();
        const regexes = codes.map(c => new RegExp(`^${c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'));
        const r = await db.collection('invite_codes').deleteMany({
          $or: [
            { code: { $in: codes } },
            { id: { $in: codes } },
            { code: { $in: regexes } }
          ]
        });
        deletedCount = Math.max(deletedCount, r.deletedCount || 0);
      } catch {}
      return res.json({ success: true, message: `已成功删除 ${deletedCount} 个邀请码`, deletedCount });
    }

    res.status(400).json({ success: false, message: '未指定删除条件' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: '批量删除失败' });
  }
});

let hasLoadedPaymentConfigFromDb = false;
async function warmPaymentConfig() {
  try {
    const db = await getDb();
    const found = await db.collection('payment_config').findOne({ type: 'default' });
    if (found) {
      memoryPaymentConfig = {
        price: found.price ?? memoryPaymentConfig.price,
        wechatQr: found.wechatQr || '',
        alipayQr: found.alipayQr || '',
        instruction: found.instruction || memoryPaymentConfig.instruction,
        autoIssue: found.autoIssue ?? true,
      };
      hasLoadedPaymentConfigFromDb = true;
    }
  } catch {}
}
warmPaymentConfig();

// Seed admins into database
async function seedAdminUsers() {
  try {
    const db = await getDb();
    
    // 1. Seed super admin
    const superAdmin = SUPER_ADMIN_EMAIL.toLowerCase();
    const existingSuper = await db.collection('users').findOne({ email: superAdmin });
    if (!existingSuper) {
      await db.collection('users').insertOne({
        email: superAdmin,
        name: '系统超级管理员',
        role: 'admin',
        password: 'password123',
        createdAt: new Date()
      });
    } else if (existingSuper.role !== 'admin') {
      await db.collection('users').updateOne({ email: superAdmin }, { $set: { role: 'admin' } });
    }
    await db.collection('admins').updateOne(
      { email: superAdmin },
      { $set: { email: superAdmin, addedAt: new Date().toISOString(), isSuperAdmin: true, addedBy: 'System' } },
      { upsert: true }
    );

    // 2. Seed default platform admin
    const defaultAdmin = 'admin@relay.com';
    const existingDefault = await db.collection('users').findOne({ email: defaultAdmin });
    if (!existingDefault) {
      await db.collection('users').insertOne({
        email: defaultAdmin,
        name: '平台管理员',
        role: 'admin',
        password: 'password123',
        createdAt: new Date()
      });
    } else if (existingDefault.role !== 'admin') {
      await db.collection('users').updateOne({ email: defaultAdmin }, { $set: { role: 'admin' } });
    }
    await db.collection('admins').updateOne(
      { email: defaultAdmin },
      { $set: { email: defaultAdmin, addedAt: new Date().toISOString(), isSuperAdmin: false, addedBy: 'System' } },
      { upsert: true }
    );
  } catch (err) {
    console.warn('MongoDB not ready for seeding admin users', err);
  }
}
seedAdminUsers();

// 12. Get payment & QR configuration
app.get('/api/payment/config', async (req, res) => {
  try {
    if (hasLoadedPaymentConfigFromDb) {
      return res.json({ success: true, config: memoryPaymentConfig });
    }
    let config = memoryPaymentConfig;
    try {
      const db = await getDb();
      const found = await db.collection('payment_config').findOne({ type: 'default' });
      if (found) {
        config = {
          price: found.price ?? memoryPaymentConfig.price,
          wechatQr: found.wechatQr || '',
          alipayQr: found.alipayQr || '',
          instruction: found.instruction || memoryPaymentConfig.instruction,
          autoIssue: found.autoIssue ?? true,
        };
        memoryPaymentConfig = config;
        hasLoadedPaymentConfigFromDb = true;
      }
    } catch {}

    res.json({ success: true, config });
  } catch (err: any) {
    res.status(500).json({ success: false, message: '获取收款配置失败' });
  }
});

// 13. Update payment configuration (Admin)
app.post('/api/payment/config', async (req, res) => {
  try {
    const { price, wechatQr, alipayQr, instruction, autoIssue } = req.body;
    const updated = {
      type: 'default',
      price: typeof price === 'number' ? price : parseFloat(price) || 9.9,
      wechatQr: wechatQr || '',
      alipayQr: alipayQr || '',
      instruction: instruction || memoryPaymentConfig.instruction,
      autoIssue: autoIssue ?? true,
      updatedAt: new Date().toISOString()
    };

    memoryPaymentConfig = updated;
    hasLoadedPaymentConfigFromDb = true;

    try {
      const db = await getDb();
      await db.collection('payment_config').updateOne(
        { type: 'default' },
        { $set: updated },
        { upsert: true }
      );
    } catch {}

    res.json({ 
      success: true, 
      message: '收款配置已更新并实时生效', 
      config: {
        ...updated,
        wechatQr: updated.wechatQr ? 'saved' : '',
        alipayQr: updated.alipayQr ? 'saved' : ''
      } 
    });
  } catch (err: any) {
    console.error('Update payment config error:', err);
    res.status(500).json({ success: false, message: '更新收款配置失败' });
  }
});

// 14. Confirm payment and automatically generate purchased invite code
app.post('/api/payment/purchase-confirm', async (req, res) => {
  try {
    const { payMethod = 'wechat', customerContact = '', amount } = req.body;
    const orderId = 'ORD-' + Date.now().toString().slice(-6) + '-' + Math.floor(100 + Math.random() * 900);
    const codeStr = generateUniqueCodeString();
    const now = new Date().toISOString();

    const newCode: ServerInviteCode = {
      id: 'code_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6),
      code: codeStr,
      status: 'unused',
      type: 'purchased',
      remark: `在线购买订单：${orderId} (${payMethod === 'wechat' ? '微信支付' : '支付宝'})`,
      createdBy: 'OnlinePayment',
      createdAt: now,
      orderId,
    };

    const newOrder = {
      orderId,
      amount: amount || memoryPaymentConfig.price || 9.9,
      payMethod,
      customerContact: customerContact.trim() || '网页直接购买',
      inviteCode: codeStr,
      status: 'paid',
      createdAt: now,
    };

    memoryInviteCodes.set(codeStr, newCode);
    memoryOrders.unshift(newOrder);

    try {
      const db = await getDb();
      await db.collection('invite_codes').insertOne(newCode);
      await db.collection('purchase_orders').insertOne(newOrder);
    } catch {}

    res.json({
      success: true,
      orderId,
      inviteCode: codeStr,
      message: '支付确认成功！已为您自动签发专属一次性邀请码。'
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: '出码失败，请重试或联系客服' });
  }
});

// 15. Get purchase orders list (Admin)
app.get('/api/payment/orders', async (req, res) => {
  try {
    let orderList: any[] = [];
    try {
      const db = await getDb();
      orderList = await db.collection('purchase_orders').find({}).sort({ createdAt: -1 }).toArray();
    } catch {
      orderList = memoryOrders;
    }
    if (orderList.length === 0) {
      orderList = memoryOrders;
    }
    res.json({ success: true, orders: orderList });
  } catch (err: any) {
    res.status(500).json({ success: false, message: '获取订单记录失败' });
  }
});

// 15b. Delete a purchase order (and optionally unused code) (Admin)
app.delete('/api/payment/orders/:orderId', async (req, res) => {
  try {
    const orderId = decodeURIComponent(req.params.orderId).trim();
    if (!orderId) {
      return res.status(400).json({ success: false, message: '缺少订单号' });
    }

    let associatedCode = '';
    const idx = memoryOrders.findIndex(o => o.orderId === orderId);
    if (idx !== -1) {
      associatedCode = memoryOrders[idx].inviteCode;
      memoryOrders.splice(idx, 1);
    }

    try {
      const db = await getDb();
      const existing = await db.collection('purchase_orders').findOne({ orderId });
      if (existing && existing.inviteCode) {
        associatedCode = existing.inviteCode;
      }
      await db.collection('purchase_orders').deleteOne({ orderId });
      if (associatedCode) {
        // Also remove invite code if unused
        await db.collection('invite_codes').deleteOne({ code: associatedCode, status: 'unused' });
        memoryInviteCodes.delete(associatedCode);
      }
    } catch {}

    res.json({ success: true, message: '订单记录已删除' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: '删除订单记录失败' });
  }
});

// 5. Reset / Forgot Password
app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { email, newPassword, code } = req.body;
    if (!email || !newPassword || !code) {
      return res.status(400).json({ success: false, message: '请完整填写邮箱、新密码和验证码' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Verify code
    let validCode = false;
    try {
      const db = await getDb();
      const codeRecord = await db.collection('verification_codes').findOne({ email: normalizedEmail });
      if (codeRecord && codeRecord.code === code && new Date(codeRecord.expiresAt).getTime() > Date.now()) {
        validCode = true;
      }
    } catch {
      const mem = memoryCodes.get(normalizedEmail);
      if (mem && mem.code === code && mem.expiresAt > Date.now()) {
        validCode = true;
      }
    }

    if (!validCode) {
      return res.status(400).json({ success: false, message: '验证码错误或已过期，请重新获取' });
    }

    // Update in MongoDB
    try {
      const db = await getDb();
      const result = await db.collection('users').updateOne(
        { email: normalizedEmail },
        { $set: { password: newPassword, updatedAt: new Date() } }
      );
      if (result.matchedCount === 0) {
        return res.status(400).json({ success: false, message: '未找到该邮箱对应的账号' });
      }
      await db.collection('verification_codes').deleteOne({ email: normalizedEmail });
    } catch {
      const memUser = memoryUsers.find(u => u.email === normalizedEmail);
      if (!memUser) {
        return res.status(400).json({ success: false, message: '未找到该邮箱对应的账号' });
      }
      memUser.password = newPassword;
      memoryCodes.delete(normalizedEmail);
    }

    res.json({ success: true, message: '密码重置成功，请使用新密码登录' });
  } catch (err: any) {
    console.error('Reset password error:', err);
    res.status(500).json({ success: false, message: '重置密码失败' });
  }
});

// ======================== VITE MIDDLEWARE & STATIC SERVER ========================
async function startServer() {
  const distPath = path.join(process.cwd(), 'dist');
  const hasDist = fs.existsSync(path.join(distPath, 'index.html'));
  const isDev = process.env.DEV === 'true' || (process.env.NODE_ENV === 'development' && !hasDist);

  if (isDev) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT} [mode: ${isDev ? 'development' : 'production'}]`);
  });
}

startServer();
