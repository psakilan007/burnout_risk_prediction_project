import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { useAuth } from "../hooks/useAuth";
import BiometricScanner from "../components/BiometricScanner";
import "./Dashboard.css";

const API = process.env.REACT_APP_API_URL || "http://localhost:5000";
const riskColor = { Low: "#3ecf8e", Medium: "#f5c842", High: "#f06060" };

export default function StudentDashboard() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [scores, setScores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showScanner, setShowScanner] = useState(false);
  const [scanResult, setScanResult] = useState(null); // last scan result shown as a badge

  useEffect(() => {
    axios.get(`${API}/api/scores/mine`)
      .then((r) => setScores(r.data.reverse()))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // called when user clicks "Use these results" in the scanner
  const handleScanResult = (result) => {
    setScanResult(result);
    // navigate to check-in form and pre-fill via URL state
    nav("/checkin", {
      state: {
        prefill: {
          mood: result.moodScore,
          stressLevel: result.stressLevel,
        },
      },
    });
  };

  const latest = scores[scores.length - 1];
  const avg = scores.length
    ? (scores.reduce((s, x) => s + x.score, 0) / scores.length).toFixed(1)
    : null;

  return (
    <div className="dash-page">
      <header className="dash-header">
        <div className="dash-brand">
          <span className="brand-dot" />MindTrace
        </div>
        <div className="dash-user">
          <span>{user?.name}</span>
          <button onClick={logout} className="logout-btn">sign out</button>
        </div>
      </header>

      <main className="dash-main">
        <div className="dash-row">
          <div>
            <h1>Hey, {user?.name?.split(" ")[0]}.</h1>
            <p className="dash-sub">
              {new Date().toLocaleDateString("en-US", {
                weekday: "long", month: "long", day: "numeric",
              })}
            </p>
          </div>
          <div className="dash-actions">
            {/* ── SCAN BUTTON ── */}
            <button className="scan-trigger-btn" onClick={() => setShowScanner(true)}>
              <span className="scan-trigger-dot" />
              Face & Voice Scan
            </button>
            <button className="btn-primary checkin-btn" onClick={() => nav("/checkin")}>
              + Daily check-in
            </button>
          </div>
        </div>

        {/* last scan result banner */}
        {scanResult && (
          <div className="scan-banner">
            <span className="scan-banner-icon">◉</span>
            <span>
              Last scan detected <strong>{scanResult.dominantEmotion}</strong> —{" "}
              <span style={{ color: scanResult.fatigueColor }}>{scanResult.fatigueLevel} stress</span>.
              Mood & stress pre-filled in your check-in.
            </span>
            <button className="scan-banner-close" onClick={() => setScanResult(null)}>✕</button>
          </div>
        )}

        <div className="stat-grid">
          <div className="card stat-card">
            <p className="stat-label">Latest score</p>
            {latest ? (
              <>
                <p className="stat-big" style={{ color: riskColor[latest.riskLevel] }}>
                  {latest.score.toFixed(1)}
                </p>
                <span className={`tag ${latest.riskLevel.toLowerCase()}`}>{latest.riskLevel}</span>
              </>
            ) : <p className="stat-empty">no data yet</p>}
          </div>

          <div className="card stat-card">
            <p className="stat-label">7-day average</p>
            {avg
              ? <p className="stat-big">{avg}</p>
              : <p className="stat-empty">no data yet</p>}
          </div>

          <div className="card stat-card">
            <p className="stat-label">Check-ins logged</p>
            <p className="stat-big">{scores.length}</p>
          </div>
        </div>

        <div className="card chart-card">
          <p className="chart-title">Burnout score — last 30 days</p>
          {loading ? (
            <p className="loading-text">loading...</p>
          ) : scores.length < 2 ? (
            <p className="loading-text">submit a few check-ins to see your trend</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={scores}>
                <CartesianGrid stroke="#2a2a35" strokeDasharray="4 4" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: "#6b6b80", fontSize: 11 }}
                  axisLine={false} tickLine={false} />
                <YAxis domain={[0, 10]} tick={{ fill: "#6b6b80", fontSize: 11 }}
                  axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    background: "#18181f", border: "1px solid #2a2a35",
                    borderRadius: 8, fontFamily: "'DM Mono'",
                  }}
                  labelStyle={{ color: "#6b6b80" }}
                  itemStyle={{ color: "#7c6af7" }}
                />
                <Line type="monotone" dataKey="score" stroke="#7c6af7" strokeWidth={2}
                  dot={{ fill: "#7c6af7", r: 3 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card history-card">
          <p className="chart-title">Recent entries</p>
          {scores.length === 0 ? (
            <p className="loading-text">nothing yet — do your first check-in</p>
          ) : (
            <table className="history-table">
              <thead>
                <tr><th>Date</th><th>Score</th><th>Risk</th></tr>
              </thead>
              <tbody>
                {[...scores].reverse().slice(0, 10).map((s) => (
                  <tr key={s._id}>
                    <td>{s.date}</td>
                    <td>{s.score.toFixed(1)}</td>
                    <td>
                      <span className={`tag ${s.riskLevel.toLowerCase()}`}>{s.riskLevel}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>

      {/* scanner modal */}
      {showScanner && (
        <BiometricScanner
          onResult={handleScanResult}
          onClose={() => setShowScanner(false)}
        />
      )}
    </div>
  );
}
