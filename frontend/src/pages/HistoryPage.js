import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import styles from "./HistoryPage.module.css";

const API = process.env.REACT_APP_API_URL || "";
const RISK_COLOR = { HIGH: "#ff4d6d", MEDIUM: "#ffd60a", LOW: "#00e676" };

export default function HistoryPage() {
  const [analyses, setAnalyses] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const LIMIT = 12;

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API}/history?limit=${LIMIT}&offset=${offset}`);
      setAnalyses(data.analyses);
      setTotal(data.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [offset]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const openDetail = async (id) => {
    setSelected(id);
    setDetail(null);
    try {
      const { data } = await axios.get(`${API}/history/${id}`);
      setDetail(data);
    } catch {}
  };

  const deleteAnalysis = async (id) => {
    if (!window.confirm("Yeh analysis delete karni hai?")) return;
    setDeleting(id);
    try {
      await axios.delete(`${API}/history/${id}`);
      setAnalyses((prev) => prev.filter((a) => a.id !== id));
      if (selected === id) { setSelected(null); setDetail(null); }
    } catch (err) {
      alert(err.response?.data?.error || "Delete failed");
    } finally {
      setDeleting(null);
    }
  };

  const pages = Math.ceil(total / LIMIT);
  const currentPage = Math.floor(offset / LIMIT) + 1;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <span className={styles.label}>DATABASE RECORDS</span>
          <h1 className={styles.title}>Analysis History</h1>
          <p className={styles.sub}>{total} total records stored in SQLite</p>
        </div>
        <button className={styles.refreshBtn} onClick={fetchHistory}>⟳ Refresh</button>
      </div>

      <div className={styles.layout}>
        {/* List panel */}
        <div className={styles.listPanel}>
          {loading ? (
            <div className={styles.loadingList}>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className={styles.skeleton} style={{ animationDelay: `${i * 0.1}s` }} />
              ))}
            </div>
          ) : analyses.length === 0 ? (
            <div className={styles.empty}>
              <span>📂</span>
              <p>Koi history nahi mili</p>
              <small>Pehle koi document analyze karo</small>
            </div>
          ) : (
            <>
              {analyses.map((a) => (
                <div
                  key={a.id}
                  className={`${styles.card} ${selected === a.id ? styles.cardSelected : ""}`}
                  onClick={() => openDetail(a.id)}
                  style={{ borderLeftColor: RISK_COLOR[a.risk_level] }}
                >
                  <div className={styles.cardTop}>
                    <span className={styles.cardName} title={a.original_name}>
                      {a.original_name}
                    </span>
                    <span className={styles.cardScore} style={{ color: RISK_COLOR[a.risk_level] }}>
                      {a.fraud_score}
                    </span>
                  </div>
                  <div className={styles.cardMeta}>
                    <span className={styles.riskTag} style={{ color: RISK_COLOR[a.risk_level], borderColor: RISK_COLOR[a.risk_level] + "44" }}>
                      {a.risk_level}
                    </span>
                    <span className={styles.cardDate}>{formatDate(a.analyzed_at)}</span>
                    {a.username && <span className={styles.cardUser}>👤 {a.username}</span>}
                  </div>
                  <button
                    className={styles.deleteBtn}
                    onClick={(e) => { e.stopPropagation(); deleteAnalysis(a.id); }}
                    disabled={deleting === a.id}
                    title="Delete"
                  >
                    {deleting === a.id ? "..." : "✕"}
                  </button>
                </div>
              ))}

              {/* Pagination */}
              {pages > 1 && (
                <div className={styles.pagination}>
                  <button
                    className={styles.pageBtn}
                    disabled={offset === 0}
                    onClick={() => setOffset(Math.max(0, offset - LIMIT))}
                  >←</button>
                  <span className={styles.pageInfo}>{currentPage} / {pages}</span>
                  <button
                    className={styles.pageBtn}
                    disabled={offset + LIMIT >= total}
                    onClick={() => setOffset(offset + LIMIT)}
                  >→</button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Detail panel */}
        <div className={styles.detailPanel}>
          {!selected && (
            <div className={styles.detailEmpty}>
              <span>🔍</span>
              <p>Kisi record par click karo detail dekhne ke liye</p>
            </div>
          )}
          {selected && !detail && (
            <div className={styles.detailLoading}>Loading...</div>
          )}
          {detail && <DetailView data={detail} />}
        </div>
      </div>
    </div>
  );
}

function DetailView({ data }) {
  const riskColor = RISK_COLOR[data.risk_level] || "#fff";
  return (
    <div className={styles.detail}>
      <div className={styles.detailHeader}>
        <div>
          <p className={styles.detailFilename}>{data.original_name}</p>
          <p className={styles.detailMeta}>
            ID #{data.id} · {data.file_type?.toUpperCase()} · {(data.file_size / 1024).toFixed(1)} KB · {data.page_count} page(s)
          </p>
          <p className={styles.detailDate}>{formatDate(data.analyzed_at)}</p>
        </div>
        <div className={styles.detailScore} style={{ color: riskColor, borderColor: riskColor + "44" }}>
          <span className={styles.detailScoreNum}>{data.fraud_score}</span>
          <span className={styles.detailScoreLabel}>{data.risk_level}</span>
        </div>
      </div>

      {/* Score bars */}
      <div className={styles.scoreBars}>
        <ScoreBar label="AI Model"  value={data.ai_score}         max={1} color="#ff4d6d" pts={Math.round(data.ai_score * 40)} maxPts={40} />
        <ScoreBar label="Tampering" value={data.tampering_score}  max={1} color="#ff8c42" pts={Math.round(data.tampering_score * 30)} maxPts={30} />
        <ScoreBar label="Metadata"  value={data.metadata_score}   max={1} color="#ffd60a" pts={Math.round(data.metadata_score * 20)} maxPts={20} />
        <ScoreBar label="OCR"       value={data.ocr_score}        max={1} color="#00d4ff" pts={Math.round(data.ocr_score * 10)} maxPts={10} />
      </div>

      {/* Flags */}
      {data.reasons?.length > 0 && (
        <div className={styles.section}>
          <p className={styles.sectionTitle}>DETECTION FLAGS</p>
          <div className={styles.flags}>
            {data.reasons.map((r, i) => (
              <span key={i} className={styles.flag}>⚠ {r.replace(/_/g, " ")}</span>
            ))}
          </div>
        </div>
      )}

      {/* Heatmap */}
      {data.heatmap_url && (
        <div className={styles.section}>
          <p className={styles.sectionTitle}>FRAUD HEATMAP</p>
          <img src={data.heatmap_url} alt="heatmap" className={styles.heatmap} />
        </div>
      )}

      {/* Metadata */}
      {data.metadata && Object.keys(data.metadata).length > 0 && (
        <div className={styles.section}>
          <p className={styles.sectionTitle}>EXIF METADATA</p>
          <div className={styles.metaGrid}>
            {Object.entries(data.metadata).slice(0, 12).map(([k, v]) => (
              <div key={k} className={styles.metaRow}>
                <span className={styles.metaKey}>{k}</span>
                <span className={styles.metaVal}>{String(v).slice(0, 80)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* OCR text */}
      {data.ocr_text && (
        <div className={styles.section}>
          <p className={styles.sectionTitle}>OCR TEXT</p>
          <pre className={styles.ocrText}>{data.ocr_text}</pre>
        </div>
      )}
    </div>
  );
}

function ScoreBar({ label, value, color, pts, maxPts }) {
  return (
    <div className={styles.scoreBar}>
      <div className={styles.scoreBarHeader}>
        <span className={styles.scoreBarLabel}>{label}</span>
        <span className={styles.scoreBarPts} style={{ color }}>{pts}/{maxPts} pts</span>
      </div>
      <div className={styles.scoreBarBg}>
        <div className={styles.scoreBarFill} style={{ width: `${value * 100}%`, background: color }} />
      </div>
    </div>
  );
}

function formatDate(str) {
  if (!str) return "—";
  try {
    return new Date(str).toLocaleString("en-IN", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return str; }
}
