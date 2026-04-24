import React, { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import styles from "./UploadZone.module.css";

const ACCEPTED = {
  "image/*": [".jpg", ".jpeg", ".png", ".bmp", ".tiff", ".webp"],
  "application/pdf": [".pdf"],
};

export default function UploadZone({ mode, onUploadSingle, onUploadBatch, loading, progress }) {
  const [files, setFiles] = useState([]);

  const onDrop = useCallback((accepted) => {
    if (mode === "single") {
      setFiles([accepted[0]]);
    } else {
      setFiles(accepted.slice(0, 10));
    }
  }, [mode]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED,
    multiple: mode === "batch",
    disabled: loading,
  });

  const handleAnalyze = () => {
    if (!files.length) return;
    if (mode === "single") onUploadSingle(files[0]);
    else onUploadBatch(files);
  };

  const removeFile = (i) => setFiles((f) => f.filter((_, idx) => idx !== i));

  return (
    <div className={styles.wrapper}>
      <div
        {...getRootProps()}
        className={`${styles.zone} ${isDragActive ? styles.active : ""} ${loading ? styles.disabled : ""}`}
      >
        <input {...getInputProps()} />
        <div className={styles.zoneContent}>
          <div className={styles.zoneIcon}>
            {isDragActive ? "⇩" : "⬡"}
          </div>
          <p className={styles.zoneTitle}>
            {isDragActive ? "Drop to analyze" : "Drop document here"}
          </p>
          <p className={styles.zoneSub}>
            {mode === "batch" ? "Up to 10 files" : "JPG, PNG, PDF supported"} · Click to browse
          </p>
        </div>
        {isDragActive && <div className={styles.dragOverlay} />}
      </div>

      {files.length > 0 && (
        <div className={styles.fileList}>
          <p className={styles.fileListLabel}>QUEUED FILES</p>
          {files.map((f, i) => (
            <div key={i} className={styles.fileItem}>
              <span className={styles.fileIcon}>{f.type === "application/pdf" ? "📄" : "🖼"}</span>
              <div className={styles.fileInfo}>
                <span className={styles.fileName}>{f.name}</span>
                <span className={styles.fileSize}>{(f.size / 1024).toFixed(1)} KB</span>
              </div>
              <button className={styles.fileRemove} onClick={() => removeFile(i)}>✕</button>
            </div>
          ))}
        </div>
      )}

      {loading && (
        <div className={styles.progressBar}>
          <div className={styles.progressFill} style={{ width: `${progress}%` }} />
        </div>
      )}

      <button
        className={styles.analyzeBtn}
        onClick={handleAnalyze}
        disabled={!files.length || loading}
      >
        {loading ? (
          <><span className={styles.spinner} /> Analyzing...</>
        ) : (
          <><span>⬡</span> {mode === "batch" ? `Analyze ${files.length || ""} Documents` : "Analyze Document"}</>
        )}
      </button>
    </div>
  );
}
