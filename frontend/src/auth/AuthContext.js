import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem("token") || "");
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem("user");
    try { return raw ? JSON.parse(raw) : null; } catch { return null; }
  });

  // persist session
  useEffect(() => {
    if (token) localStorage.setItem("token", token);
    else localStorage.removeItem("token");
  }, [token]);

  useEffect(() => {
    if (user) localStorage.setItem("user", JSON.stringify(user));
    else localStorage.removeItem("user");
  }, [user]);

  const login = async ({ name, password }) => {
    // your backend returns a TOKEN STRING from /api/token
    const res = await fetch("http://localhost:12345/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, password })
    });
    if (!res.ok) throw new Error("Invalid credentials");
    const tokenText = await res.text(); // because your controller returns a raw token string
    setToken(tokenText);
    // optional: fetch or remember the name
    setUser({ name });
  };

  const signup = async ({ name, password }) => {
    const res = await fetch("http://localhost:12345/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, password })
    });
    if (!res.ok) throw new Error("Signup failed");
    // after signup you can auto-login or redirect user to login page
  };

  const logout = () => {
    setToken("");
    setUser(null);
  };

  const value = useMemo(() => ({ token, user, login, signup, logout, isAuthed: !!token }), [token, user]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
