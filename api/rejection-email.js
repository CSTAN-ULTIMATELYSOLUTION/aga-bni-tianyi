export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { email, name, week, kind, reason } = request.body || {};
  if (!email || !reason) {
    response.status(400).json({ error: "Missing email or reason" });
    return;
  }

  if (!process.env.RESEND_API_KEY) {
    response.status(202).json({ skipped: true, reason: "RESEND_API_KEY not configured" });
    return;
  }

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
      <h2>Tianyi Game proof rejected 天一游戏证明被拒绝</h2>
      <p>Hi ${escapeHtml(name || "member")}, your <strong>${escapeHtml(kind || "proof")}</strong> proof for <strong>${escapeHtml(week || "")}</strong> needs correction.</p>
      <p><strong>Reason 原因:</strong> ${escapeHtml(reason)}</p>
      <p>Please contact the admin team if you need help. 如需协助，请联系管理员。</p>
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
      subject: `Tianyi Game proof rejected ${week || ""}`,
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
