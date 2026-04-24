import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import styles from "./StatsPage.module.css";

const API = process.env.REACT_APP_API_URL || "http://localhost:4000";

export default function StatsPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API}/stats`)
      .then((r) => {
        const d = r.data;

        setStats({
          global: {
            total_analyses: d.total || 0,
            avg_fraud_score: d.average || 0,
            high_risk_count: d.high || 0,
            avg_processing_time: 0,
            total_users: 0,
            max_fraud_score: 100
          },

          riskDist: [
            { name: "HIGH", value: d.high || 0, color: "#ff4d6d" },
            { name: "MEDIUM", value: d.medium || 0, color: "#ffd60a" },
            { name: "LOW", value: d.low || 0, color: "#00e676" }
          ],

          // 🔥 FIX
          timeline: d.timeline || [],

          recent: [],
          batchJobs: []
        });
      })
      .catch((err) => {
        console.log("❌ STATS ERROR:", err);
        setStats(null);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className={styles.loading}>Loading stats...</div>;
  if (!stats) return <div className={styles.loading}>Stats unavailable</div>;

  const { global: g, riskDist, timeline } = stats;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <span className={styles.label}>DATABASE ANALYTICS</span>
        <h1 className={styles.title}>System Statistics</h1>
        <p className={styles.sub}>Live data from SQLite — docshield.db</p>
      </div>

      {/* KPI Cards */}
      <div className={styles.kpiGrid}>
        <KpiCard label="Total Analyses" value={g.total_analyses} icon="📊" accent="#00d4ff" />
        <KpiCard label="Avg Fraud Score" value={`${g.avg_fraud_score}/100`} icon="🎯" accent="#ffd60a" />
        <KpiCard label="High Risk Docs" value={g.high_risk_count} icon="🚨" accent="#ff4d6d" />
        <KpiCard label="Avg Process Time" value={`0s`} icon="⚡" accent="#00e676" />
        <KpiCard label="Unique Users" value={0} icon="👤" accent="#a78bfa" />
        <KpiCard label="Max Fraud Score" value={100} icon="📈" accent="#ff8c42" />
      </div>

      <div className={styles.chartsRow}>
        {/* 🔥 TIMELINE */}
        <div className={styles.chartCard}>
          <p className={styles.chartTitle}>FRAUD SCORE TREND</p>

          {timeline.length === 0 ? (
            <p className={styles.noData}>No timeline data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={timeline}>
                <XAxis dataKey="date" stroke="#888" />
                <YAxis stroke="#888" />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="#00d4ff"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Pie Chart */}
        <div className={styles.chartCard}>
          <p className={styles.chartTitle}>RISK DISTRIBUTION</p>

          {riskDist.every(r => r.value === 0) ? (
            <p className={styles.noData}>No analyses yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={riskDist}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={80}
                  label={({ name, percent }) =>
                    `${name} ${(percent * 100).toFixed(0)}%`
                  }
                >
                  {riskDist.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className={styles.bottomRow}>
        <div className={styles.tableCard}>
          <p className={styles.chartTitle}>RECENT ACTIVITY</p>
          <p className={styles.noData}>No recent activity</p>
        </div>

        <div className={styles.tableCard}>
          <p className={styles.chartTitle}>RECENT BATCH JOBS</p>
          <p className={styles.noData}>No batch jobs yet</p>
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