import { Resend } from "resend";

export interface Mail {
  to: string;
  subject: string;
  html: string;
}

export async function sendMail({ to, subject, html }: Mail): Promise<void> {
  if (process.env.MAIL_DEV === "true") {
    console.log(`[mail-dev] to=${to} subject="${subject}" body=${html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()}`);
    return;
  }
  const resend = new Resend(process.env.RESEND_API_KEY!);
  await resend.emails.send({ from: process.env.MAIL_FROM!, to, subject, html });
}

const layout = (body: string, ctaUrl: string, ctaText: string) =>
  `<div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto">
  <h2 style="font-size:18px">BikeBits</h2>
  ${body}
  <p><a href="${ctaUrl}" style="background:#0f172a;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;display:inline-block">${ctaText}</a></p>
  <p style="color:#64748b;font-size:12px">If the button doesn't work, copy this link: ${ctaUrl}</p>
</div>`;

export function verificationEmail(url: string): string {
  return layout("<p>Confirm your email address to activate your BikeBits account.</p>", url, "Verify email");
}

export function resetPasswordEmail(url: string): string {
  return layout("<p>Reset your BikeBits password. If you didn't request this, ignore this email.</p>", url, "Reset password");
}

export function priceAlertEmail(itemName: string, retailer: string, price: string, url: string): string {
  return layout(
    `<p><strong>${itemName}</strong> is now <strong>${price}</strong> at ${retailer} — at or below your watch target.</p>`,
    url,
    "View deal",
  );
}
