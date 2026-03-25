let Resend: typeof import("resend").Resend | undefined;

async function getResend() {
  if (!process.env.RESEND_API_KEY) return null;
  if (!Resend) {
    const mod = await import("resend");
    Resend = mod.Resend;
  }
  return new Resend(process.env.RESEND_API_KEY);
}

const FROM = process.env.RESEND_FROM_EMAIL ?? "Reward Agency <noreply@reward-agency.com>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function sendTeamMemberWelcome(params: {
  to: string;
  name: string;
  role: string;
  temporaryPassword: string;
}) {
  const resend = await getResend();
  if (!resend) {
    console.log("[email] sendTeamMemberWelcome →", params.to, { name: params.name, role: params.role });
    return;
  }
  await resend.emails.send({
    from: FROM,
    to: params.to,
    subject: "Welcome to Reward Agency — Your Account Details",
    html: `
      <p>Hi ${params.name},</p>
      <p>Your Reward Agency account has been created with the role <strong>${params.role}</strong>.</p>
      <p><strong>Login:</strong> ${params.to}<br>
      <strong>Password:</strong> ${params.temporaryPassword}</p>
      <p><a href="${APP_URL}/login">Log in here</a></p>
      <p>Please change your password after first login.</p>
    `,
  }).catch((err: unknown) => console.error("[email] sendTeamMemberWelcome failed:", err));
}

export async function sendClientWelcome(params: {
  to: string;
  name: string;
}) {
  const resend = await getResend();
  if (!resend) {
    console.log("[email] sendClientWelcome →", params.to, { name: params.name });
    return;
  }
  await resend.emails.send({
    from: FROM,
    to: params.to,
    subject: "Welcome to Reward Agency",
    html: `
      <p>Hi ${params.name},</p>
      <p>Your Reward Agency client account has been created.</p>
      <p>Your account manager will be in touch shortly.</p>
    `,
  }).catch((err: unknown) => console.error("[email] sendClientWelcome failed:", err));
}

export async function sendAffiliateOnboardingWelcome(params: {
  to: string;
  name: string;
  affiliateCode: string;
  referralLink: string;
}) {
  const resend = await getResend();
  if (!resend) {
    console.log("[email] sendAffiliateOnboardingWelcome →", params.to, {
      name: params.name,
      affiliateCode: params.affiliateCode,
    });
    return;
  }
  await resend.emails.send({
    from: FROM,
    to: params.to,
    subject: "Welcome to Reward Agency Affiliate Program",
    html: `
      <p>Hi ${params.name},</p>
      <p>Welcome to the Reward Agency Affiliate Program!</p>
      <p><strong>Your affiliate code:</strong> ${params.affiliateCode}<br>
      <strong>Your referral link:</strong> <a href="${params.referralLink}">${params.referralLink}</a></p>
      <p><a href="${APP_URL}/login">Log in to your dashboard</a></p>
    `,
  }).catch((err: unknown) => console.error("[email] sendAffiliateOnboardingWelcome failed:", err));
}

export async function sendClientOnboardingWelcome(params: {
  to: string;
  name: string;
}) {
  const resend = await getResend();
  if (!resend) {
    console.log("[email] sendClientOnboardingWelcome →", params.to, { name: params.name });
    return;
  }
  await resend.emails.send({
    from: FROM,
    to: params.to,
    subject: "Welcome to Reward Agency — Your Account is Ready",
    html: `
      <p>Hi ${params.name},</p>
      <p>Your Reward Agency client account has been created and is ready to use.</p>
      <p><a href="${APP_URL}/portal/dashboard">Log in to your client portal</a></p>
    `,
  }).catch((err: unknown) => console.error("[email] sendClientOnboardingWelcome failed:", err));
}
