import React, { useState } from "react";
import {
  RadialBarChart, RadialBar, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
} from "recharts";
import styles from "./ResultPanel.module.css";

const RISK_COLORS = { LOW: "#00e676", MEDIUM: "#ffd60a", HIGH: "#ff4d6d" };

export default function ResultPanel({ result, preview }) {
  const [tab, setTab] = useState("overview");

  const riskColor = RISK_COLORS[result?.risk_level] || "#fff";

  const scoreData = [
    { name: "Score", value: result?.fraud_score || 0, fill: riskColor },
  ];

  const subScores = [
    { name: "AI Model", value: result?.ai_score || 0, max: 100, color: "#ff4d6d" },
    { name: "Tampering", value: result?.tampering_score || 0, max: 40, color: "#ff8c42" },
    { name: "Metadata", value: result?.metadata_score || 0, max: 20, color: "#ffd60a" },
    { name: "OCR", value: result?.ocr_score || 0, max: 10, color: "#00d4ff" },
  ];

  return (
    <div className={styles.panel}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.label}>ANALYSIS COMPLETE</span>
          <h1 className={styles.title}>Fraud Detection Report</h1>
          <p className={styles.meta}>
            {result?.page_count} page{result?.page_count !== 1 ? "s" : ""} ·{" "}
            {result?.processing_time}s processing time
          </p>
        </div>
        <div className={styles.riskBadge} style={{ borderColor: riskColor, color: riskColor }}>
          <span className={styles.riskDot} style={{ background: riskColor }} />
          {result?.risk_level} RISK
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        {["overview", "details", "heatmap", "ocr"].map((t) => (
          <button
            key={t}
            className={`${styles.tab} ${tab === t ? styles.tabActive : ""}`}
            onClick={() => setTab(t)}
          >
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className={styles.content}>
        {tab === "overview" && <OverviewTab result={result} scoreData={scoreData} subScores={subScores} riskColor={riskColor} />}
        {tab === "details" && <DetailsTab result={result} />}
        {tab === "heatmap" && <HeatmapTab result={result} preview={preview} />}
        {tab === "ocr" && <OcrTab result={result} />}
      </div>
    </div>
  );
}

function OverviewTab({ result, scoreData, subScores, riskColor }) {

  // 🔥 ONLY FIX ADDED
  const reasons = result?.reasons || [];

  return (
    <div className={styles.overview}>
      {/* Score gauge */}
      <div className={styles.gaugeCard}>
        <p className={styles.cardLabel}>FRAUD SCORE</p>
        <div className={styles.gauge}>
          <ResponsiveContainer width="100%" height={200}>
            <RadialBarChart
              cx="50%" cy="70%"
              innerRadius="70%" outerRadius="90%"
              startAngle={180} endAngle={0}
              data={[{ value: 100, fill: "var(--border)" }, ...scoreData]}
            >
              <RadialBar dataKey="value" cornerRadius={6} />
            </RadialBarChart>
          </ResponsiveContainer>
          <div className={styles.gaugeLabel}>
            <span className={styles.gaugeScore} style={{ color: riskColor }}>
              {result?.fraud_score}
            </span>
            <span className={styles.gaugeMax}>/100</span>
          </div>
        </div>
      </div>

      {/* Sub scores */}
      <div className={styles.subScoresCard}>
        <p className={styles.cardLabel}>COMPONENT SCORES</p>
        <div className={styles.subScoreList}>
          {subScores.map((s) => (
            <div key={s.name} className={styles.subScore}>
              <div className={styles.subScoreHeader}>
                <span className={styles.subScoreName}>{s.name}</span>
                <span className={styles.subScoreVal} style={{ color: s.color }}>
                  {s.value}<span className={styles.subScoreMax}>/{s.max}</span>
                </span>
              </div>
              <div className={styles.subScoreBar}>
                <div
                  className={styles.subScoreFill}
                  style={{
                    width: `${(s.value / s.max) * 100}%`,
                    background: s.color,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Reasons */}
      <div className={styles.reasonsCard}>
        {/* 🔥 FIXED */}
        <p className={styles.cardLabel}>DETECTION FLAGS ({reasons.length})</p>

        <div className={styles.reasonList}>
          {reasons.length === 0 ? (
            <p className={styles.noFlags}>✓ No suspicious indicators detected</p>
          ) : (
            reasons.map((r, i) => (
              <div key={i} className={styles.reason}>
                <span className={styles.reasonIcon}>⚠</span>
                <span className={styles.reasonText}>{r.replace(/_/g, " ")}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function DetailsTab({ result }) {
  const metaEntries = Object.entries(result?.metadata || {}).slice(0, 20);
  return (
    <div className={styles.details}>
      <div className={styles.detailCard}>
        <p className={styles.cardLabel}>EXIF / METADATA</p>
        {metaEntries.length === 0 ? (
          <p className={styles.noData}>No metadata found — possible strip or edit</p>
        ) : (
          <div className={styles.metaGrid}>
            {metaEntries.map(([k, v]) => (
              <div key={k} className={styles.metaRow}>
                <span className={styles.metaKey}>{k}</span>
                <span className={styles.metaVal}>{String(v).slice(0, 100)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={styles.detailCard}>
        <p className={styles.cardLabel}>RAW SCORES (NORMALIZED 0–1)</p>
        <div className={styles.rawScores}>
          <ScoreRow label="AI Model Score" value={result?.ai_score || 0} />
          <ScoreRow label="Tampering Score" value={result?.tampering_score || 0} />
          <ScoreRow label="Metadata Score" value={result?.metadata_score || 0} />
          <ScoreRow label="OCR Score" value={result?.ocr_score || 0} />
          <ScoreRow label="Final Fraud Score" value={(result?.fraud_score || 0) / 100} highlight />
        </div>
      </div>
    </div>
  );
}

function ScoreRow({ label, value, highlight }) {
  const pct = Math.round(value * 100);
  const color = pct > 66 ? "var(--high)" : pct > 33 ? "var(--med)" : "var(--low)";
  return (
    <div className={`${styles.scoreRow} ${highlight ? styles.scoreHighlight : ""}`}>
      <span className={styles.scoreLabel}>{label}</span>
      <span className={styles.scoreValue} style={{ color }}>{value.toFixed(3)}</span>
    </div>
  );
}

function HeatmapTab({ result, preview }) {
  return (
    <div className={styles.heatmapTab}>
      <p className={styles.heatmapNote}>
        Color overlay highlights suspicious regions. Red/orange indicates higher tampering probability.
      </p>
      <div className={styles.heatmapCompare}>
        {preview && (
          <div className={styles.heatmapPane}>
            <p className={styles.paneLabel}>ORIGINAL</p>
            <img src={preview} alt="original" className={styles.heatmapImg} />
          </div>
        )}
        <div className={styles.heatmapPane}>
          <p className={styles.paneLabel}>FRAUD HEATMAP</p>
          {result?.heatmap_url ? (
            <img src={result.heatmap_url} alt="heatmap" className={styles.heatmapImg} />
          ) : (
            <div className={styles.noHeatmap}>Heatmap unavailable</div>
          )}
        </div>
      </div>
    </div>
  );
}

function OcrTab({ result }) {
  return (
    <div className={styles.ocrTab}>
      <p className={styles.cardLabel}>EXTRACTED TEXT (OCR)</p>
      {result?.ocr_text ? (
        <pre className={styles.ocrText}>{result.ocr_text}</pre>
      ) : (
        <p className={styles.noData}>No text could be extracted from this document.</p>
      )}
    </div>
  );
}