import { UserAccount } from '../types/auth';

const STORAGE_CURRENT_USER_KEY = 'relay_platform_current_user_v1';

// 1. Send verification code via backend
export async function apiSendCode(email: string): Promise<{ success: boolean; message: string; devCode?: string; fallback?: boolean }> {
  try {
    const res = await fetch('/api/auth/send-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    return data;
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
  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (data.success && data.user) {
      setCurrentUser(data.user);
    }
    return data;
  } catch (err: any) {
    return { success: false, message: '注册网络请求失败，请稍后重试' };
  }
}

// 3. Login user via backend & MongoDB
export async function apiLogin(email: string, password: string): Promise<{ success: boolean; message: string; user?: UserAccount }> {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (data.success && data.user) {
      setCurrentUser(data.user);
    }
    return data;
  } catch (err: any) {
    // Graceful fallback to demo credentials if backend API is temporarily offline
    if (email === 'admin@relay.com' && password === 'password123') {
      const demoUser: UserAccount = { email: 'admin@relay.com', name: '示范学员' };
      setCurrentUser(demoUser);
      return { success: true, message: '登录成功', user: demoUser };
    }
    return { success: false, message: '登录网络连接失败' };
  }
}

// 4. Reset password via verification code
export async function apiResetPassword(params: {
  email: string;
  newPassword: string;
  code: string;
}): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    return await res.json();
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
    return await res.json();
  } catch (err: any) {
    return { success: false, message: '获取收款配置失败' };
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
