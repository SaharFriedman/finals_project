import './App.css';
import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import Home from "./pages/Home";
import SignUp from "./pages/SignUp";
import SignIn from "./pages/SignIn";
import Test from "./pages/Test";
import P5Sketch from './components/P5Sketch';
import PictureDetect from './pages/MyGarden';


export async function isAuthenticated() {
  const t = localStorage.getItem('token');
  if (!t || t === 'undefined' || t === 'null') return false;
  try {
    await axios.get('http://localhost:12345/api/session', {
      headers: { Authorization: `Bearer ${t}` },
    });
    return true;
  } catch {
    return false;
  }
}
function RequireAuth({ children }) {
  const location = useLocation();
  const [state, setState] = useState('checking'); // 'checking' | 'ok' | 'nope'

  useEffect(() => {
    let mounted = true;
    (async () => {
      const ok = await isAuthenticated();
      if (!mounted) return;
      setState(ok ? 'ok' : 'nope');
      if (!ok) localStorage.removeItem('token');
    })();
    return () => { mounted = false; };
  }, []);

  if (state === 'checking') return <div style={{ padding: 16 }}>Checking session…</div>;
  if (state === 'nope') return <Navigate to="/signin" replace state={{ from: location }} />;
  return children;
}
function App() {
  const [token, setToken] = useState(() => localStorage.getItem('token') || '');
  useEffect(() => {
    if (token && token !== 'undefined' && token !== 'null') {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
  }, [token]);

  return (
    <div className="App">
      <Router>
        <Routes>
          {/* Public */}
          <Route path="/" element={<Home />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/signin" element={<SignIn setToken={setToken} />} />
          {/* Private */}
          <Route path="/analyse" element={<RequireAuth><P5Sketch /></RequireAuth>} />
          <Route path="/testing" element={<RequireAuth><Test /></RequireAuth>} />
          <Route path="/final" element={<RequireAuth><PictureDetect /></RequireAuth>} />
          {/* fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </div>
  );
}

export default App;
