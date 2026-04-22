// db.js — SQLite database setup using better-sqlite3
const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

const DB_DIR = path.join(__dirname, "data");
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

const DB_PATH = path.join(DB_DIR, "docshield.db");
const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent performance
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// ── Schema ────────────────────────────────────────────────────────────────────
db.exec(`
  -- Users table
  CREATE TABLE IF NOT EXISTS users (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    username    TEXT    NOT NULL UNIQUE,
    email       TEXT    NOT NULL UNIQUE,
    password    TEXT    NOT NULL,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    last_login  TEXT
  );

  -- Sessions table (simple token-based auth)
  CREATE TABLE IF NOT EXISTS sessions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token       TEXT    NOT NULL UNIQUE,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    expires_at  TEXT    NOT NULL
  );

  -- Documents table (uploaded files metadata)
  CREATE TABLE IF NOT EXISTS documents (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id       INTEGER REFERENCES users(id) ON DELETE SET NULL,
    filename      TEXT    NOT NULL,
    original_name TEXT    NOT NULL,
    file_size     INTEGER NOT NULL,
    file_type     TEXT    NOT NULL,
    page_count    INTEGER NOT NULL DEFAULT 1,
    uploaded_at   TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  -- Analysis results table
  CREATE TABLE IF NOT EXISTS analyses (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    document_id      INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    user_id          INTEGER REFERENCES users(id) ON DELETE SET NULL,
    fraud_score      INTEGER NOT NULL,
    risk_level       TEXT    NOT NULL,
    ai_score         REAL    NOT NULL DEFAULT 0,
    tampering_score  REAL    NOT NULL DEFAULT 0,
    metadata_score   REAL    NOT NULL DEFAULT 0,
    ocr_score        REAL    NOT NULL DEFAULT 0,
    processing_time  REAL    NOT NULL DEFAULT 0,
    heatmap_url      TEXT,
    ocr_text         TEXT,
    metadata_json    TEXT,
    reasons_json     TEXT,
    analyzed_at      TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  -- Batch jobs table
  CREATE TABLE IF NOT EXISTS batch_jobs (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,
    total_files  INTEGER NOT NULL,
    high_risk    INTEGER NOT NULL DEFAULT 0,
    medium_risk  INTEGER NOT NULL DEFAULT 0,
    low_risk     INTEGER NOT NULL DEFAULT 0,
    error_count  INTEGER NOT NULL DEFAULT 0,
    created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  -- Batch job items (link batch → analyses)
  CREATE TABLE IF NOT EXISTS batch_items (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_job_id INTEGER NOT NULL REFERENCES batch_jobs(id) ON DELETE CASCADE,
    analysis_id  INTEGER REFERENCES analyses(id) ON DELETE SET NULL,
    filename     TEXT    NOT NULL,
    error        TEXT
  );

  -- Indexes for fast lookups
  CREATE INDEX IF NOT EXISTS idx_analyses_user    ON analyses(user_id);
  CREATE INDEX IF NOT EXISTS idx_analyses_doc     ON analyses(document_id);
  CREATE INDEX IF NOT EXISTS idx_analyses_score   ON analyses(fraud_score DESC);
  CREATE INDEX IF NOT EXISTS idx_analyses_date    ON analyses(analyzed_at DESC);
  CREATE INDEX IF NOT EXISTS idx_documents_user   ON documents(user_id);
  CREATE INDEX IF NOT EXISTS idx_sessions_token   ON sessions(token);
`);

// ── Prepared Statements ───────────────────────────────────────────────────────

