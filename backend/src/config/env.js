require('dotenv').config();

const required = ['DATABASE_URL', 'JWT_SECRET'];
const missing = required.filter((key) => !process.env[key]);

if (missing.length > 0) {
  throw new Error(`Missing required environment variable(s): ${missing.join(', ')}`);
}

module.exports = {
  port: Number(process.env.PORT) || 4000,
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',

  // Optional — powers the voice module only. The rest of the app works with
  // these unset; voice endpoints return a clean 503 instead of crashing.
  groqApiKey: process.env.GROQ_API_KEY || null,
  groqModel: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
  groqTranscribeModel: process.env.GROQ_TRANSCRIBE_MODEL || 'whisper-large-v3-turbo',

  // Optional — the external Meeting Bot service (backend/meeting.py, port 8000)
  // that actually joins the call. Unset, everything else still works and only
  // "Deploy Bot" returns a clean 503, the same way voice degrades.
  meetingBotUrl: (process.env.MEETING_BOT_URL || 'http://localhost:8000').replace(/\/+$/, ''),
};
