import React, { useEffect, useState } from "react";
import axios from "axios";
import Login from "./Login";
import Signup from "./Signup";
import BiometricScanner from "./components/BiometricScanner";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

function App() {
  const [student, setStudent] = useState(null);
  const [burnout, setBurnout] = useState(null);
  const [showSignup, setShowSignup] = useState(false);

  const [token, setToken] = useState(
    localStorage.getItem("token")
  );

  const [loading, setLoading] = useState(true);

  // Scanner states
  const [showScanner, setShowScanner] = useState(false);
  const [scanResult, setScanResult] = useState(null);

  // ======================
  // LOGIN
  // ======================
  const handleLogin = (newToken, user) => {
    localStorage.setItem("token", newToken);
    localStorage.setItem("user", JSON.stringify(user));
    setToken(newToken);
  };

  // ======================
  // SCANNER RESULT
  // ======================
  const handleScanResult = (result) => {
    console.log("Scan Result:", result);

    setScanResult(result);

    setShowScanner(false);
  };

  // ======================
  // LOGOUT
  // ======================
  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    setToken(null);
    setStudent(null);
    setBurnout(null);
    setScanResult(null);
  };

  // ======================
  // FETCH DATA
  // ======================
  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        const studentResponse = await axios.get(
          "http://localhost:5000/api/student/latest",
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        setStudent(studentResponse.data);
      } catch (error) {
        console.error(
          "Student Error:",
          error.response?.data || error.message
        );
      }

      try {
        const burnoutResponse = await axios.get(
          "http://localhost:5000/api/burnout/predict",
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        setBurnout(burnoutResponse.data);
      } catch (error) {
        console.error(
          "Burnout Error:",
          error.response?.data || error.message
        );
      }

      setLoading(false);
    };

    fetchData();
  }, [token]);

  // ======================
  // CHART DATA
  // ======================
  const chartData = [
    { day: "Mon", heartRate: 78 },
    { day: "Tue", heartRate: 81 },
    { day: "Wed", heartRate: 76 },
    { day: "Thu", heartRate: 79 },
    { day: "Fri", heartRate: 83 },
    { day: "Sat", heartRate: 77 },
    { day: "Sun", heartRate: 80 },
  ];

  // ======================
  // LOGIN / SIGNUP
  // ======================
  if (!token) {
    return showSignup ? (
      <div>
        <Signup />

        <div
          style={{
            textAlign: "center",
            marginTop: "15px",
          }}
        >
          <span
            onClick={() => setShowSignup(false)}
            style={{
              color: "#007bff",
              cursor: "pointer",
              fontWeight: "bold",
            }}
          >
            Already have an account? Sign In
          </span>
        </div>
      </div>
    ) : (
      <Login
        showSignupPage={() => setShowSignup(true)}
        onLogin={handleLogin}
      />
    );
  }

  // ======================
  // LOADING
  // ======================
  if (loading) {
    return (
      <div
        style={{
          padding: "50px",
          textAlign: "center",
        }}
      >
        <h2>Loading Dashboard...</h2>
      </div>
    );
  }

  // ======================
  // DASHBOARD
  // ======================
  return (
    <div
      style={{
        padding: "20px",
        backgroundColor: "#f4f6f9",
        minHeight: "100vh",
        fontFamily: "Arial",
      }}
    >
      {/* HEADER */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "20px",
        }}
      >
        <div>
          <h1>🔥 Student Health Dashboard</h1>

          <button
            onClick={() => setShowScanner(true)}
            style={{
              padding: "10px 20px",
              backgroundColor: "#4f46e5",
              color: "white",
              border: "none",
              borderRadius: "5px",
              cursor: "pointer",
            }}
          >
            📷 Face & Voice Scan
          </button>
        </div>

        <button
          onClick={logout}
          style={{
            padding: "10px 20px",
            backgroundColor: "red",
            color: "white",
            border: "none",
            borderRadius: "5px",
            cursor: "pointer",
          }}
        >
          Logout
        </button>
      </div>

      {/* SCAN RESULT */}
      {scanResult && (
        <div
          style={{
            background: "white",
            padding: "20px",
            borderRadius: "10px",
            marginBottom: "20px",
          }}
        >
          <h2>🧠 Biometric Analysis</h2>

          <p>
            <strong>Emotion:</strong>{" "}
            {scanResult.dominantEmotion}
          </p>

          <p>
            <strong>Stress Level:</strong>{" "}
            {scanResult.stressLevel}/10
          </p>

          <p>
            <strong>Mood Score:</strong>{" "}
            {scanResult.moodScore}/5
          </p>

          <p>
            <strong>Fatigue Level:</strong>{" "}
            {scanResult.fatigueLevel}
          </p>
        </div>
      )}

      {/* HEALTH CARDS */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit,minmax(220px,1fr))",
          gap: "20px",
          marginBottom: "30px",
        }}
      >
        <div style={cardStyle}>
          <h3>❤️ Heart Rate</h3>
          <h1>{student?.heartRate ?? 0} BPM</h1>
        </div>

        <div style={cardStyle}>
          <h3>💓 Resting HR</h3>
          <h1>{student?.restingHR ?? 0} BPM</h1>
        </div>

        <div style={cardStyle}>
          <h3>📈 HRV</h3>
          <h1>{student?.hrv ?? 0} ms</h1>
        </div>

        <div style={cardStyle}>
          <h3>🫁 SpO₂</h3>
          <h1>{student?.spo2 ?? 0}%</h1>
        </div>
      </div>

      {/* BURNOUT */}
      <div style={sectionStyle}>
        <h2>🔥 Burnout Prediction</h2>
        <h3>Risk Level: {burnout?.risk || "Unknown"}</h3>
        <h3>Burnout Score: {burnout?.score || 0}/100</h3>
      </div>

      {/* GRAPH */}
      <div style={sectionStyle}>
        <h2>Heart Rate Trend</h2>

        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="day" />
            <YAxis />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="heartRate"
              stroke="#ff4d4f"
              strokeWidth={3}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* EXTRA INFO */}
      <div style={sectionStyle}>
        <h2>Additional Health Metrics</h2>

        <p>
          <strong>Name:</strong>{" "}
          {student?.name ?? "No Data"}
        </p>

        <p>
          <strong>Sleep Hours:</strong>{" "}
          {student?.sleepHours ?? 0} hrs
        </p>

        <p>
          <strong>Steps:</strong>{" "}
          {student?.steps ?? 0}
        </p>
      </div>

      {/* SCANNER MODAL */}
      {showScanner && (
        <BiometricScanner
          onResult={handleScanResult}
          onClose={() => setShowScanner(false)}
        />
      )}
    </div>
  );
}

const cardStyle = {
  background: "white",
  padding: "20px",
  borderRadius: "10px",
  textAlign: "center",
};

const sectionStyle = {
  background: "white",
  padding: "20px",
  borderRadius: "10px",
  marginBottom: "30px",
};

export default App;