import React, { useState } from "react";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import Dashboard from "./pages/Dashboard";
import HistoryPage from "./pages/HistoryPage";
import StatsPage from "./pages/StatsPage";
import AuthModal from "./components/AuthModal";
import styles from "./App.module.css";

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}

function AppInner() {
  const [page, setPage] = useState("analyze");
  const [showAuth, setShowAuth] = useState(false);
  const { user, logout } = useAuth();

  // 🔥 SAFE PAGE RENDER
  const renderPage = () => {
    try {
      if (page === "analyze") return <Dashboard />;
      if (page === "history") return <HistoryPage />;
      if (page === "stats") return <StatsPage />;
      return <Dashboard />;
    } catch (err) {
      console.error("Page error:", err);
      return <div style={{ color: "red" }}>Something went wrong</div>;
    }
  };

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <div className={styles.logo}>
          <span className={styles.logoIcon}>⬡</span>
          <span className={styles.logoText}>DocShield</span>
          <span className={styles.logoBadge}>AI</span>
        </div>

        <nav className={styles.nav}>
          {[
            { key: "analyze", label: "⬡ Analyze" },
            { key: "history", label: "📂 History" },
            { key: "stats", label: "📊 Stats" },
          ].map((n) => (
            <button
              key={n.key}
              className={`${styles.navBtn} ${
                page === n.key ? styles.navActive : ""
              }`}
              onClick={() => setPage(n.key)}
            >
              {n.label}
            </button>
          ))}
        </nav>

        <div className={styles.headerRight}>
          {user ? (
            <div className={styles.userArea}>
              <span className={styles.userInfo}>👤 {user.username}</span>
              <button className={styles.logoutBtn} onClick={logout}>
                Logout
              </button>
            </div>
          ) : (
            <button
              className={styles.loginBtn}
              onClick={() => setShowAuth(true)}
            >
              Login / Register
            </button>
          )}

          <div className={styles.status}>
            <span className={styles.pulse} />
            <span className={styles.statusText}>ONLINE</span>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        {renderPage()}
      </main>

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </div>
  );
}