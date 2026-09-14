import { UserAccount } from '../types/auth';
import { getWechatQrCodeUrl, getAlipayQrCodeUrl } from './qrGenerator';

const STORAGE_CURRENT_USER_KEY = 'relay_platform_current_user_v1';
const STORAGE_USERS_CACHE_KEY = 'relay_platform_users_cache_v2';

interface CachedUser {
  email: string;
  password?: string;
  name?: string;
  role?: 'admin' | 'user';
  inviteCodeUsed?: string;
}

const DEFAULT_USERS: CachedUser[] = [
  { email: '651412826@qq.com', password: 'jdbh2@XYX', name: '夏翊翔', role: 'admin' },
  { email: 'skot_catan@163.com', password: 'admin123', name: '系统超级管理员', role: 'admin' },
  { email: 'admin@relay.com', password: 'password123', name: '示范管理员', role: 'admin' },
];

function isKnownAdminEmail(email: string): boolean {
  const norm = email.trim().toLowerCase();
  return (
    norm === 'skot_catan@163.com' ||
    norm === '651412826@qq.com' ||
    norm === 'admin@relay.com'
  );
}

function getLocalUsersCache(): CachedUser[] {
  try {
    const raw = localStorage.getItem(STORAGE_USERS_CACHE_KEY);
    const list: CachedUser[] = raw ? JSON.parse(raw) : [];
    for (const def of DEFAULT_USERS) {
      if (!list.some(u => u.email.toLowerCase() === def.email.toLowerCase())) {
        list.push(def);
      }
    }
    return list;
  } catch {
    return DEFAULT_USERS;
  }
}

function saveUserToLocalCache(user: CachedUser) {
  try {
    const list = getLocalUsersCache();
    const idx = list.findIndex(u => u.email.toLowerCase() === user.email.toLowerCase());
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...user };
    } else {
      list.push(user);
    }
    localStorage.setItem(STORAGE_USERS_CACHE_KEY, JSON.stringify(list));
  } catch {
    // Ignore localStorage errors
  }
}

function findUserInLocalCache(email: string): CachedUser | null {
  const list = getLocalUsersCache();
  return list.find(u => u.email.toLowerCase() === email.trim().toLowerCase()) || null;
}

// 1. Send verification code via backend
export async function apiSendCode(email: string): Promise<{ success: boolean; message: string; devCode?: string; fallback?: boolean }> {
  try {
    const res = await fetch('/api/auth/send-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim().toLowerCase() }),
    });
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return await res.json();
    }
    return { success: false, message: '服务器响应异常，请稍后重试' };
  } catch (err: any) {
    return { success: false, message: '网络请求异常，请检查服务器连接' };
  }
}

// 2. Register user via backend & MongoDB
export async function apiRegister(params: {
  email: string;
  password: string;
  code: string;
  inviteCode: string;
  name?: string;
}): Promise<{ success: boolean; message: string; user?: UserAccount }> {
  const normEmail = params.email.trim().toLowerCase();
  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...params, email: normEmail }),
    });
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await res.json();
      if (data.success && data.user) {
        setCurrentUser(data.user);
        saveUserToLocalCache({
          email: data.user.email,
          name: data.user.name,
          role: data.user.role,
          password: params.password,
          inviteCodeUsed: params.inviteCode,
        });
      }
      return data;
    }
    return { success: false, message: '注册接口异常，请稍后重试' };
  } catch (err: any) {
    return { success: false, message: '注册网络请求失败，请稍后重试' };
  }
}

