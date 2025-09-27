// Import necessary components and libraries
import Background from "../art/components/Background.js";
import React, { useState } from "react";
import "../art/components/components.css";
import { ReactComponent as Logo } from "../art/assets/LOGO_svg.svg";
import PopupForm from "../art/components/popupform.js";
import Loading from "../art/components/loading.js";
import axios from "axios";
import { useNavigate } from "react-router-dom";

// Home page component
function Home() {
  // State hooks for popup visibility, loading, and error messages
  const [openSignIn, setOpenSignIn] = useState(false); // Sign In popup
  const [openSignUp, setOpenSignUp] = useState(false); // Sign Up popup
  const [loading, setLoading] = useState(true); // Loading state for background
  const [signUpError, setSignUpError] = useState(""); // Error for sign up
  const [signInError, setSignInError] = useState(""); // Error for sign in
  const navigate = useNavigate(); // Navigation hook

  // Handle Sign In form submission
  const handleSubmitSignIn = async ({ username, password }) => {
    setSignInError(""); // Reset error
    try {
      // Send login request to backend
      const { data, status } = await axios.post(
        "http://localhost:12345/api/token",
        { name: username, password }
      );
      if (status === 200) {
        // On success, store token and set default header
        const token = typeof data === "string" ? data : data.token;
        if (!token) throw new Error("No token returned");
        localStorage.setItem("token", token);
        axios.defaults.headers.common.Authorization = `Bearer ${token}`;
        setOpenSignIn(false); // Close popup
        navigate("/welcome", { replace: true }); // Redirect to welcome page
      } else {
        setSignInError("Login failed. Status " + status); // Show error
      }
    } catch (err) {
      console.error(err);
      setSignInError("Invalid username or password"); // Show error
    }
  };

  // Handle Sign Up form submission
  const handleSubmitSignUp = async ({ username, password }) => {
    setSignUpError(""); // Reset error

    // Username restrictions: 3-20 chars, letters, numbers, underscore
    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
    if (!usernameRegex.test(username)) {
      setSignUpError("Username must be 3-20 chars, only letters, numbers, or underscore.");
      return;
    }
    // Password restrictions: min 8 chars, upper, lower, number, special char
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*]).{8,}$/;
    if (!passwordRegex.test(password)) {
      setSignUpError("Password must be at least 8 characters and include upper, lower, number, and special character.");
      return;
    }

    try {
      // Send signup request to backend
      const res = await axios.post("http://localhost:12345/api/signup", {
        name: username,
        password,
      });
      if (res.status === 200) {
        setSignUpError(""); // Clear error
        setOpenSignUp(false); // Close popup
        setSignInError(""); // Clear sign in error
      } else {
        setSignUpError("Signup failed. Status " + res.status); // Show error
      }
    } catch (err) {
      console.error(err);
      setSignUpError("Server error: " + (err?.response?.data || "Failed to sign up.")); // Show error
    }
  };

  // Render the Home page
  return (
    <div>
      {/* Background component, sets loading to false when ready */}
      <Background onReady={() => setLoading(false)} />
      {/* Show loading spinner while background loads */}
      {loading && <Loading text="Loading " />}

      <div className="container-fluid" style={{ position: "fixed", height: "100vh" }}>
        <div className="welcome-row">
          {/* Logo SVG */}
          <Logo className="LogoWelcome" />
          {/* Welcome text and project description */}
          <div className="welcome-text">
            <h1>Welcome to MyGarden!</h1>
            Welcome to our final project, created by Sahar Friedman and Adar Kliger. This project is designed to help users manage and track their garden with smart, interactive tools. By uploading photos, detecting plants, and keeping a record of growth and care,
            the system makes gardening more organized and engaging. We’re excited to share our work with you and hope you enjoy exploring the features we’ve built.
          </div>
        </div>

        {/* Buttons to open Sign Up and Sign In popups */}
        <div className="welcomePageForm">
          <button className="sign-up-button" type="button" onClick={() => {setOpenSignUp(true);setSignUpError("");}}>
            Join Us
          </button>
          <button className="sign-in-button" type="button" onClick={() => {setOpenSignIn(true);setSignInError("");}}>
            Sign In
          </button>
        </div>

        {/* Sign In popup form */}
        <PopupForm
          isOpen={openSignIn}
          onClose={() => setOpenSignIn(false)}
          onSubmit={handleSubmitSignIn}
          text="Sign In"
          submitButton={<button type="submit">Login</button>}
          errorText={signInError}
        />

        {/* Sign Up popup form */}
        <PopupForm
          isOpen={openSignUp}
          onClose={() => setOpenSignUp(false)}
          onSubmit={handleSubmitSignUp}
          text="Sign Up"
          submitButton={<button type="submit">Sign Up</button>}
          errorText={signUpError}
        />
      </div>
    </div>
  );
}

export default Home;