// Users
const stmts = {
  // User CRUD
  createUser: db.prepare(`
    INSERT INTO users (username, email, password) VALUES (?, ?, ?)
  `),
  getUserByEmail: db.prepare(`SELECT * FROM users WHERE email = ?`),
  getUserByUsername: db.prepare(`SELECT * FROM users WHERE username = ?`),
  getUserById: db.prepare(`SELECT id, username, email, created_at, last_login FROM users WHERE id = ?`),
  updateLastLogin: db.prepare(`UPDATE users SET last_login = datetime('now') WHERE id = ?`),
  getAllUsers: db.prepare(`SELECT id, username, email, created_at, last_login FROM users ORDER BY created_at DESC`),

  // Sessions
  createSession: db.prepare(`
    INSERT INTO sessions (user_id, token, expires_at)
    VALUES (?, ?, datetime('now', '+7 days'))
  `),
  getSession: db.prepare(`
    SELECT s.*, u.id as uid, u.username, u.email
    FROM sessions s JOIN users u ON s.user_id = u.id
    WHERE s.token = ? AND s.expires_at > datetime('now')
  `),
  deleteSession: db.prepare(`DELETE FROM sessions WHERE token = ?`),
  cleanExpiredSessions: db.prepare(`DELETE FROM sessions WHERE expires_at <= datetime('now')`),

  // Documents
  insertDocument: db.prepare(`
    INSERT INTO documents (user_id, filename, original_name, file_size, file_type, page_count)
    VALUES (?, ?, ?, ?, ?, ?)
  `),
  getDocument: db.prepare(`SELECT * FROM documents WHERE id = ?`),
  getUserDocuments: db.prepare(`
    SELECT d.*, a.fraud_score, a.risk_level, a.analyzed_at
    FROM documents d
    LEFT JOIN analyses a ON a.document_id = d.id
    WHERE d.user_id = ?
    ORDER BY d.uploaded_at DESC
    LIMIT ? OFFSET ?
  `),

  // Analyses
  insertAnalysis: db.prepare(`
    INSERT INTO analyses
      (document_id, user_id, fraud_score, risk_level, ai_score, tampering_score,
       metadata_score, ocr_score, processing_time, heatmap_url, ocr_text, metadata_json, reasons_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),
  getAnalysis: db.prepare(`
    SELECT a.*, d.original_name, d.file_type, d.file_size
    FROM analyses a JOIN documents d ON a.document_id = d.id
    WHERE a.id = ?
  `),
  getAllAnalyses: db.prepare(`
    SELECT a.id, a.fraud_score, a.risk_level, a.ai_score, a.tampering_score,
           a.metadata_score, a.ocr_score, a.processing_time, a.heatmap_url,
           a.analyzed_at, a.reasons_json,
           d.original_name, d.file_type, d.file_size, d.page_count,
           u.username
    FROM analyses a
    JOIN documents d ON a.document_id = d.id
    LEFT JOIN users u ON a.user_id = u.id
    ORDER BY a.analyzed_at DESC
    LIMIT ? OFFSET ?
  `),
  getUserAnalyses: db.prepare(`
    SELECT a.id, a.fraud_score, a.risk_level, a.ai_score, a.tampering_score,
           a.metadata_score, a.ocr_score, a.processing_time, a.heatmap_url,
           a.analyzed_at, a.reasons_json,
           d.original_name, d.file_type, d.file_size, d.page_count
    FROM analyses a
    JOIN documents d ON a.document_id = d.id
    WHERE a.user_id = ?
    ORDER BY a.analyzed_at DESC
    LIMIT ? OFFSET ?
  `),
  deleteAnalysis: db.prepare(`DELETE FROM analyses WHERE id = ?`),

  // Stats
  globalStats: db.prepare(`
    SELECT
      COUNT(*)                                        AS total_analyses,
      COUNT(DISTINCT user_id)                         AS total_users,
      ROUND(AVG(fraud_score), 1)                      AS avg_fraud_score,
      SUM(CASE WHEN risk_level='HIGH'   THEN 1 ELSE 0 END) AS high_risk_count,
      SUM(CASE WHEN risk_level='MEDIUM' THEN 1 ELSE 0 END) AS medium_risk_count,
      SUM(CASE WHEN risk_level='LOW'    THEN 1 ELSE 0 END) AS low_risk_count,
      MAX(fraud_score)                                AS max_fraud_score,
      ROUND(AVG(processing_time), 2)                  AS avg_processing_time
    FROM analyses
  `),
  userStats: db.prepare(`
    SELECT
      COUNT(*)                                        AS total_analyses,
      ROUND(AVG(fraud_score), 1)                      AS avg_fraud_score,
      SUM(CASE WHEN risk_level='HIGH'   THEN 1 ELSE 0 END) AS high_risk_count,
      SUM(CASE WHEN risk_level='MEDIUM' THEN 1 ELSE 0 END) AS medium_risk_count,
      SUM(CASE WHEN risk_level='LOW'    THEN 1 ELSE 0 END) AS low_risk_count,
      MAX(fraud_score)                                AS max_fraud_score
    FROM analyses WHERE user_id = ?
  `),
  recentActivity: db.prepare(`
    SELECT a.fraud_score, a.risk_level, a.analyzed_at,
           d.original_name, u.username
    FROM analyses a
    JOIN documents d ON a.document_id = d.id
    LEFT JOIN users u ON a.user_id = u.id
    ORDER BY a.analyzed_at DESC
    LIMIT 10
  `),
  scoreTimeline: db.prepare(`
    SELECT date(analyzed_at) AS day,
           ROUND(AVG(fraud_score),1) AS avg_score,
           COUNT(*) AS count
    FROM analyses
    WHERE analyzed_at >= date('now', '-30 days')
    GROUP BY day
    ORDER BY day ASC
  `),

  // Batch jobs
  insertBatchJob: db.prepare(`
    INSERT INTO batch_jobs (user_id, total_files, high_risk, medium_risk, low_risk, error_count)
    VALUES (?, ?, ?, ?, ?, ?)
  `),
  insertBatchItem: db.prepare(`
    INSERT INTO batch_items (batch_job_id, analysis_id, filename, error)
    VALUES (?, ?, ?, ?)
  `),
  getBatchJobs: db.prepare(`
    SELECT * FROM batch_jobs
    ORDER BY created_at DESC LIMIT ? OFFSET ?
  `),
};

module.exports = { db, stmts };