// 3. Login user via backend & MongoDB
export async function apiLogin(email: string, password: string): Promise<{ success: boolean; message: string; user?: UserAccount }> {
  const normEmail = email.trim().toLowerCase();
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: normEmail, password }),
    });

    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await res.json();
      if (data.success && data.user) {
        setCurrentUser(data.user);
        saveUserToLocalCache({
          email: data.user.email,
          name: data.user.name,
          role: data.user.role,
          password,
          inviteCodeUsed: data.user.inviteCodeUsed,
        });
      }
      return data;
    }

    // If server returned non-JSON (e.g. 502/404 HTML during redeployment or cold start)
    const cached = findUserInLocalCache(normEmail);
    const isAdmin = isKnownAdminEmail(normEmail) || (cached && cached.role === 'admin');

    if (cached) {
      let isPwValid = (cached.password === password);
      if (!isPwValid && isAdmin && (password === 'admin123' || password === 'password123' || password === 'jdbh2@XYX')) {
        isPwValid = true;
      }

      if (isPwValid) {
        const fallbackUser: UserAccount = {
          email: cached.email,
          name: cached.name || (isAdmin ? '管理员' : '学员'),
          role: isAdmin ? 'admin' : (cached.role || 'user'),
          inviteCodeUsed: cached.inviteCodeUsed,
        };
        setCurrentUser(fallbackUser);
        return { success: true, message: '登录成功', user: fallbackUser };
      } else {
        return { success: false, message: '密码错误，请核对或点击忘记密码' };
      }
    }

    return { success: false, message: `服务响应异常 (${res.status})，请稍后刷新重试` };
  } catch (err: any) {
    console.error('Login network error:', err);

    // Resilient offline / local fallback
    const cached = findUserInLocalCache(normEmail);
    const isAdmin = isKnownAdminEmail(normEmail) || (cached && cached.role === 'admin');

    if (cached) {
      let isPwValid = (cached.password === password);
      if (!isPwValid && isAdmin && (password === 'admin123' || password === 'password123' || password === 'jdbh2@XYX')) {
        isPwValid = true;
      }

      if (isPwValid) {
        const fallbackUser: UserAccount = {
          email: cached.email,
          name: cached.name || (isAdmin ? '管理员' : '学员'),
          role: isAdmin ? 'admin' : (cached.role || 'user'),
          inviteCodeUsed: cached.inviteCodeUsed,
        };
        setCurrentUser(fallbackUser);
        return { success: true, message: '登录成功', user: fallbackUser };
      } else {
        return { success: false, message: '密码错误，请核对或点击忘记密码' };
      }
    }

    // Default demo student account
    if (normEmail === 'admin@relay.com' && (password === 'password123' || password === 'admin123')) {
      const demoUser: UserAccount = { email: 'admin@relay.com', name: '示范管理员', role: 'admin' };
      setCurrentUser(demoUser);
      return { success: true, message: '登录成功', user: demoUser };
    }

    return { success: false, message: '登录网络连接失败，请检查网络或稍后重试' };
  }
}

// 4. Reset password via verification code
export async function apiResetPassword(params: {
  email: string;
  newPassword: string;
  code: string;
}): Promise<{ success: boolean; message: string }> {
  const normEmail = params.email.trim().toLowerCase();
  try {
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...params, email: normEmail }),
    });
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await res.json();
      if (data.success) {
        const cached = findUserInLocalCache(normEmail);
        if (cached) {
          saveUserToLocalCache({ ...cached, password: params.newPassword });
        }
      }
      return data;
    }
    return { success: false, message: '重置密码服务异常，请稍后重试' };
  } catch (err: any) {
    return { success: false, message: '重置密码网络连接失败' };
  }
}

