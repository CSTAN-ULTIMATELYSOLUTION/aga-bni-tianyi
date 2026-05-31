import { createClient } from "@supabase/supabase-js";

const REVIEWER_CC = {
  alice: "awpl5276@gmail.com",
  peixuan: "modernessential22@hotmail.com",
  krision: "krisionyap5298@gmail.com",
};

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.status(405).json({ error: "Method not allowed" });
    return;
  }

  const {
    email,
    name,
    submissionId,
    week,
    score,
    origin,
    adminEmails = [],
    reviewerOwner = "",
    buddyScore = 0,
    buddySubmitted = false,
  } = request.body || {};
  if (!email || !submissionId) {
    response.status(400).json({ error: "Missing email or submission id" });
    return;
  }

  const appOrigin = process.env.VITE_APP_ORIGIN || origin || "https://tianyi.agaventures.ai";
  const updateLink = `${appOrigin}/game/weeklyupdate`;
  const from = process.env.MAIL_FROM || "Tian Yi Game <admin@agaventures.ai>";
  const reviewerCc = REVIEWER_CC[String(reviewerOwner || "").toLowerCase()] || "";
  const memberSubject = `Tianyi Game submission received ${week || ""}`;
  const memberHtml = emailShell({
    title: "Tianyi Game submission received",
    subtitle: "天一游戏提交成功",
    body: `
      <p>Hi ${escapeHtml(name || "member")},</p>
      <p>Your weekly update for <strong>${escapeHtml(week || "")}</strong> has been received. Thank you for keeping your buddy team record up to date.</p>
      <div style="margin:18px 0;padding:14px;border:1px solid #f3d7a6;border-radius:14px;background:#fffaf0">
        <p style="margin:0 0 6px"><strong>Your current score:</strong> ${Number(score || 0)} pts</p>
        <p style="margin:0 0 6px"><strong>Buddy score:</strong> ${Number(buddyScore || 0)} pts</p>
        <p style="margin:0"><strong>Buddy submission status:</strong> ${buddySubmitted ? "Submitted / 已提交" : "No submission recorded yet / 暂无提交记录"}</p>
      </div>
      <p>You may review or edit your weekly update while the edit window is open.</p>
      <p>你可以在开放编辑期间查看或修改本周提交。</p>
      ${emailButton(updateLink, "Review / edit weekly update 查看或编辑提交")}
    `,
  });

  if (!process.env.RESEND_API_KEY) {
    await logEmailEvent({
      submissionId,
      memberEmail: email,
      action: "email_member_submission",
      recipient: email,
      status: "skipped",
      details: { subject: memberSubject, reason: "RESEND_API_KEY not configured" },
    });
    response.status(202).json({ skipped: true, reason: "RESEND_API_KEY not configured" });
    return;
  }

  const memberSend = await sendEmail({
    from,
    to: [email],
    subject: memberSubject,
    html: memberHtml,
  });

  await logEmailEvent({
    submissionId,
    memberEmail: email,
    action: "email_member_submission",
    recipient: email,
    status: memberSend.ok ? "sent" : "failed",
    details: { subject: memberSubject, resend_error: memberSend.error || null },
  });

  if (!memberSend.ok) {
    response.status(502).json({ error: memberSend.error });
    return;
  }

  const recipients = Array.isArray(adminEmails)
    ? adminEmails.filter(Boolean)
    : String(adminEmails || "").split(",").map((item) => item.trim()).filter(Boolean);
  const fallbackAdmins = String(process.env.ADMIN_NOTIFICATION_EMAILS || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const adminRecipients = recipients.length ? recipients : fallbackAdmins;
  const ccRecipients = reviewerCc ? [reviewerCc] : [];
  const effectiveAdminRecipients = adminRecipients.length ? adminRecipients : ccRecipients;
  const effectiveCcRecipients = adminRecipients.length ? ccRecipients : [];

  if (effectiveAdminRecipients.length) {
    const adminSubject = `New Tian Yi submission for review ${week || ""}`;
    const adminHtml = emailShell({
      title: "New weekly submission pending review",
      subtitle: "新的每周提交待审核",
      body: `
        <p><strong>${escapeHtml(name || "member")}</strong> submitted <strong>${escapeHtml(week || "")}</strong>.</p>
        <div style="margin:18px 0;padding:14px;border:1px solid #f3d7a6;border-radius:14px;background:#fffaf0">
          <p style="margin:0 0 6px"><strong>Reviewer:</strong> ${escapeHtml(reviewerOwner || "Not assigned")}</p>
          <p style="margin:0 0 6px"><strong>Submitted score before review:</strong> ${Number(score || 0)} pts</p>
          <p style="margin:0"><strong>Buddy status:</strong> ${buddySubmitted ? `Buddy has ${Number(buddyScore || 0)} pts` : "Buddy has no recorded submission yet"}</p>
        </div>
        <p>Please review the proof and approve or reject each submitted section in the admin portal.</p>
        ${emailButton(`${appOrigin}/admin`, "Open admin portal 打开管理后台")}
      `,
    });
    const adminSend = await sendEmail({
      from,
      to: effectiveAdminRecipients,
      cc: effectiveCcRecipients,
      subject: adminSubject,
      html: adminHtml,
    });

    await logEmailEvent({
      submissionId,
      memberEmail: email,
      action: "email_admin_submission",
      recipient: [...effectiveAdminRecipients, ...effectiveCcRecipients].join(","),
      status: adminSend.ok ? "sent" : "failed",
      details: { subject: adminSubject, reviewer_owner: reviewerOwner || null, resend_error: adminSend.error || null },
    });
  }

  response.status(200).json({ ok: true });
}

async function sendEmail({ from, to, cc = [], subject, html }) {
  const resend = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      ...(cc.length ? { cc } : {}),
      subject,
      html,
    }),
  });

  if (!resend.ok) return { ok: false, error: await resend.text() };
  return { ok: true };
}

async function logEmailEvent({ submissionId, memberEmail, action, recipient, status, details }) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !supabaseKey) return;

  const supabase = createClient(supabaseUrl, supabaseKey, {
    db: { schema: process.env.VITE_SUPABASE_SCHEMA || "tianyi" },
    auth: { persistSession: false },
  });

  try {
    const { error } = await supabase.rpc("log_email_event", {
      p_submission_id: submissionId,
      p_member_email: memberEmail,
      p_action: action,
      p_recipient: recipient,
      p_status: status,
      p_details: details || {},
    });
    if (error) console.error("[submission-email] email log failed", error.message);
  } catch (error) {
    console.error("[submission-email] email log crashed", error.message);
  }
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
