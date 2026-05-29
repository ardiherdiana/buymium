import { Resend } from 'resend'

const API_KEY = process.env.RESEND_API_KEY
const FROM_EMAIL = process.env.EMAIL_FROM || 'Buymium <noreply@buymium.id>'
const SITE_URL = process.env.SITE_URL || 'https://buymium.id'

const resend = API_KEY ? new Resend(API_KEY) : null

function fmtRp(n: number): string {
  return 'Rp ' + n.toLocaleString('id-ID')
}

interface SendArgs {
  to: string
  subject: string
  html: string
}

async function send({ to, subject, html }: SendArgs): Promise<void> {
  if (!resend) {
    console.warn('[email] RESEND_API_KEY not set, skipping email to', to)
    return
  }
  try {
    await resend.emails.send({ from: FROM_EMAIL, to, subject, html })
  } catch (err) {
    console.error('[email] failed to send to', to, err)
  }
}

const wrapper = (title: string, body: string, ctaUrl?: string, ctaLabel?: string) => `
<!doctype html>
<html lang="id">
  <body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
            <tr>
              <td style="background:linear-gradient(135deg,#0f172a,#1e40af);padding:24px 28px;color:#fff;">
                <div style="font-size:13px;color:#cbd5e1;letter-spacing:1px;text-transform:uppercase;">Buymium</div>
                <div style="font-size:22px;font-weight:700;margin-top:4px;">${title}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:28px;color:#1f2937;font-size:14px;line-height:1.6;">
                ${body}
                ${ctaUrl && ctaLabel ? `
                <div style="margin-top:24px;text-align:center;">
                  <a href="${ctaUrl}" style="display:inline-block;background:#0f172a;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:14px;">${ctaLabel}</a>
                </div>
                ` : ''}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 28px;background:#f9fafb;border-top:1px solid #e5e7eb;color:#6b7280;font-size:11px;text-align:center;">
                Email otomatis dari Buymium. Mohon jangan reply.<br/>
                <a href="${SITE_URL}/support" style="color:#2563eb;">Hubungi support</a> · <a href="${SITE_URL}" style="color:#2563eb;">buymium.id</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`

export async function sendOrderConfirmed(opts: {
  to: string
  name: string
  groupId: string
  totalPrice: number
  orderId: number
}): Promise<void> {
  const body = `
    <p>Halo <strong>${opts.name}</strong>,</p>
    <p>🎉 Pembayaranmu untuk pesanan <strong>${opts.groupId}</strong> sebesar <strong>${fmtRp(opts.totalPrice)}</strong> telah dikonfirmasi.</p>
    <p>Data akun sekarang sudah bisa didownload. Klik tombol di bawah untuk membuka halaman pesanan, lalu klik "Download Data Akun".</p>
    <p style="background:#fef3c7;border:1px solid #fcd34d;padding:12px;border-radius:8px;margin-top:16px;color:#92400e;font-size:13px;">
      <strong>⚠️ Penting:</strong> Garansi 24 jam berlaku sejak data didownload. Pastikan login & ganti password segera. Setelah password diubah, klaim garansi tidak berlaku.
    </p>
  `
  await send({
    to: opts.to,
    subject: `✓ Pesanan ${opts.groupId} dikonfirmasi — siap download`,
    html: wrapper('Pembayaran Dikonfirmasi', body, `${SITE_URL}/orders/detail/${opts.orderId}`, 'Download Data Akun'),
  })
}

export async function sendOrderRejected(opts: {
  to: string
  name: string
  groupId: string
  reason: string
  orderId: number
}): Promise<void> {
  const body = `
    <p>Halo <strong>${opts.name}</strong>,</p>
    <p>Mohon maaf, bukti pembayaran untuk pesanan <strong>${opts.groupId}</strong> tidak dapat kami verifikasi.</p>
    <p><strong>Alasan:</strong></p>
    <div style="background:#fee2e2;border:1px solid #fecaca;padding:12px;border-radius:8px;color:#7f1d1d;margin:8px 0;">
      ${opts.reason}
    </div>
    <p>Kamu bisa upload ulang bukti yang valid melalui halaman pesanan, atau hubungi support jika kamu yakin sudah transfer dengan benar.</p>
  `
  await send({
    to: opts.to,
    subject: `Bukti transfer ditolak — ${opts.groupId}`,
    html: wrapper('Bukti Transfer Ditolak', body, `${SITE_URL}/orders/detail/${opts.orderId}`, 'Upload Ulang'),
  })
}
