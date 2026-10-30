require("dotenv").config();
const path = require("path");
const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const nodemailer = require("nodemailer");

const { GMAIL_USER, GMAIL_APP_PASSWORD, CONTACT_TO, PORT = 3000 } = process.env;
if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
  console.error("Missing GMAIL_USER or GMAIL_APP_PASSWORD. Copy .env.example to .env and fill it in.");
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
});

const app = express();
app.set("trust proxy", 1); // needed behind Render, Railway, Nginx, etc.
app.use(helmet({ contentSecurityPolicy: false })); // CSP off because the site loads Three.js and fonts from CDNs
app.use(express.json({ limit: "10kb" }));
app.use(express.static(path.join(__dirname, "public"))); // your website files live in /public

// Max 5 messages per visitor every 15 minutes (stops spam)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: "Too many messages. Please try again in a few minutes." },
});

const clean = (v) => String(v ?? "").trim();
const oneLine = (v) => clean(v).replace(/[\r\n]+/g, " ");
const escapeHtml = (s) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

app.post("/api/contact", limiter, async (req, res) => {
  const body = req.body || {};
  if (clean(body._honey)) return res.json({ ok: true }); // bots fill the hidden field; pretend it worked

  const name = oneLine(body.name);
  const email = oneLine(body.email);
  const message = clean(body.message);

  if (!name || name.length > 100)
    return res.status(400).json({ ok: false, error: "Please enter your name." });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200)
    return res.status(400).json({ ok: false, error: "Please enter a valid email address." });
  if (message.length < 5 || message.length > 3000)
    return res.status(400).json({ ok: false, error: "Your message must be between 5 and 3000 characters." });

  try {
    await transporter.sendMail({
      from: `"Website contact" <${GMAIL_USER}>`,
      to: CONTACT_TO || GMAIL_USER,
      replyTo: `"${name.replace(/"/g, "")}" <${email}>`,
      subject: `New message from ${name}`,
      text: `Name: ${name}\nEmail: ${email}\n\n${message}`,
      html: `<p><b>Name:</b> ${escapeHtml(name)}<br><b>Email:</b> ${escapeHtml(email)}</p>
             <p style="white-space:pre-wrap">${escapeHtml(message)}</p>`,
    });
    res.json({ ok: true });
  } catch (err) {
    console.error("Mail error:", err.message);
    res.status(500).json({ ok: false, error: "Sorry, the message could not be sent. Please try again later." });
  }
});

app.listen(PORT, () => console.log(`Site running at http://localhost:${PORT}`));
