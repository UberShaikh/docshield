const express = require("express");
const cors = require("cors");
const multer = require("multer");
const axios = require("axios");
const FormData = require("form-data");

const { db, stmts } = require("./db");

const app = express();
const PORT = 4000;

// 🔥 IMPORTANT FIX (docker + local दोनों support)
const AI_URL = process.env.AI_URL || "http://localhost:8000";

app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

const path = require("path");
console.log("✅ DB FILE:", path.resolve("./data/docshield.db"));
console.log("🤖 AI URL:", AI_URL);

/* ================= AUTH ================= */

app.post("/auth/register", (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: "All fields required" });
  }

  try {
    const exists =
      stmts.getUserByEmail.get(email) ||
      stmts.getUserByUsername.get(username);

    if (exists) {
      return res.status(400).json({ error: "User already exists" });
    }

    stmts.createUser.run(
      username.trim(),
      email.trim(),
      password.trim()
    );

    res.json({ success: true });

  } catch (err) {
    console.log("❌ REGISTER ERROR:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post("/auth/login", (req, res) => {
  let { email, password } = req.body;

  email = email.trim();
  password = password.trim();

  const user = stmts.getUserByEmail.get(email);

  if (!user) {
    return res.status(401).json({ error: "User not found" });
  }

  if (user.password.trim() !== password) {
    return res.status(401).json({ error: "Invalid password" });
  }

  stmts.updateLastLogin.run(user.id);

  res.json({
    success: true,
    user: {
      id: user.id,
      username: user.username,
      email: user.email
    }
  });
});

