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
  const location = useLocation(); // find the current page
  const [state, setState] = useState('checking'); // 'checking' | 'ok' | 'nope' defined states of validation

  useEffect(() => {
    let mounted = true;
    (async () => {
      const ok = await isAuthenticated(); // the user is verified
      if (!mounted) return;
      setState(ok ? 'ok' : 'nope'); // change the rendering state
      if (!ok) localStorage.removeItem('token'); // delete the current token if the user is not verified
    })();
    return () => { mounted = false; }; // unmount the program
  }, []);

  if (state === 'checking') return <div style={{ padding: 16 }}>Checking session…</div>; // wait for the check while loading the screen and change the rendering
  if (state === 'nope') return <Navigate to="/signin" replace state={{ from: location }} />; // unverified - go to login
  return children;
}
function App() {
  // find the token while starting the app to check for existence. 
  const token = useState(() => localStorage.getItem('token') || '');
  useEffect(() => {
    if (token && token !== 'undefined' && token !== 'null') {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token'); // cleanup
    }
  }, [token]); // run whenever token chagne

  return (
    <div className="App">
      <Router>
        <Routes>
          {/* Public */}
          <Route path="/" element={<Home />} />
          {/* Private */}
          <Route path="/MyGarden" element={<RequireAuth><MyGarden /></RequireAuth>} />
          <Route path="/welcome" element={<RequireAuth><WelcomePage /></RequireAuth>} />
          {/* fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
          <Route path="/my-helper" element={<MyHelper/>} />
      </Routes>
      </Router>
    </div>
  );
}

export default App;
