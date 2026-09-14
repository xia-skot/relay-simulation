export interface UserAccount {
  email: string;
  password?: string;
  name?: string;
  role?: 'admin' | 'user';
  inviteCodeUsed?: string;
  createdAt?: string;
  lastLoginAt?: string;
}

export type AuthMode = 'login' | 'register' | 'forgot_password';

export interface InviteCode {
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

export interface AdminAccount {
  email: string;
  addedAt: string;
  addedBy?: string;
  isSuperAdmin?: boolean;
}

export interface PaymentConfig {
  price: number;
  wechatQr: string;
  alipayQr: string;
  instruction: string;
  autoIssue: boolean;
}

export interface PurchaseOrder {
  orderId: string;
  amount: number;
  payMethod: 'wechat' | 'alipay';
  inviteCode: string;
  status: 'paid' | 'pending';
  createdAt: string;
  customerContact?: string;
  inviteCodeStatus?: string;
}