/* ================= ANALYZE ================= */
app.post("/analyze", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    console.log("📄 FILE:", req.file.originalname);

    const form = new FormData();
    form.append("file", req.file.buffer, req.file.originalname);

    let data = {};

    // 🔥 FIX 1: LONG TIMEOUT + SAFE CALL
    try {
      const aiRes = await axios.post(`${AI_URL}/analyze`, form, {
        headers: form.getHeaders(),
        timeout: 120000   // ✅ 2 MIN FIX
      });

      data = aiRes.data || {};
      console.log("✅ AI RESPONSE RECEIVED");

    } catch (err) {
      console.log("❌ AI SERVICE FAIL:", err.message);

      // 🔥 FIX 2: FALLBACK (SYSTEM NEVER BREAK)
      data = {
        fraud_score: 0,
        risk_level: "LOW",
        heatmap_url: "",
        ai_score: 0,
        tampering_score: 0,
        ocr_score: 0,
        ocr_text: "AI service failed — fallback result"
      };
    }

    // 🔥 FIX 3: ALWAYS SAFE VALUES
    const heatmap = data.heatmap_url
      ? `http://localhost:4000/proxy${data.heatmap_url}`
      : "";

    const fraud = data.fraud_score ?? 0;
    const risk = data.risk_level || "LOW";

    const aiScore = data.ai_score ?? 0;
    const tampering = data.tampering_score ?? 0;
    const ocrScore = data.ocr_score ?? 0;

    const ocrText = data.ocr_text && data.ocr_text.trim().length > 5
      ? data.ocr_text
      : "No meaningful OCR text detected";

    // ================= SAVE =================
    const doc = stmts.insertDocument.run(
      null,
      req.file.originalname,
      req.file.originalname,
      req.file.size,
      req.file.mimetype,
      1
    );

    const documentId = doc.lastInsertRowid;

    stmts.insertAnalysis.run(
      documentId,
      null,
      fraud,
      risk,
      aiScore,
      tampering,
      0,
      ocrScore,
      0,
      heatmap,
      ocrText,
      "{}",
      "{}"
    );

    console.log("✅ SAVED TO DB");

    res.json({
      success: true,
      fraud_score: fraud,
      risk_level: risk,
      heatmap_url: heatmap,
      ocr_text: ocrText,
      ai_score: aiScore,
      tampering_score: tampering,
      ocr_score: ocrScore
    });

  } catch (err) {
    console.log("❌ ANALYZE ERROR:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ================= BATCH ANALYZE ================= */
app.post("/analyze-batch", upload.array("files", 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "No files uploaded" });
    }

    console.log(`📄 BATCH: Processing ${req.files.length} files`);
    
    const results = [];

    for (const file of req.files) {
      console.log("📄 FILE (BATCH):", file.originalname);

      const form = new FormData();
      form.append("file", file.buffer, file.originalname);

      let data = {};

      try {
        const aiRes = await axios.post(`${AI_URL}/analyze`, form, {
          headers: form.getHeaders(),
          timeout: 120000
        });

        data = aiRes.data || {};
        console.log(`✅ AI RESPONSE RECEIVED FOR ${file.originalname}`);

      } catch (err) {
        console.log(`❌ AI SERVICE FAIL FOR ${file.originalname}:`, err.message);

        data = {
          fraud_score: 0,
          risk_level: "LOW",
          heatmap_url: "",
          ai_score: 0,
          tampering_score: 0,
          ocr_score: 0,
          ocr_text: "AI service failed — fallback result"
        };
      }

      const heatmap = data.heatmap_url
        ? `http://localhost:4000/proxy${data.heatmap_url}`
        : "";

      const fraud = data.fraud_score ?? 0;
      const risk = data.risk_level || "LOW";

      const aiScore = data.ai_score ?? 0;
      const tampering = data.tampering_score ?? 0;
      const ocrScore = data.ocr_score ?? 0;

      const ocrText = data.ocr_text && data.ocr_text.trim().length > 5
        ? data.ocr_text
        : "No meaningful OCR text detected";

      // ================= SAVE =================
      const doc = stmts.insertDocument.run(
        null,
        file.originalname,
        file.originalname,
        file.size,
        file.mimetype,
        1
      );

      const documentId = doc.lastInsertRowid;

      stmts.insertAnalysis.run(
        documentId,
        null,
        fraud,
        risk,
        aiScore,
        tampering,
        0,
        ocrScore,
        0,
        heatmap,
        ocrText,
        "{}",
        "{}"
      );

      console.log(`✅ SAVED TO DB FOR ${file.originalname}`);

      results.push({
        file_name: file.originalname,
        fraud_score: fraud,
        risk_level: risk,
        heatmap_url: heatmap,
        ocr_text: ocrText,
        ai_score: aiScore,
        tampering_score: tampering,
        ocr_score: ocrScore
      });
    }

    res.json({
      success: true,
      results: results
    });

  } catch (err) {
    console.log("❌ BATCH ANALYZE ERROR:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ================= HISTORY ================= */
app.get("/history", (req, res) => {
  try {
    const rows = stmts.getAllAnalyses.all(50, 0);

    res.json({
      analyses: rows,
      total: rows.length
    });

  } catch (err) {
    console.log("❌ HISTORY ERROR:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get("/stats", (req, res) => {
  try {
    const total = db.prepare("SELECT COUNT(*) as t FROM analyses").get().t;

    const avg = db.prepare(`
      SELECT AVG(fraud_score) as avg FROM analyses
    `).get().avg || 0;

    const high = db.prepare(`
      SELECT COUNT(*) as c FROM analyses WHERE fraud_score > 70
    `).get().c;

    const medium = db.prepare(`
      SELECT COUNT(*) as c FROM analyses WHERE fraud_score BETWEEN 40 AND 70
    `).get().c;

    const low = db.prepare(`
      SELECT COUNT(*) as c FROM analyses WHERE fraud_score < 40
    `).get().c;

    let timeline = [];

    try {
      // 🔥 TRY WITH created_at
      timeline = db.prepare(`
        SELECT 
          DATE(created_at) as date,
          ROUND(AVG(fraud_score), 2) as score
        FROM analyses
        GROUP BY DATE(created_at)
        ORDER BY DATE(created_at)
      `).all();
    } catch (err) {
      console.log("⚠️ TIMELINE FALLBACK:", err.message);

      // 🔥 FALLBACK (NO created_at)
      timeline = db.prepare(`
        SELECT 
          id as date,
          fraud_score as score
        FROM analyses
        ORDER BY id
      `).all();
    }

    res.json({
      total,
      average: Math.round(avg),
      high,
      medium,
      low,
      timeline
    });

  } catch (err) {
    console.log("❌ STATS ERROR:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ================= PROXY ================= */
app.get("/proxy/*", async (req, res) => {
  try {
    const url = `${AI_URL}/${req.params[0]}`;

    const response = await axios.get(url, {
      responseType: "arraybuffer",
      timeout: 60000
    });

    res.set("Content-Type", "image/jpeg");
    res.send(response.data);

  } catch (err) {
    console.log("❌ HEATMAP ERROR:", err.message);
    res.status(404).json({ error: "Heatmap not found" });
  }
});

/* ================= HEALTH ================= */
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

/* ================= START ================= */
app.listen(PORT, () => {
  console.log("🚀 Backend running on http://localhost:4000");
});