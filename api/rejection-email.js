import { createClient } from "@supabase/supabase-js";

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { email, name, submissionId, week, kind, reason, origin } = request.body || {};
  if (!email || !reason) {
    response.status(400).json({ error: "Missing email or reason" });
    return;
  }

  const appOrigin = process.env.VITE_APP_ORIGIN || origin || "https://tianyi.agaventures.ai";
  const subject = `Tianyi Game proof needs correction ${week || ""}`;
  const html = emailShell({
    title: "Weekly submission needs correction",
    subtitle: "每周提交需要修正",
    body: `
      <p>Hi ${escapeHtml(name || "member")},</p>
      <p>Your <strong>${escapeHtml(kind || "proof")}</strong> proof for <strong>${escapeHtml(week || "")}</strong> needs a correction before points can be approved.</p>
      <div style="margin:18px 0;padding:14px;border:1px solid #fecaca;border-radius:14px;background:#fff7f7">
        <p style="margin:0;color:#991b1b"><strong>Reason 原因:</strong> ${escapeHtml(reason)}</p>
      </div>
      <p>Please update the proof or resubmit the section from the weekly update page.</p>
      <p>请到每周更新页面修正证明或重新提交相关项目。</p>
      ${emailButton(`${appOrigin}/game/weeklyupdate`, "Open weekly update 打开每周更新")}
    `,
  });

  if (!process.env.RESEND_API_KEY) {
    await logEmailEvent({
      submissionId,
      memberEmail: email,
      action: "email_member_rejection",
      recipient: email,
      status: "skipped",
      details: { subject, reason: "RESEND_API_KEY not configured" },
    });
    response.status(202).json({ skipped: true, reason: "RESEND_API_KEY not configured" });
    return;
  }

  const resend = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.MAIL_FROM || "Tian Yi Game <admin@agaventures.ai>",
      to: [email],
      subject,
      html,
    }),
  });

  const errorText = resend.ok ? "" : await resend.text();
  await logEmailEvent({
    submissionId,
    memberEmail: email,
    action: "email_member_rejection",
    recipient: email,
    status: resend.ok ? "sent" : "failed",
    details: { subject, kind: kind || null, rejection_reason: reason, resend_error: errorText || null },
  });

  if (!resend.ok) {
    response.status(502).json({ error: errorText });
    return;
  }

  response.status(200).json({ ok: true });
}

async function logEmailEvent({ submissionId, memberEmail, action, recipient, status, details }) {
  if (!submissionId) return;
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !supabaseKey) return;

  const supabase = createClient(supabaseUrl, supabaseKey, {
    db: { schema: process.env.VITE_SUPABASE_SCHEMA || "tianyi" },
    auth: { persistSession: false },
  });

  await supabase.rpc("log_email_event", {
    p_submission_id: submissionId,
    p_member_email: memberEmail,
    p_action: action,
    p_recipient: recipient,
    p_status: status,
    p_details: details || {},
  }).catch(() => {});
}

function emailShell({ title, subtitle, body }) {
  return `
    <div style="margin:0;padding:0;background:#f8f5ef;color:#111827;font-family:Arial,sans-serif">
      <div style="max-width:640px;margin:0 auto;padding:28px 18px">
        <div style="padding:22px;border-radius:20px;background:#ffffff;border:1px solid #eadfd2">
          <p style="margin:0 0 6px;color:#d93025;font-size:12px;font-weight:700;letter-spacing:.04em">TIAN YI OneSystem</p>
          <h1 style="margin:0;color:#111827;font-size:24px;line-height:1.2">${title}</h1>
          <p style="margin:6px 0 18px;color:#6b7280;font-size:15px">${subtitle}</p>
          <div style="font-size:15px;line-height:1.65;color:#374151">${body}</div>
        </div>
      </div>
    </div>
  `;
}

function emailButton(href, label) {
  return `<p style="margin:20px 0 0"><a href="${href}" style="display:inline-block;padding:12px 16px;border-radius:999px;background:#d93025;color:#ffffff;text-decoration:none;font-weight:700">${label}</a></p>`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
