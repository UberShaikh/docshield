import React, { useState } from "react";
import styles from "./BatchResults.module.css";

const RISK_COLORS = { LOW: "#00e676", MEDIUM: "#ffd60a", HIGH: "#ff4d6d" };

export default function BatchResults({ data }) {
  const [selected, setSelected] = useState(null);
  const { results = [], count } = data;

  const high = results.filter((r) => r.risk_level === "HIGH").length;
  const med = results.filter((r) => r.risk_level === "MEDIUM").length;
  const low = results.filter((r) => r.risk_level === "LOW").length;
  const errors = results.filter((r) => r.error).length;

  return (
    <div className={styles.batch}>
      <div className={styles.header}>
        <div>
          <span className={styles.label}>BATCH ANALYSIS COMPLETE</span>
          <h1 className={styles.title}>{count} Documents Analyzed</h1>
        </div>
        <div className={styles.summary}>
          <Pill count={high} label="HIGH" color="#ff4d6d" />
          <Pill count={med} label="MED" color="#ffd60a" />
          <Pill count={low} label="LOW" color="#00e676" />
          {errors > 0 && <Pill count={errors} label="ERR" color="#888" />}
        </div>
      </div>

      <div className={styles.grid}>
        {results.map((r, i) => (
          <div
            key={i}
            className={`${styles.card} ${selected === i ? styles.selected : ""}`}
            onClick={() => setSelected(selected === i ? null : i)}
            style={{ borderColor: r.error ? "#555" : RISK_COLORS[r.risk_level] + "44" }}
          >
            <div className={styles.cardTop}>
              <span className={styles.cardName} title={r.filename}>
                {r.filename?.split("/").pop() || `File ${i + 1}`}
              </span>
              {r.error ? (
                <span className={styles.errorBadge}>ERROR</span>
              ) : (
                <span
                  className={styles.riskBadge}
                  style={{ color: RISK_COLORS[r.risk_level], borderColor: RISK_COLORS[r.risk_level] + "66" }}
                >
                  {r.risk_level}
                </span>
              )}
            </div>

            {!r.error && (
              <>
                <div className={styles.scoreRow}>
                  <span className={styles.scoreNum} style={{ color: RISK_COLORS[r.risk_level] }}>
                    {r.fraud_score}
                  </span>
                  <span className={styles.scoreDenom}>/100</span>
                  <div className={styles.scoreBar}>
                    <div
                      className={styles.scoreBarFill}
                      style={{
                        width: `${r.fraud_score}%`,
                        background: RISK_COLORS[r.risk_level],
                      }}
                    />
                  </div>
                </div>

                {selected === i && (
                  <div className={styles.expanded}>
                    <div className={styles.expandedFlags}>
                      {(r.reasons || []).slice(0, 4).map((reason, j) => (
                        <span key={j} className={styles.flag}>⚠ {reason.replace(/_/g, " ")}</span>
                      ))}
                      {(r.reasons || []).length === 0 && (
                        <span className={styles.okFlag}>✓ No flags</span>
                      )}
                    </div>
                    {r.heatmap_url && (
                      <img src={r.heatmap_url} alt="heatmap" className={styles.miniHeatmap} />
                    )}
                  </div>
                )}
              </>
            )}

            {r.error && (
              <p className={styles.errorMsg}>{r.error}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function Pill({ count, label, color }) {
  return (
    <div className={styles.pill} style={{ borderColor: color + "66", color }}>
      <span className={styles.pillCount}>{count}</span>
      <span className={styles.pillLabel}>{label}</span>
    </div>
  );
}
