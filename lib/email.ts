import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM = process.env.RESEND_FROM_EMAIL ?? "onboarding@reward-agency.com";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export type EmailResult = { success: true } | { success: false; error: string };

// ─── Shared template wrapper ──────────────────────────────────────────────────

function emailWrapper(body: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
          <!-- Logo header -->
          <tr>
            <td style="padding-bottom:24px;text-align:center;">
              <table cellpadding="0" cellspacing="0" style="display:inline-table;">
                <tr>
                  <td style="background:#3b4fd8;border-radius:12px;width:40px;height:40px;text-align:center;vertical-align:middle;">
                    <span style="color:#fff;font-size:22px;font-weight:700;line-height:40px;">R</span>
                  </td>
                  <td style="padding-left:10px;vertical-align:middle;">
                    <span style="color:#111827;font-size:18px;font-weight:600;">Reward Agency</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Card -->
          <tr>
            <td style="background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;padding:40px;">
              ${body}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding-top:24px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">© ${new Date().getFullYear()} Reward Agency. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function ctaButton(text: string, href: string) {
  return `<table cellpadding="0" cellspacing="0" style="margin:28px 0;">
    <tr>
      <td style="background:#3b4fd8;border-radius:8px;">
        <a href="${href}" style="display:inline-block;padding:13px 28px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;">${text}</a>
      </td>
    </tr>
  </table>`;
}

function credentialRow(label: string, value: string) {
  return `<tr>
    <td style="padding:10px 16px;font-size:13px;font-weight:600;color:#6b7280;width:140px;vertical-align:top;">${label}</td>
    <td style="padding:10px 16px;font-size:13px;color:#111827;font-family:monospace;background:#f9fafb;border-radius:6px;">${value}</td>
  </tr>`;
}

// ─── sendTeamMemberWelcome ────────────────────────────────────────────────────

export async function sendTeamMemberWelcome(params: {
  to: string;
  name: string;
  role: string;
  temporaryPassword: string;
}): Promise<EmailResult> {
  if (!resend) {
    console.log("[email] sendTeamMemberWelcome →", params.to, { name: params.name, role: params.role });
    return { success: false, error: "RESEND_API_KEY not configured" };
  }

  const body = `
    <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;">Welcome to Reward Agency Dashboard</h2>
    <p style="margin:0 0 24px;font-size:15px;color:#6b7280;">Hi ${params.name}, your account has been created with the role <strong style="color:#111827;">${params.role}</strong>.</p>

    <table cellpadding="0" cellspacing="0" style="width:100%;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
      <tbody>
        ${credentialRow("Email", params.to)}
        ${credentialRow("Password", params.temporaryPassword)}
      </tbody>
    </table>

    ${ctaButton("Login Now", `${APP_URL}/login`)}

    <p style="margin:0;font-size:13px;color:#9ca3af;">Please change your password after your first login.</p>
  `;

  try {
    await resend.emails.send({
      from: FROM,
      to: params.to,
      subject: "Welcome to Reward Agency Dashboard",
      html: emailWrapper(body),
    });
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[email] sendTeamMemberWelcome failed:", message);
    return { success: false, error: message };
  }
}

// ─── sendClientWelcome ────────────────────────────────────────────────────────

export async function sendClientWelcome(params: {
  to: string;
  name: string;
  clientCode: string;
  password?: string;
}): Promise<EmailResult> {
  if (!resend) {
    console.log("[email] sendClientWelcome →", params.to, { name: params.name, clientCode: params.clientCode });
    return { success: false, error: "RESEND_API_KEY not configured" };
  }

  const credRows = [
    credentialRow("Client Code", params.clientCode),
    credentialRow("Email", params.to),
    ...(params.password ? [credentialRow("Password", params.password)] : []),
  ].join("\n");

  const body = `
    <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;">Welcome to Reward Agency</h2>
    <p style="margin:0 0 24px;font-size:15px;color:#6b7280;">Hi ${params.name}, your client portal is ready.</p>

    <table cellpadding="0" cellspacing="0" style="width:100%;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
      <tbody>
        ${credRows}
      </tbody>
    </table>

    ${ctaButton("Access My Portal", `${APP_URL}/login`)}

    <p style="margin:0;font-size:13px;color:#9ca3af;">Your wallet and ad accounts are ready to use. Your account manager will be in touch shortly.</p>
  `;

  try {
    await resend.emails.send({
      from: FROM,
      to: params.to,
      subject: "Welcome to Reward Agency — Your Portal Access",
      html: emailWrapper(body),
    });
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[email] sendClientWelcome failed:", message);
    return { success: false, error: message };
  }
}

// ─── sendAffiliateOnboardingWelcome ──────────────────────────────────────────

export async function sendAffiliateOnboardingWelcome(params: {
  to: string;
  name: string;
  affiliateCode: string;
  referralLink: string;
}): Promise<EmailResult> {
  if (!resend) {
    console.log("[email] sendAffiliateOnboardingWelcome →", params.to, {
      name: params.name,
      affiliateCode: params.affiliateCode,
    });
    return { success: false, error: "RESEND_API_KEY not configured" };
  }

  const body = `
    <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;">Welcome to the Affiliate Program</h2>
    <p style="margin:0 0 24px;font-size:15px;color:#6b7280;">Hi ${params.name}, you've been added as a Reward Agency affiliate partner.</p>

    <table cellpadding="0" cellspacing="0" style="width:100%;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
      <tbody>
        ${credentialRow("Affiliate Code", params.affiliateCode)}
        ${credentialRow("Referral Link", params.referralLink)}
      </tbody>
    </table>

    ${ctaButton("Go to Dashboard", `${APP_URL}/login`)}

    <p style="margin:0;font-size:13px;color:#9ca3af;">Share your referral link to earn commissions on referred client top-ups.</p>
  `;

  try {
    await resend.emails.send({
      from: FROM,
      to: params.to,
      subject: "Welcome to Reward Agency Affiliate Program",
      html: emailWrapper(body),
    });
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[email] sendAffiliateOnboardingWelcome failed:", message);
    return { success: false, error: message };
  }
}

// ─── sendPasswordReset ────────────────────────────────────────────────────────

export async function sendPasswordReset(params: {
  to: string;
  resetUrl: string;
}): Promise<EmailResult> {
  if (!resend) {
    console.log("[email] sendPasswordReset →", params.to, { resetUrl: params.resetUrl });
    return { success: false, error: "RESEND_API_KEY not configured" };
  }

  const body = `
    <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;">Reset your password</h2>
    <p style="margin:0 0 24px;font-size:15px;color:#6b7280;">Click the button below to reset your Reward Agency password. This link expires in <strong style="color:#111827;">1 hour</strong>.</p>

    ${ctaButton("Reset Password", params.resetUrl)}

    <p style="margin:0;font-size:13px;color:#9ca3af;">If you did not request a password reset, you can safely ignore this email.</p>
  `;

  try {
    await resend.emails.send({
      from: FROM,
      to: params.to,
      subject: "Reset your Reward Agency password",
      html: emailWrapper(body),
    });
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[email] sendPasswordReset failed:", message);
    return { success: false, error: message };
  }
}

// ─── sendClientOnboardingWelcome (alias for sendClientWelcome) ────────────────

export async function sendClientOnboardingWelcome(params: {
  to: string;
  name: string;
  clientCode: string;
  password: string;
}): Promise<EmailResult> {
  return sendClientWelcome(params);
}
