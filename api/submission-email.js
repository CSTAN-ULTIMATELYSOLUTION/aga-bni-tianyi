export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { email, name, submissionId, week, score, origin } = request.body || {};
  if (!email || !submissionId) {
    response.status(400).json({ error: "Missing email or submission id" });
    return;
  }

  if (!process.env.RESEND_API_KEY) {
    response.status(202).json({ skipped: true, reason: "RESEND_API_KEY not configured" });
    return;
  }

  const appOrigin = process.env.VITE_APP_ORIGIN || origin || "https://tianyi.agaventures.ai";
  const link = `${appOrigin}/submission/${submissionId}`;
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
      <h2>Tianyi Game submission received 天一游戏提交成功</h2>
      <p>Hi ${escapeHtml(name || "member")}, your weekly report for <strong>${escapeHtml(week || "")}</strong> has been submitted.</p>
      <p>Score: <strong>${Number(score || 0)} pts</strong></p>
      <p>This submission is read-only and cannot be edited or resubmitted.</p>
      <p>此提交已锁定，不能编辑或重复提交。</p>
      <p><a href="${link}" style="color:#0b5fff">View submission 查看提交</a></p>
    </div>
  `;

  const resend = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.MAIL_FROM || "Tianyi Game <noreply@agaventures.ai>",
      to: [email],
      subject: `Tianyi Game submission ${week || ""}`,
      html,
    }),
  });

  if (!resend.ok) {
    response.status(502).json({ error: await resend.text() });
    return;
  }

  response.status(200).json({ ok: true });
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
