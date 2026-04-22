const express = require("express");
const cors = require("cors");
const multer = require("multer");
const axios = require("axios");
const FormData = require("form-data");
const path = require("path");
const morgan = require("morgan");

const { db, stmts } = require("./db");
const { generateToken, hashPassword, verifyPassword, optionalAuth, requireAuth } = require("./auth");

const app = express();

// ENV
const PORT = process.env.PORT || 4000;
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";

// MIDDLEWARE
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

// ROOT
app.get("/", async (req, res) => {
  let aiStatus = "AI not reachable ❌";

  try {
    const response = await axios.get(`${AI_SERVICE_URL}/health`);
    if (response.data.status === "ok") aiStatus = "AI is running ✅";
  } catch {}

  res.json({
    status: "Backend running ✅",
    ai: aiStatus,
    message: "DocShield 🚀",
    endpoints: {
      analyze: "/analyze",
      history: "/history",
      health: "/health"
    }
  });
});

// SESSION CLEAN
setInterval(() => stmts.cleanExpiredSessions.run(), 60 * 60 * 1000);

// FILE UPLOAD
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

// AI CALL
async function forwardToAI(endpoint, file) {
  const form = new FormData();
  form.append("file", file.buffer, {
    filename: file.originalname,
    contentType: file.mimetype,
  });

  const response = await axios.post(`${AI_SERVICE_URL}${endpoint}`, form, {
    headers: form.getHeaders(),
    timeout: 120000,
  });

  return response.data;
}

// 🔥 HEATMAP FIX
function rewriteHeatmap(req, url) {
  if (!url) return null;
  return `${req.protocol}://${req.get("host")}/proxy${url}`;
}

// SAVE DB
function saveAnalysis(req, file, ai) {
  const userId = req.user?.id || null;

  const doc = stmts.insertDocument.run(
    userId,
    file.originalname,
    file.originalname,
    file.size,
    path.extname(file.originalname).replace(".", ""),
    1
  );

  const analysis = stmts.insertAnalysis.run(
    doc.lastInsertRowid,
    userId,
    ai.fraud_score,
    ai.risk_level,
    ai.ai_score || 0,
    ai.tampering_score || 0,
    ai.metadata_score || 0,
    ai.ocr_score || 0,
    ai.processing_time || 0,
    ai.heatmap_url || null,
    ai.ocr_text || "",
    JSON.stringify(ai.metadata || {}),
    JSON.stringify(ai.reasons || [])
  );

  return analysis.lastInsertRowid;
}

//
// 🔥 AUTH ROUTES
//

// REGISTER
app.post("/auth/register", (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password)
    return res.status(400).json({ error: "All fields required" });

  if (password.length < 6)
    return res.status(400).json({ error: "Password min 6 char" });

  try {
    const { stored } = hashPassword(password);

    const info = stmts.createUser.run(
      username.trim(),
      email.trim().toLowerCase(),
      stored
    );

    const token = generateToken();
    stmts.createSession.run(info.lastInsertRowid, token);

    res.json({ message: "User created ✅" });

  } catch (err) {
    if (err.message.includes("UNIQUE"))
      return res.status(409).json({ error: "User already exists" });

    res.status(500).json({ error: err.message });
  }
});

// LOGIN
app.post("/auth/login", (req, res) => {
  const { email, password } = req.body;

  const user = stmts.getUserByEmail.get(email.trim().toLowerCase());

  if (!user || !verifyPassword(password, user.password)) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const token = generateToken();
  stmts.createSession.run(user.id, token);

  res.json({ token, user });
});

//
// 🔥 ANALYZE (SINGLE)
//
app.post("/analyze", upload.single("file"), optionalAuth, async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  try {
    const ai = await forwardToAI("/analyze", req.file);

    console.log("🔥 AI RESPONSE:", ai);

    // ✅ HEATMAP FIX
    ai.heatmap_url = rewriteHeatmap(req, ai.heatmap_url);

    const id = saveAnalysis(req, req.file, ai);

    res.json({ ...ai, id });

  } catch (err) {
    console.log("❌ ERROR:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// 🔥 ANALYZE (BATCH)
//
app.post("/analyze-batch", upload.array("files", 10), optionalAuth, async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: "No files uploaded" });
  }

  const results = [];
  let highRisk = 0, medRisk = 0, lowRisk = 0, errors = 0;
  const userId = req.user?.id || null;

  // Process each file
  for (const file of req.files) {
    try {
      const ai = await forwardToAI("/analyze", file);
      
      // ✅ HEATMAP FIX
      ai.heatmap_url = rewriteHeatmap(req, ai.heatmap_url);

      // Save to database
      const id = saveAnalysis(req, file, ai);

      // Count risk levels
      if (ai.risk_level === "HIGH") highRisk++;
      else if (ai.risk_level === "MEDIUM") medRisk++;
      else lowRisk++;

      results.push({
        filename: file.originalname,
        fraud_score: ai.fraud_score,
        risk_level: ai.risk_level,
        heatmap_url: ai.heatmap_url,
        reasons: ai.reasons || [],
        error: null,
      });

    } catch (err) {
      errors++;
      results.push({
        filename: file.originalname,
        error: err.message,
      });
    }
  }

  // Create batch job record
  try {
    const batchInsert = stmts.insertBatchJob.run(
      userId,
      req.files.length,
      highRisk,
      medRisk,
      lowRisk,
      errors
    );

    console.log(`✅ Batch processed: ${req.files.length} files (${highRisk} HIGH, ${medRisk} MEDIUM, ${lowRisk} LOW, ${errors} errors)`);
  } catch (err) {
    console.error("Batch job record creation failed:", err.message);
  }

  res.json({
    results,
    count: req.files.length,
  });
});

