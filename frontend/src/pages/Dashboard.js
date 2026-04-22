import React, { useState, useCallback } from "react";
import axios from "axios";
import UploadZone from "../components/UploadZone";
import ResultPanel from "../components/ResultPanel";
import BatchResults from "../components/BatchResults";
import styles from "./Dashboard.module.css";

const API = process.env.REACT_APP_API_URL || "";

export default function Dashboard() {
  const [mode, setMode] = useState("single"); // "single" | "batch"
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [batchResults, setBatchResults] = useState(null);
  const [error, setError] = useState(null);
  const [preview, setPreview] = useState(null);

  const handleSingleUpload = useCallback(async (file) => {
    setLoading(true);
    setError(null);
    setResult(null);
    setProgress(0);

    // Preview
    if (file.type.startsWith("image/")) {
      setPreview(URL.createObjectURL(file));
    } else {
      setPreview(null);
    }

    const form = new FormData();
    form.append("file", file);

    try {
      const res = await axios.post(`${API}/analyze`, form, {
        onUploadProgress: (e) => {
          setProgress(Math.round((e.loaded / e.total) * 40));
        },
      });
      setProgress(100);
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.error || "Analysis failed. Is the server running?");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleBatchUpload = useCallback(async (files) => {
    setLoading(true);
    setError(null);
    setBatchResults(null);
    setProgress(0);

    const form = new FormData();
    files.forEach((f) => form.append("files", f));

    try {
      const res = await axios.post(`${API}/analyze-batch`, form, {
        onUploadProgress: (e) => {
          setProgress(Math.round((e.loaded / e.total) * 50));
        },
      });
      setProgress(100);
      setBatchResults(res.data);
    } catch (err) {
      setError(err.response?.data?.error || "Batch analysis failed.");
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <main className={styles.dashboard}>
      {/* Left panel */}
      <section className={styles.left}>
        <div className={styles.modeToggle}>
          <button
            className={`${styles.modeBtn} ${mode === "single" ? styles.active : ""}`}
            onClick={() => { setMode("single"); setResult(null); setBatchResults(null); }}
          >
            Single Document
          </button>
          <button
            className={`${styles.modeBtn} ${mode === "batch" ? styles.active : ""}`}
            onClick={() => { setMode("batch"); setResult(null); setBatchResults(null); }}
          >
            Batch Analysis
          </button>
        </div>

        <UploadZone
          mode={mode}
          onUploadSingle={handleSingleUpload}
          onUploadBatch={handleBatchUpload}
          loading={loading}
          progress={progress}
        />

        {error && (
          <div className={styles.error}>
            <span className={styles.errorIcon}>⚠</span>
            {error}
          </div>
        )}

        {preview && !loading && (
          <div className={styles.previewBox}>
            <p className={styles.previewLabel}>DOCUMENT PREVIEW</p>
            <img src={preview} alt="preview" className={styles.previewImg} />
          </div>
        )}
      </section>

      {/* Right panel */}
      <section className={styles.right}>
        {!result && !batchResults && !loading && (
          <EmptyState />
        )}
        {loading && <LoadingState progress={progress} />}
        {result && !loading && (
          <ResultPanel result={result} preview={preview} />
        )}
        {batchResults && !loading && (
          <BatchResults data={batchResults} />
        )}
      </section>
    </main>
  );
}

function EmptyState() {
  return (
    <div className={styles.empty}>
      <div className={styles.emptyGrid}>
        {Array.from({ length: 16 }).map((_, i) => (
          <div key={i} className={styles.emptyCell} style={{ animationDelay: `${i * 0.1}s` }} />
        ))}
      </div>
      <div className={styles.emptyContent}>
        <div className={styles.emptyIcon}>⬡</div>
        <h2 className={styles.emptyTitle}>Awaiting Document</h2>
        <p className={styles.emptyText}>
          Upload a document to begin AI-powered fraud analysis using EfficientNet,
          OpenCV tampering detection, EXIF forensics, and OCR validation.
        </p>
        <div className={styles.emptyTags}>
          <span className={styles.tag}>EfficientNet</span>
          <span className={styles.tag}>OpenCV</span>
          <span className={styles.tag}>Tesseract OCR</span>
          <span className={styles.tag}>EXIF Forensics</span>
        </div>
      </div>
    </div>
  );
}

function LoadingState({ progress }) {
  const stages = [
    { label: "Uploading document", threshold: 40 },
    { label: "Running OCR extraction", threshold: 55 },
    { label: "Analyzing EXIF metadata", threshold: 65 },
    { label: "OpenCV tampering detection", threshold: 80 },
    { label: "EfficientNet AI inference", threshold: 90 },
    { label: "Generating heatmap", threshold: 96 },
    { label: "Computing fraud score", threshold: 100 },
  ];

  const currentStage = stages.findLast((s) => progress >= s.threshold - 14) || stages[0];

  return (
    <div className={styles.loading}>
      <div className={styles.loadingRing}>
        <svg viewBox="0 0 100 100" className={styles.loadingSvg}>
          <circle cx="50" cy="50" r="44" fill="none" stroke="var(--border)" strokeWidth="4" />
          <circle
            cx="50" cy="50" r="44" fill="none"
            stroke="var(--accent)" strokeWidth="4"
            strokeDasharray={`${2.76 * progress} 276`}
            strokeLinecap="round"
            transform="rotate(-90 50 50)"
            style={{ transition: "stroke-dasharray 0.4s ease" }}
          />
        </svg>
        <span className={styles.loadingPct}>{progress}%</span>
      </div>
      <p className={styles.loadingStage}>{currentStage.label}...</p>
      <div className={styles.loadingStages}>
        {stages.map((s, i) => (
          <div key={i} className={`${styles.stageItem} ${progress >= s.threshold - 14 ? styles.stageDone : ""}`}>
            <span className={styles.stageDot} />
            <span className={styles.stageLabel}>{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
