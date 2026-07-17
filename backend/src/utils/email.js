const emailjs = require('@emailjs/nodejs');

// Same pattern as GROQ_API_KEY: optional at the env level.
const serviceId = process.env.EMAILJS_SERVICE_ID;
const templateId = process.env.EMAILJS_TEMPLATE_ID;
const publicKey = process.env.EMAILJS_PUBLIC_KEY;
const privateKey = process.env.EMAILJS_PRIVATE_KEY;
const configured = Boolean(serviceId && templateId && publicKey && privateKey);

if (configured) {
  emailjs.init({ publicKey, privateKey });
}

// No EMAILJS_* keys set: this is a real failure to send, not a soft "stub"
// success. Callers (meetings.service.js) log this to email_logs as a failed
// attempt with this exact reason — never silently reported as sent.
async function send({ to, subject, body }) {
  if (!configured) {
    console.log(`\n[email] -> ${to} (EmailJS not configured, NOT sent)\n  Subject: ${subject}\n  ${body.replace(/\n/g, '\n  ')}\n`);
    throw new Error('Email provider not configured (EMAILJS_SERVICE_ID/TEMPLATE_ID/PUBLIC_KEY/PRIVATE_KEY missing)');
  }

  try {
    const response = await emailjs.send(serviceId, templateId, {
      to_email: to,
      subject,
      message: body,
    });
    return { status: response.status, text: response.text };
  } catch (err) {
    const message = err?.text || err?.message || 'Unknown EmailJS error';
    throw new Error(`EmailJS rejected the send to ${to}: ${message}`);
  }
}

module.exports = { send };
