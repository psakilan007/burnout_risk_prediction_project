import React, { useState } from "react";
import axios from "axios";
import "./Login.css";

function Login({ showSignupPage, onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const loginUser = async (e) => {
    e.preventDefault();

    if (!email || !password) {
      alert("Please enter Email and Password");
      return;
    }

    try {
      setLoading(true);

      const response = await axios.post(
        "http://localhost:5000/api/auth/login",
        {
          email,
          password,
        }
      );

      // ✅ Save data (optional backup)
      localStorage.setItem("token", response.data.token);
      localStorage.setItem(
        "user",
        JSON.stringify(response.data.user)
      );

      alert("Login Successful");

      // ✅ IMPORTANT: send data to App.js (NO reload)
      if (onLogin) {
        onLogin(response.data.token, response.data.user);
      }

    } catch (error) {
      console.error(error);

      alert(
        error.response?.data?.message ||
          "Invalid Email or Password"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h1>Student Health Dashboard</h1>

        <h2>Sign In</h2>

        <form onSubmit={loginUser}>
          <label>Email</label>

          <input
            type="email"
            placeholder="Enter Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <label>Password</label>

          <input
            type="password"
            placeholder="Enter Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <button type="submit" disabled={loading}>
            {loading ? "Signing In..." : "Sign In"}
          </button>
        </form>

        <p className="signup-text">
          Don't have an account?{" "}
          <span
            onClick={showSignupPage}
            style={{
              color: "#007bff",
              cursor: "pointer",
              fontWeight: "bold",
            }}
          >
            Register Account
          </span>
        </p>
      </div>
    </div>
  );
}

export default Login;