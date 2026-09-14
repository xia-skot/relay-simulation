import QRCode from 'qrcode';

// Cache generated QR data URLs
let cachedWechatQr = '';
let cachedAlipayQr = '';

/**
 * Generate high-definition WeChat Pay styled QR Code
 */
export async function getWechatQrCodeUrl(price: number = 9.9): Promise<string> {
  if (cachedWechatQr) return cachedWechatQr;
  try {
    const payload = `wxp://f2f0_relay_platform_pay_${price.toFixed(2)}_invite_code`;
    const url = await QRCode.toDataURL(payload, {
      errorCorrectionLevel: 'H',
      margin: 1,
      width: 320,
      color: {
        dark: '#07C160', // WeChat Official Green
        light: '#FFFFFF',
      },
    });
    cachedWechatQr = url;
    return url;
  } catch (err) {
    console.error('Failed to generate WeChat QR code:', err);
    return '';
  }
}

/**
 * Generate high-definition Alipay styled QR Code
 */
export async function getAlipayQrCodeUrl(price: number = 9.9): Promise<string> {
  if (cachedAlipayQr) return cachedAlipayQr;
  try {
    const payload = `https://qr.alipay.com/bax0_relay_platform_pay_${price.toFixed(2)}_invite_code`;
    const url = await QRCode.toDataURL(payload, {
      errorCorrectionLevel: 'H',
      margin: 1,
      width: 320,
      color: {
        dark: '#1677FF', // Alipay Official Blue
        light: '#FFFFFF',
      },
    });
    cachedAlipayQr = url;
    return url;
  } catch (err) {
    console.error('Failed to generate Alipay QR code:', err);
    return '';
  }
}
