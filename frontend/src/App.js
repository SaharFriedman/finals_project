import './App.css';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from "./pages/Home"
import SignUp from "./pages/SignUp"
import SignIn from "./pages/SignIn"
import Test from "./pages/Test"
import P5Sketch from './components/P5Sketch';
function App() {
  return (
    <div className="App">
      <Router>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Home />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/signin" element={<SignIn />} />
          <Route path="/analyse" element={<P5Sketch />} />
          <Route path="/testing" element={<Test />} />
        </Routes>
      </Router>
    </div>
  );
}

export default App;