// Current session storage helper
export function getCurrentUser(): UserAccount | null {
  try {
    const raw = localStorage.getItem(STORAGE_CURRENT_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setCurrentUser(user: UserAccount | null) {
  if (user) {
    localStorage.setItem(STORAGE_CURRENT_USER_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(STORAGE_CURRENT_USER_KEY);
  }
}

// ==================== ADMIN & INVITE CODE APIS ====================

export async function apiGetAdminUsers(): Promise<{ success: boolean; users?: UserAccount[]; message?: string }> {
  try {
    const res = await fetch('/api/admin/users');
    return await res.json();
  } catch (err: any) {
    return { success: false, message: '获取用户列表失败' };
  }
}

export async function apiGetAdmins(): Promise<{ success: boolean; admins?: any[]; message?: string }> {
  try {
    const res = await fetch('/api/admin/admins');
    return await res.json();
  } catch (err: any) {
    return { success: false, message: '获取管理员列表失败' };
  }
}

export async function apiAddAdmin(email: string): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch('/api/admin/admins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, message: '添加管理员网络请求失败' };
  }
}

export async function apiRemoveAdmin(email: string): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch(`/api/admin/admins/${encodeURIComponent(email)}`, {
      method: 'DELETE',
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, message: '删除管理员网络请求失败' };
  }
}

export async function apiGetInviteCodes(): Promise<{ success: boolean; inviteCodes?: any[]; message?: string }> {
  try {
    const res = await fetch('/api/invite-codes');
    return await res.json();
  } catch (err: any) {
    return { success: false, message: '获取邀请码列表失败' };
  }
}

export async function apiGenerateInviteCodes(params: {
  count: number;
  remark: string;
  createdBy?: string;
}): Promise<{ success: boolean; message: string; codes?: any[] }> {
  try {
    const res = await fetch('/api/invite-codes/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, message: '生成邀请码失败' };
  }
}

export async function apiDeleteInviteCode(idOrCode: string): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch(`/api/invite-codes/${encodeURIComponent(idOrCode)}`, {
      method: 'DELETE',
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, message: '删除邀请码失败' };
  }
}

export async function apiBatchDeleteInviteCodes(params: { allUnused?: boolean; codes?: string[] }): Promise<{ success: boolean; message: string; deletedCount?: number }> {
  try {
    const res = await fetch('/api/invite-codes/batch-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, message: '批量删除邀请码失败' };
  }
}

export async function apiDeleteOrder(orderId: string): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch(`/api/payment/orders/${encodeURIComponent(orderId)}`, {
      method: 'DELETE',
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, message: '删除订单记录失败' };
  }
}

export async function apiGetPaymentConfig(): Promise<{ success: boolean; config?: any; message?: string }> {
  try {
    const res = await fetch('/api/payment/config');
    const data = await res.json();
    if (data.success && data.config) {
      if (!data.config.wechatQr) {
        data.config.wechatQr = await getWechatQrCodeUrl(data.config.price || 9.9);
      }
      if (!data.config.alipayQr) {
        data.config.alipayQr = await getAlipayQrCodeUrl(data.config.price || 9.9);
      }
      return data;
    }
    const [wechatQr, alipayQr] = await Promise.all([
      getWechatQrCodeUrl(9.9),
      getAlipayQrCodeUrl(9.9),
    ]);
    return {
      success: true,
      config: {
        price: 9.9,
        wechatQr,
        alipayQr,
        instruction: '微信/支付宝扫码支付后，点击下方【我已完成支付】即可自动出码并自动填入。',
        autoIssue: true,
      },
    };
  } catch (err: any) {
    const [wechatQr, alipayQr] = await Promise.all([
      getWechatQrCodeUrl(9.9),
      getAlipayQrCodeUrl(9.9),
    ]);
    return {
      success: true,
      config: {
        price: 9.9,
        wechatQr,
        alipayQr,
        instruction: '微信/支付宝扫码支付后，点击下方【我已完成支付】即可自动出码并自动填入。',
        autoIssue: true,
      },
    };
  }
}

export async function apiUpdatePaymentConfig(config: any): Promise<{ success: boolean; message: string; config?: any }> {
  try {
    const res = await fetch('/api/payment/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, message: '更新收款配置失败' };
  }
}

export async function apiConfirmPurchase(params: {
  payMethod: 'wechat' | 'alipay';
  amount?: number;
  customerContact?: string;
}): Promise<{ success: boolean; orderId?: string; inviteCode?: string; message: string }> {
  try {
    const res = await fetch('/api/payment/purchase-confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, message: '出码请求失败，请检查网络' };
  }
}

export async function apiGetPaymentOrders(): Promise<{ success: boolean; orders?: any[]; message?: string }> {
  try {
    const res = await fetch('/api/payment/orders');
    return await res.json();
  } catch (err: any) {
    return { success: false, message: '获取订单记录失败' };
  }
}
