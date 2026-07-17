const multer = require('multer');
const { asyncHandler } = require('../../middleware/asyncHandler');
const { ApiError } = require('../../utils/ApiError');
const service = require('./voice.service');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB — generous for a short voice command
}).single('audio');

// Wrap multer so its errors flow through our error middleware instead of
// crashing past it with an unhandled exception.
function handleUpload(req, res, next) {
  upload(req, res, (err) => {
    if (err) return next(new ApiError(400, `Audio upload error: ${err.message}`));
    next();
  });
}

function extractInput(req) {
  const transcript = req.body?.transcript;
  if (!transcript && !req.file) {
    throw new ApiError(400, 'Provide either an "audio" file field or a "transcript" text field');
  }
  return {
    transcript,
    audioBuffer: req.file ? req.file.buffer : undefined,
    audioMimeType: req.file ? req.file.mimetype : undefined,
  };
}

function shapeAssignee(assignee) {
  return assignee ? { id: assignee.id, name: assignee.name, email: assignee.email } : null;
}

// Preview only — parses the command but never writes to the database.
// Lets the front end show "here's what I heard" before committing.
const parseCommand = asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const input = extractInput(req);
  const parsed = await service.parseVoiceCommand(input);

  res.json({
    success: true,
    data: {
      projectId,
      transcript: parsed.transcript,
      parsed: {
        title: parsed.title,
        dueDate: parsed.dueDate,
        assignee: shapeAssignee(parsed.assignee),
        assigneeNameHeard: parsed.assigneeNameHeard,
      },
      warnings: parsed.warnings,
    },
  });
});

// Parses AND creates the task in one call, through the same createTask()
// the manual "Add task" form uses.
const createFromVoice = asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const input = extractInput(req);
  const result = await service.createTaskFromVoice({ projectId, ...input, createdBy: req.user.id });
  res.status(201).json({ success: true, data: result });
});

module.exports = { handleUpload, parseCommand, createFromVoice };
