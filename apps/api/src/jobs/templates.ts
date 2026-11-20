import type { Notification } from './notifications.js';

const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );

const STATUS_TEXT: Record<string, string> = {
  accepted: 'has been accepted by your technician',
  rejected: 'was declined by the technician. Please choose another technician',
  en_route: 'is on the way: your technician has started travelling',
  in_progress: 'is in progress',
  completed: 'is complete. Please rate your technician and pay',
  cancelled: 'was cancelled',
};

function layout(title: string, body: string, cta?: { label: string; url: string }) {
  return `<!doctype html><html><body style="margin:0;background:#f4f5f7;font-family:Segoe UI,Arial,sans-serif;color:#1f2933">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px">
  <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;padding:32px">
    <tr><td style="font-size:20px;font-weight:700;color:#0f766e">TechFinder</td></tr>
    <tr><td style="padding-top:16px;font-size:18px;font-weight:600">${esc(title)}</td></tr>
    <tr><td style="padding-top:12px;font-size:15px;line-height:1.6">${body}</td></tr>
    ${cta ? `<tr><td style="padding-top:24px"><a href="${esc(cta.url)}" style="background:#0f766e;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">${esc(cta.label)}</a></td></tr>` : ''}
  </table></td></tr></table></body></html>`;
}

export function render(n: Notification): { subject: string; html: string; text: string } {
  switch (n.type) {
    case 'welcome':
      return {
        subject: 'Welcome to TechFinder',
        html: layout(
          `Welcome, ${n.name}!`,
          'Your account is ready. Find trusted technicians near you in minutes.',
        ),
        text: `Welcome, ${n.name}! Your TechFinder account is ready.`,
      };
    case 'password_reset':
      return {
        subject: 'Reset your TechFinder password',
        html: layout(
          'Reset your password',
          `Hi ${esc(n.name)}, we received a request to reset your password. This link expires in 30 minutes. If you didn't ask for this, you can ignore this email.`,
          { label: 'Reset password', url: n.resetUrl },
        ),
        text: `Reset your password (expires in 30 minutes): ${n.resetUrl}`,
      };
    case 'booking_requested':
      return {
        subject: `New job request: ${n.service}`,
        html: layout(
          'You have a new job request',
          `Hi ${esc(n.technicianName)}, ${esc(n.customerName)} wants to book you for <b>${esc(n.service)}</b> at ${esc(new Date(n.when).toLocaleString('en-GB', { timeZone: 'Asia/Dhaka' }))}.`,
          { label: 'View request', url: n.bookingUrl },
        ),
        text: `New ${n.service} request from ${n.customerName}: ${n.bookingUrl}`,
      };
    case 'booking_status':
      return {
        subject: `Your ${n.service} booking: ${n.status.replace('_', ' ')}`,
        html: layout(
          'Booking update',
          `Hi ${esc(n.name)}, your ${esc(n.service)} booking ${esc(STATUS_TEXT[n.status] ?? `is now ${n.status}`)}.`,
          { label: 'Open booking', url: n.bookingUrl },
        ),
        text: `Your ${n.service} booking is now ${n.status}: ${n.bookingUrl}`,
      };
    case 'payment_received':
      return {
        subject: `Payment received: ৳${n.amountBdt}`,
        html: layout(
          'Payment received',
          `Hi ${esc(n.name)}, the customer paid <b>৳${n.amountBdt}</b> for your job.`,
          {
            label: 'View booking',
            url: n.bookingUrl,
          },
        ),
        text: `Payment of ৳${n.amountBdt} received: ${n.bookingUrl}`,
      };
  }
}
