import React, { useState } from "react";
import axios from "axios";
import { useNavigate, useLocation } from "react-router-dom";

function SignIn() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();
  const location = useLocation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const { data, status } = await axios.post(
        "http://localhost:12345/api/token",
        { name: username, password }
      );
      if (status === 200) {
        // Your backend returns a raw string token.
        const token = typeof data === "string" ? data : data.token;
        if (!token) throw new Error("No token returned");

        localStorage.setItem("token", token);

        // Optional: make axios send the token automatically from now on
        axios.defaults.headers.common.Authorization = `Bearer ${token}`;

        // Go back to the protected page user originally wanted, or /final
        const from = location.state?.from?.pathname || "/final";
        navigate(from, { replace: true });
      }
    } catch (err) {
      console.error(err);
      alert("can't log in!");
    }
  };

  return (
    <div>
      <h2>sign in page</h2>
      <div>
        <button
          className="home-button"
          type="button"
          onClick={() => (window.location.href = "/")}
        >
          GO HOME
        </button>
      </div>

      <form onSubmit={handleSubmit} className="signin-form">
        <input
          type="text"
          required
          placeholder="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <input
          type="password"
          required
          placeholder="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button type="submit">sign in</button>
      </form>
    </div>
  );
}

export default SignIn;
