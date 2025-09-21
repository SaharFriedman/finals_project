import './App.css';
import MyHelper from './pages/MyHelper';
import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import Home from "./pages/Home";
import MyGarden from './pages/MyGarden';
import WelcomePage from './pages/Welcome';

// checking if a user is connected.
export async function isAuthenticated() {
  const t = localStorage.getItem('token');
  if (!t || t === 'undefined' || t === 'null') return false;
  try {
    // contact the server API to validate token session
    await axios.get('http://localhost:12345/api/session', {
      headers: { Authorization: `Bearer ${t}` },
    });
    return true;
  } catch {
    return false;
  }
}

// in order to check connectivity, while loading the  current page and redirect otherwise
function RequireAuth({ children }) {
  const location = useLocation();
  const [state, setState] = useState('checking');

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
  if (state === 'nope') return <Navigate to="/" replace state={{ from: location }} />;
  return children;
}

function App() {
  return (
    <div className="App">
      <Router>
        <Routes>
          {/* Public */}
          <Route path="/" element={<Home />} />
          {/* Private */}
          <Route path="/MyGarden" element={<RequireAuth><MyGarden /></RequireAuth>} />
          <Route path="/welcome" element={<RequireAuth><WelcomePage /></RequireAuth>} />
          <Route path="/my-helper" element={<RequireAuth><MyHelper/></RequireAuth>} />
          {/* fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Router>
    </div>
  );
}

export default App;
