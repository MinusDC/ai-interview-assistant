// server.js - AI Interview Assistant backend (combined with static frontend)
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");
const fs = require("fs").promises;
const path = require("path");
const axios = require("axios");
const { v4: uuidv4 } = require("uuid");

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

const PORT = process.env.PORT || 4000;
const HOST = "0.0.0.0";
const SESSIONS_FILE = path.join(__dirname, "sessions.json");
const publicDir = path.join(__dirname, "public"); // static build dir

// --- session helpers ---
async function loadSessions() {
  try {
    const txt = await fs.readFile(SESSIONS_FILE, "utf8");
    return JSON.parse(txt || "[]");
  } catch {
    return [];
  }
}
async function saveSessions(data) {
  await fs.writeFile(SESSIONS_FILE, JSON.stringify(data, null, 2), "utf8");
}

// --- resume parsing helpers ---
function extractEmail(text) {
  const m = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,}/i);
  return m ? m[0] : "";
}
function extractPhone(text) {
  const m = text.match(/(\+?\d{1,3}[\s-]?)?(\d{10}|\d{3}[\s-]\d{3}[\s-]\d{4})/);
  return m ? m[0] : "";
}
function extractName(text) {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return "";
  if (
    /^[A-Z][a-zA-Z]+(\s+[A-Z][a-zA-Z]+)+$/.test(lines[0]) ||
    /^[A-Z\s]{4,}$/.test(lines[0])
  ) {
    return lines[0];
  }
  return lines[0];
}

