import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";

export default function RequireAuth({ children }) {
  const { isAuthed } = useAuth();
  const location = useLocation();

  if (!isAuthed) {
    // redirect to login, keep where we came from
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return children;
}
