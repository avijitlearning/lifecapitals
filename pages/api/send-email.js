export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { email, name, uid } = req.body;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Life Capitals <onboarding@resend.dev>",
        to: email,
        subject: "Your Life Capitals personal link",
        html: `<p>Hi ${name},</p><p>Here is your personal Life Capitals link. Bookmark it to access your reflections from any device:</p><p><a href="https://${req.headers.host}/u/${uid}">https://${req.headers.host}/u/${uid}</a></p><p>This link is private — don't share it with others.</p>`,
      }),
    });
    const data = await response.json();
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