// --- upload resume endpoint ---
const upload = multer({ limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB
app.post("/upload-resume", upload.single("resume"), async (req, res) => {
  try {
    if (!req.file)
      return res.status(400).json({ ok: false, error: "No file uploaded" });
    const buf = req.file.buffer;
    const fn = (req.file.originalname || "").toLowerCase();
    let rawText = "";

    if (fn.endsWith(".pdf") || req.file.mimetype === "application/pdf") {
      const parsed = await pdfParse(buf);
      rawText = parsed.text || "";
    } else if (
      fn.endsWith(".docx") ||
      (req.file.mimetype || "").includes("word")
    ) {
      const result = await mammoth.extractRawText({ buffer: buf });
      rawText = result.value || "";
    } else {
      return res
        .status(400)
        .json({ ok: false, error: "Unsupported file type. Use PDF or DOCX." });
    }

    const name = extractName(rawText) || "";
    const email = extractEmail(rawText) || "";
    const phone = extractPhone(rawText) || "";

    return res.json({
      ok: true,
      parsed: { name, email, phone, rawText, filename: req.file.originalname },
    });
  } catch (err) {
    console.error("upload-resume error", err);
    return res
      .status(500)
      .json({ ok: false, error: "Failed to parse resume. Try another file." });
  }
});

// --- annotate questions helper ---
function annotateQuestions(aiQuestions = []) {
  const TIME_BY_DIFFICULTY = { easy: 120, medium: 240, hard: 360 };
  const total = aiQuestions.length || 6;
  const assignByIndex = (i, totalCount) => {
    if (totalCount === 6) {
      if (i < 2) return "easy";
      if (i < 4) return "medium";
      return "hard";
    }
    if (i < Math.ceil(totalCount / 3)) return "easy";
    if (i < Math.ceil((2 * totalCount) / 3)) return "medium";
    return "hard";
  };

  return aiQuestions.map((q, idx) => {
    const text = (
      q.text ||
      q.question ||
      q.prompt ||
      q.content?.parts?.[0]?.text ||
      ""
    )
      .toString()
      .trim();
    const rawDiff = (q.difficulty || q.level || "").toString().toLowerCase();
    let difficulty = "";
    if (rawDiff.includes("easy") || rawDiff.startsWith("e"))
      difficulty = "easy";
    else if (rawDiff.includes("medium") || rawDiff.startsWith("m"))
      difficulty = "medium";
    else if (rawDiff.includes("hard") || rawDiff.startsWith("h"))
      difficulty = "hard";
    if (!difficulty) difficulty = assignByIndex(idx, total);
    const providedTime = parseInt(
      q.timeLimit || q.time_seconds || q.seconds || q.time || "",
      10
    );
    const timeLimit =
      Number.isFinite(providedTime) && providedTime > 0
        ? providedTime
        : TIME_BY_DIFFICULTY[difficulty];
    return {
      id: q.id || `q-${idx}`,
      text: text || `(question ${idx + 1})`,
      difficulty,
      timeLimit,
    };
  });
}

// --- Gemini helpers ---
const GEMINI_KEY =
  process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
const GEMINI_MODEL_SHORT = (
  process.env.GEMINI_MODEL || "gemini-2.5-flash"
).replace(/^models\//, "");

async function callGeminiContents(promptText) {
  if (!GEMINI_KEY) throw new Error("GEMINI_API_KEY not set");
  const payload = { contents: [{ parts: [{ text: String(promptText) }] }] };
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    GEMINI_MODEL_SHORT
  )}:generateContent?key=${encodeURIComponent(GEMINI_KEY)}`;
  const resp = await axios.post(url, payload, {
    headers: { "Content-Type": "application/json" },
    timeout: 20000,
  });
  return resp.data;
}

async function callGeminiGenerateQuestions(
  role = "intern JAVA developer",
  resumeText = ""
) {
  if (!GEMINI_KEY) throw new Error("GEMINI_API_KEY not set");

  const prompt = `
Bạn là một trợ lý phỏng vấn. Dựa trên vai trò ("${role}") và CV của ứng viên (dạng văn bản thô), hãy tạo ra chính xác một mảng JSON gồm 6 đối tượng câu hỏi và chỉ trả về JSON.
Mỗi đối tượng phải có:
- "text": một câu hỏi ngắn gọn trên một dòng (một câu)
- "difficulty": "easy" | "medium" | "hard"
- (tùy chọn) "timeLimit": số giây (kiểu integer) cho phép trả lời câu hỏi (nếu không có, tôi sẽ gán dựa trên độ khó: 120s cho dễ, 240s cho trung bình, 360s cho khó)

Hướng dẫn: tạo 2 câu dễ, sau đó 2 câu trung bình, rồi 2 câu khó.
CV:
${resumeText}
`;

  const raw = await callGeminiContents(prompt);
  let rawText = "";
  try {
    if (raw?.candidates?.[0]?.content?.parts) {
      rawText = raw.candidates[0].content.parts.map((p) => p.text).join("\n");
    } else {
      rawText = JSON.stringify(raw);
    }
  } catch {
    rawText = JSON.stringify(raw);
  }

  const jsonMatch = rawText.match(/```json\s*([\s\S]*?)\s*```/i);
  const candidateJson = jsonMatch ? jsonMatch[1] : rawText;
  const start = candidateJson.indexOf("[");
  const body = start >= 0 ? candidateJson.slice(start) : candidateJson;

  try {
    const parsed = JSON.parse(body);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    console.warn(
      "Gemini questions parse failed. Raw preview:",
      rawText.slice(0, 500)
    );
    return [];
  }
}

// --- generate questions endpoint ---
app.post("/generate-questions", async (req, res) => {
  try {
    const { role = "intern JAVA developer", resumeText = "" } = req.body || {};
    let aiQuestions = [];

    if (GEMINI_KEY) {
      try {
        const parsed = await callGeminiGenerateQuestions(role, resumeText);
        if (Array.isArray(parsed) && parsed.length) aiQuestions = parsed;
      } catch (gErr) {
        console.warn(
          "Gọi Gemini thất bại, sử dụng phương án dự phòng. Error:",
          gErr?.message || gErr
        );
      }
    }

    if (!aiQuestions.length) {
      aiQuestions = [
        { text: "JSX là gì và tại sao chúng ta dùng nó trong React?" },
        { text: "Giải thích sự khác biệt giữa props và state trong React." },
        {
          text: "Bạn sẽ quản lý các side-effects trong 1 ứng dụng React như thế nào?",
        },
        {
          text: "Mô tả cách bạn thiết kế 1 luồng xác thực cho ứng dụng React + Node.js.",
        },
        {
          text: "Bạn sẽ tối ưu hóa một ứng dụng React chậm, bị render lại quá thường xuyên như thế nào?",
        },
        {
          text: "Giải thích cách bạn thiết kế một REST API có khả năng mở rộng cho một nền tảng tìm kiếm việc làm.",
        },
      ];
    }

    const normalized = annotateQuestions(aiQuestions);
    return res.json({ ok: true, questions: normalized });
  } catch (err) {
    console.error("/generate-questions error", err);
    return res
      .status(500)
      .json({ ok: false, error: "generate-questions failed" });
  }
});

// --- evaluation helpers ---
function normalizeAiEvaluation(parsedFromModel, questionsCount) {
  const defaultOverall = { score: 0, summary: "No overall provided" };

  let perAnswerRaw = [];
  let overallRaw = null;

  if (Array.isArray(parsedFromModel)) {
    parsedFromModel.forEach((item) => {
      if (item && typeof item === "object") {
        if (typeof item.index !== "undefined" || item.feedback) {
          perAnswerRaw.push(item);
        } else if (!overallRaw && item.score !== undefined) {
          overallRaw = item;
        }
      }
    });
  } else if (parsedFromModel && typeof parsedFromModel === "object") {
    perAnswerRaw = parsedFromModel.perAnswer || [];
    overallRaw = parsedFromModel.overall || null;
  }

  const aiMap = {};
  perAnswerRaw.forEach((item) => {
    if (!item) return;
    let idx = item.index;
    if (typeof idx === "string") idx = parseInt(idx, 10);
    if (typeof idx === "number") {
      if (idx > 0 && idx <= questionsCount && !aiMap[idx - 1]) {
        aiMap[idx - 1] = item;
      } else {
        aiMap[idx] = item;
      }
    }
  });

  const perAnswer = [];
  for (let i = 0; i < questionsCount; i++) {
    const raw = aiMap[i];
    perAnswer.push({
      index: i,
      score: raw && Number.isFinite(raw.score) ? raw.score : 0,
      feedback: raw?.feedback || "Không có nhận xét nào được cung cấp",
    });
  }

  const overall =
    overallRaw && typeof overallRaw === "object"
      ? {
          score: Number.isFinite(Number(overallRaw.score))
            ? Number(overallRaw.score)
            : 0,
          summary:
            overallRaw.summary ||
            "Không có tóm tắt tổng quan nào được cung cấp",
        }
      : defaultOverall;

  return { perAnswer, overall };
}

async function callGeminiEvaluate(session) {
  const { questions = [], answers = {} } = session;
  const promptHeader = `
Bạn là một trợ lý phỏng vấn. Chỉ trả về JSON hợp lệ.
Định dạng:
{
  "perAnswer": [
    {"index": <0-based index>, "score": <điểm từ 0-10>, "feedback": "<nhận xét ngắn>"}
  ],
  "overall": {"score":điểm từ <0-100>, "summary": "<tóm tắt ngắn>"}
}
phải có tính chính xác ${questions.length} mục trong "perAnswer", mỗi mục phải có một câu hỏi.
`;

  let prompt = promptHeader;
  questions.forEach((q, i) => {
    const ans = (answers[i] && answers[i].text) || "";
    prompt += `Q${i + 1}: ${q.text}\nA${i + 1}: ${ans}\n\n`;
  });

  const raw = await callGeminiContents(prompt);
  let rawText = "";
  if (raw?.candidates?.[0]?.content?.parts)
    rawText = raw.candidates[0].content.parts.map((p) => p.text).join("\n");
  else rawText = JSON.stringify(raw);

  const jsonMatch = rawText.match(/```json\s*([\s\S]*?)\s*```/i);
  let candidateJson = jsonMatch ? jsonMatch[1] : rawText;
  const genericMatch = candidateJson.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  if (!genericMatch)
    throw new Error("Gemini evaluation parse failed - no JSON found");

  const body = genericMatch[0];
  const parsed = JSON.parse(body);
  return parsed;
}

function simpleEvaluate(session) {
  const { questions = [], answers = {} } = session;
  const per = [];
  let total = 0;
  for (let i = 0; i < questions.length; i++) {
    const ans = (answers[i] && answers[i].text) || "";
    const len = ans.trim().length;
    let base = 0;
    if (len === 0) base = 0;
    else if (len < 30) base = 3;
    else if (len < 80) base = 6;
    else base = 8;
    const diff = questions[i].difficulty || "medium";
    const mult = diff === "easy" ? 1 : diff === "medium" ? 1.1 : 1.2;
    const sc = Math.min(10, Math.round(base * mult));
    per.push({
      index: i,
      score: sc,
      feedback: sc < 5 ? "Ngắn hoặc thiếu chi tiết" : "Câu trả lời hợp lý",
    });
    total += sc;
  }
  const overall = Math.round((total / (questions.length * 10)) * 100);
  return {
    perAnswer: per,
    overall: { score: overall, summary: "Đánh giá heuristic dự phòng." },
  };
}

app.post("/evaluate-answers", async (req, res) => {
  try {
    const session = req.body;
    if (!session || !session.questions)
      return res.status(400).json({ ok: false, error: "invalid payload" });

    if (GEMINI_KEY) {
      try {
        const rawAi = await callGeminiEvaluate(session);
        const normalized = normalizeAiEvaluation(
          rawAi,
          session.questions.length
        );
        console.log(
          "Đánh giá AI đã được chuẩn hóa:",
          JSON.stringify(normalized, null, 2)
        );
        return res.json({ ok: true, ai: normalized });
      } catch (gErr) {
        console.warn(
          "evaluateAnswers: Lôi gọi Gemini, sử dụng phương án dự phòng. Error:",
          gErr?.message || gErr
        );
      }
    }

    const fallback = simpleEvaluate(session);
    return res.json({ ok: true, ai: fallback });
  } catch (err) {
    console.error("/evaluate-answers error", err);
    return res.status(500).json({ ok: false, error: "evaluate failed" });
  }
});

// --- sessions storage endpoints ---
app.post("/submit-session", async (req, res) => {
  try {
    const payload = req.body;
    let sessions = await loadSessions();

    const id = payload.id || String(Date.now()) || uuidv4();
    const entry = { id, createdAt: Date.now(), ...payload };

    const existingIndex = sessions.findIndex((s) => s.id === id);
    if (existingIndex >= 0) sessions[existingIndex] = entry;
    else sessions.push(entry);

    await saveSessions(sessions);
    return res.json({ ok: true, session: entry });
  } catch (err) {
    console.error("/submit-session error", err);
    return res.status(500).json({ ok: false, error: "submit failed" });
  }
});

app.get("/sessions", async (req, res) => {
  const sessions = await loadSessions();
  const sorted = sessions.sort(
    (a, b) => (b.createdAt || 0) - (a.createdAt || 0)
  );
  return res.json({ ok: true, sessions: sorted });
});

app.get("/sessions/:id", async (req, res) => {
  const sessions = await loadSessions();
  const s = sessions.find((x) => x.id === req.params.id);
  if (!s) return res.status(404).json({ ok: false, error: "not found" });
  return res.json({ ok: true, session: s });
});

app.delete("/sessions/:id", async (req, res) => {
  let sessions = await loadSessions();
  const before = sessions.length;
  sessions = sessions.filter((x) => x.id !== req.params.id);
  await saveSessions(sessions);
  return res.json({ ok: true, removed: before - sessions.length });
});

// --- health check ---
app.get("/health", (req, res) => res.json({ ok: true }));

// --- static frontend serving ---
(async () => {
  try {
    await fs.access(path.join(publicDir, "index.html"));
    console.log(
      "Đã phát hiện giao diện người dùng (frontend) tại thư mục ./public — Ứng dụng Trang đơn (SPA) sẽ được phục vụ."
    );
  } catch {
    console.log(
      "Không tìm thấy giao diện người dùng (frontend) trong thư mục ./public. Các chức năng API (backend) vẫn hoạt động bình thường."
    );
  }
})();

app.use(express.static(publicDir));

const API_PREFIXES = [
  "/upload-resume",
  "/generate-questions",
  "/evaluate-answers",
  "/submit-session",
  "/sessions",
  "/health",
  "/api",
];

app.get("*", (req, res, next) => {
  for (const p of API_PREFIXES) {
    if (req.path.startsWith(p)) return next();
  }
  res.sendFile(path.join(publicDir, "index.html"), (err) => {
    if (err) next(err);
  });
});

// --- start server ---
app.listen(PORT, HOST, () => {
  console.log(
    `AI Interview Assistant backend running at http://${HOST}:${PORT}`
  );
  console.log(`Serving static files from: ${publicDir}`);
  if (process.env.GEMINI_API_KEY) {
    console.log("GEMINI_API_KEY is set");
  } else {
    console.log("GEMINI_API_KEY not set (API calls may fail)");
  }
});
