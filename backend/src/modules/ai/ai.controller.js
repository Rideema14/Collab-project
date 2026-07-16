const multer = require('multer');
const { asyncHandler } = require('../../middleware/asyncHandler');
const { ApiError } = require('../../utils/ApiError');
const service = require('./ai.service');
const groqClient = require('../voice/voice.groqClient');

// Reuse the same in-memory audio upload the voice module uses.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
}).single('audio');

function handleUpload(req, res, next) {
  upload(req, res, (err) => {
    if (err) return next(new ApiError(400, `Audio upload error: ${err.message}`));
    next();
  });
}

async function command(req, res, next) {
  try {
    const { message, context } = req.body || {};
    const plan = await service.runCommand({ message, context });
    res.json({ success: true, data: plan });
  } catch (err) {
    next(err);
  }
}

// Speech-to-text for the global assistant via Groq Whisper (the same client the
// voice module uses). Returns the transcript only — the client then runs it
// through the normal /api/ai/command flow, exactly like a typed message.
const transcribe = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, 'Provide an "audio" file field');
  const text = await groqClient.transcribeAudio(req.file.buffer, req.file.mimetype);
  res.json({ success: true, data: { text } });
});

module.exports = { command, handleUpload, transcribe };
