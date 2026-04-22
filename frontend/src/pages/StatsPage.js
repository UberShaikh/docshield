import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import styles from "./StatsPage.module.css";

const API = process.env.REACT_APP_API_URL || "";

export default function StatsPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API}/stats`)
      .then((r) => setStats(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className={styles.loading}>Loading stats...</div>;
  if (!stats) return <div className={styles.loading}>Stats unavailable</div>;

  const { global: g, riskDist, timeline, recent, batchJobs } = stats;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <span className={styles.label}>DATABASE ANALYTICS</span>
        <h1 className={styles.title}>System Statistics</h1>
        <p className={styles.sub}>Live data from SQLite — docshield.db</p>
      </div>

      {/* KPI Cards */}
      <div className={styles.kpiGrid}>
        <KpiCard label="Total Analyses" value={g.total_analyses || 0} icon="📊" accent="#00d4ff" />
        <KpiCard label="Avg Fraud Score" value={`${g.avg_fraud_score || 0}/100`} icon="🎯" accent="#ffd60a" />
        <KpiCard label="High Risk Docs" value={g.high_risk_count || 0} icon="🚨" accent="#ff4d6d" />
        <KpiCard label="Avg Process Time" value={`${g.avg_processing_time || 0}s`} icon="⚡" accent="#00e676" />
        <KpiCard label="Unique Users" value={g.total_users || 0} icon="👤" accent="#a78bfa" />
        <KpiCard label="Max Fraud Score" value={g.max_fraud_score || 0} icon="📈" accent="#ff8c42" />
      </div>

      <div className={styles.chartsRow}>
        {/* Fraud Score Timeline */}
        <div className={styles.chartCard}>
          <p className={styles.chartTitle}>FRAUD SCORE TREND (Last 30 Days)</p>
          {timeline.length === 0 ? (
            <p className={styles.noData}>No timeline data yet — analyze more documents</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={timeline}>
                <XAxis dataKey="day" tick={{ fontFamily: "Space Mono", fontSize: 10, fill: "#6b8fa8" }} tickFormatter={(d) => d.slice(5)} />
                <YAxis domain={[0, 100]} tick={{ fontFamily: "Space Mono", fontSize: 10, fill: "#6b8fa8" }} />
                <Tooltip
                  contentStyle={{ background: "var(--surface2)", border: "1px solid var(--border)", fontFamily: "Space Mono", fontSize: 11 }}
                  formatter={(v) => [`${v}`, "Avg Score"]}
                />
                <Line type="monotone" dataKey="avg_score" stroke="#00d4ff" strokeWidth={2} dot={{ fill: "#00d4ff", r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Risk Distribution Pie */}
        <div className={styles.chartCard}>
          <p className={styles.chartTitle}>RISK DISTRIBUTION</p>
          {riskDist.every((r) => r.value === 0) ? (
            <p className={styles.noData}>No analyses yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={riskDist} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                  {riskDist.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "var(--surface2)", border: "1px solid var(--border)", fontFamily: "Space Mono", fontSize: 11 }} />
                <Legend wrapperStyle={{ fontFamily: "Space Mono", fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className={styles.bottomRow}>
        {/* Recent Activity */}
        <div className={styles.tableCard}>
          <p className={styles.chartTitle}>RECENT ACTIVITY</p>
          {recent.length === 0 ? (
            <p className={styles.noData}>No recent activity</p>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Document</th>
                  <th>Score</th>
                  <th>Risk</th>
                  <th>User</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((r, i) => (
                  <tr key={i}>
                    <td className={styles.tdName} title={r.original_name}>{r.original_name}</td>
                    <td style={{ color: r.fraud_score >= 70 ? "#ff4d6d" : r.fraud_score >= 40 ? "#ffd60a" : "#00e676", fontFamily: "var(--font-mono)", fontWeight: 700 }}>
                      {r.fraud_score}
                    </td>
                    <td>
                      <span className={styles.riskBadge} style={{ color: r.risk_level === "HIGH" ? "#ff4d6d" : r.risk_level === "MEDIUM" ? "#ffd60a" : "#00e676" }}>
                        {r.risk_level}
                      </span>
                    </td>
                    <td className={styles.tdMuted}>{r.username || "Guest"}</td>
                    <td className={styles.tdMuted}>{formatDate(r.analyzed_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Batch Jobs */}
        <div className={styles.tableCard}>
          <p className={styles.chartTitle}>RECENT BATCH JOBS</p>
          {batchJobs.length === 0 ? (
            <p className={styles.noData}>No batch jobs yet</p>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Job #</th>
                  <th>Files</th>
                  <th>High</th>
                  <th>Med</th>
                  <th>Low</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {batchJobs.map((b) => (
                  <tr key={b.id}>
                    <td style={{ fontFamily: "var(--font-mono)", color: "var(--accent)" }}>#{b.id}</td>
                    <td style={{ fontFamily: "var(--font-mono)" }}>{b.total_files}</td>
                    <td style={{ color: "#ff4d6d", fontFamily: "var(--font-mono)" }}>{b.high_risk}</td>
                    <td style={{ color: "#ffd60a", fontFamily: "var(--font-mono)" }}>{b.medium_risk}</td>
                    <td style={{ color: "#00e676", fontFamily: "var(--font-mono)" }}>{b.low_risk}</td>
                    <td className={styles.tdMuted}>{formatDate(b.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, icon, accent }) {
  return (
    <div className={styles.kpiCard} style={{ borderColor: accent + "33" }}>
      <span className={styles.kpiIcon}>{icon}</span>
      <span className={styles.kpiValue} style={{ color: accent }}>{value}</span>
      <span className={styles.kpiLabel}>{label}</span>
    </div>
  );
}

function formatDate(str) {
  if (!str) return "—";
  try { return new Date(str).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }); }
  catch { return str; }
}
