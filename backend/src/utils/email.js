const emailjs = require('@emailjs/nodejs');

// Same pattern as GROQ_API_KEY: optional at the env level. With no service/
// template/keys set, `send` logs the rendered email instead of calling
// EmailJS, so every environment (including a fresh clone with no keys yet)
// keeps working.
const serviceId = process.env.EMAILJS_SERVICE_ID;
const templateId = process.env.EMAILJS_TEMPLATE_ID;
const publicKey = process.env.EMAILJS_PUBLIC_KEY;
const privateKey = process.env.EMAILJS_PRIVATE_KEY;
const configured = Boolean(serviceId && templateId && publicKey && privateKey);

if (configured) {
  emailjs.init({ publicKey, privateKey });
}

function logStub({ to, subject, body }) {
  console.log(`\n[email] -> ${to} (EmailJS not configured, not actually sent)\n  Subject: ${subject}\n  ${body.replace(/\n/g, '\n  ')}\n`);
  return { delivered: false, stub: true };
}

async function send({ to, subject, body }) {
  if (!configured) return logStub({ to, subject, body });

  try {
    const response = await emailjs.send(serviceId, templateId, {
      to_email: to,
      subject,
      message: body,
    });
    return { delivered: true, stub: false, status: response.status };
  } catch (err) {
    const message = err?.text || err?.message || 'Unknown EmailJS error';
    throw new Error(`Failed to send email to ${to}: ${message}`);
  }
}

module.exports = { send };