// HISTORY
app.get("/history", (req, res) => {
  const limit = parseInt(req.query.limit) || 12;
  const offset = parseInt(req.query.offset) || 0;

  const analyses = stmts.getAllAnalyses.all(limit, offset);
  const countRow = db.prepare("SELECT COUNT(*) as total FROM analyses").get();

  res.json({
    analyses: analyses.map((a) => ({
      ...a,
      metadata: a.metadata_json ? JSON.parse(a.metadata_json) : {},
      reasons: a.reasons_json ? JSON.parse(a.reasons_json) : [],
    })),
    total: countRow.total,
  });
});

// HISTORY DETAIL
app.get("/history/:id", (req, res) => {
  const { id } = req.params;
  const analysis = db
    .prepare("SELECT * FROM analyses WHERE id = ?")
    .get(id);

  if (!analysis) return res.status(404).json({ error: "Analysis not found" });

  res.json({
    ...analysis,
    metadata: analysis.metadata_json ? JSON.parse(analysis.metadata_json) : {},
    reasons: analysis.reasons_json ? JSON.parse(analysis.reasons_json) : [],
  });
});

// DELETE HISTORY
app.delete("/history/:id", requireAuth, (req, res) => {
  const { id } = req.params;

  try {
    const analysis = db
      .prepare("SELECT * FROM analyses WHERE id = ?")
      .get(id);

    if (!analysis) return res.status(404).json({ error: "Not found" });
    if (analysis.user_id !== req.user.id && req.user.role !== "admin")
      return res.status(403).json({ error: "Forbidden" });

    db.prepare("DELETE FROM analyses WHERE id = ?").run(id);
    res.json({ message: "Deleted ✅" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// STATS
app.get("/stats", (req, res) => {
  try {
    const globalStats = db
      .prepare(`
        SELECT
          COUNT(*) as total_analyses,
          ROUND(AVG(fraud_score), 1) as avg_fraud_score,
          MAX(fraud_score) as max_fraud_score,
          SUM(CASE WHEN risk_level = 'HIGH' THEN 1 ELSE 0 END) as high_risk_count,
          SUM(CASE WHEN risk_level = 'MEDIUM' THEN 1 ELSE 0 END) as medium_risk_count,
          SUM(CASE WHEN risk_level = 'LOW' THEN 1 ELSE 0 END) as low_risk_count,
          ROUND(AVG(processing_time), 2) as avg_processing_time
        FROM analyses
      `)
      .get();

    const userCount = db
      .prepare("SELECT COUNT(DISTINCT user_id) as total_users FROM analyses")
      .get().total_users || 0;

    const riskDist = db
      .prepare(`
        SELECT
          risk_level as name,
          COUNT(*) as value
        FROM analyses
        GROUP BY risk_level
      `)
      .all();

    const timeline = db
      .prepare(`
        SELECT
          DATE(analyzed_at) as day,
          ROUND(AVG(fraud_score), 1) as avg_score,
          COUNT(*) as count
        FROM analyses
        WHERE analyzed_at >= datetime('now', '-30 days')
        GROUP BY DATE(analyzed_at)
        ORDER BY day
      `)
      .all();

    const recent = db
      .prepare(`
        SELECT
          documents.original_name,
          analyses.fraud_score,
          analyses.risk_level,
          users.username,
          analyses.analyzed_at
        FROM analyses
        LEFT JOIN documents ON analyses.document_id = documents.id
        LEFT JOIN users ON analyses.user_id = users.id
        ORDER BY analyses.analyzed_at DESC
        LIMIT 10
      `)
      .all();

    const riskDistWithColors = [
      { name: "HIGH", value: riskDist.find((r) => r.name === "HIGH")?.value || 0, color: "#ff4d6d" },
      { name: "MEDIUM", value: riskDist.find((r) => r.name === "MEDIUM")?.value || 0, color: "#ffd60a" },
      { name: "LOW", value: riskDist.find((r) => r.name === "LOW")?.value || 0, color: "#00e676" },
    ];

    res.json({
      global: { ...globalStats, total_users: userCount },
      riskDist: riskDistWithColors,
      timeline,
      recent,
      batchJobs: [],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// HEALTH
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// 🔥 PROXY (HEATMAP)
app.get("/proxy/*", async (req, res) => {
  try {
    const response = await axios.get(
      `${AI_SERVICE_URL}/${req.params[0]}`,
      { responseType: "arraybuffer" }
    );

    res.set("Content-Type", response.headers["content-type"]);
    res.send(response.data);

  } catch {
    res.status(404).json({ error: "Heatmap not found" });
  }
});

// ERROR HANDLER
app.use((err, req, res, next) => {
  res.status(400).json({ error: err.message });
});

// START
app.listen(PORT, () => {
  console.log(`\n🚀 Backend → http://localhost:${PORT}`);
  console.log(`🤖 AI → ${AI_SERVICE_URL}`);
  console.log(`🗄 DB → SQLite (data/docshield.db)\n`);
});