import Background from "../art/components/Background.js";
import React, { useState } from "react";
import "../art/components/components.css";
import { ReactComponent as Logo } from "../art/assets/LOGO_svg.svg";
import PopupForm from "../art/components/popupform.js";
import Loading from "../art/components/loading.js";
import axios from "axios";
import { useNavigate } from "react-router-dom";

function Home() {
  const [openSignIn, setOpenSignIn] = useState(false);
  const [openSignUp, setOpenSignUp] = useState(false);
  const [loading, setLoading] = useState(true);
  const [signUpError, setSignUpError] = useState("");
  const [signInError, setSignInError] = useState("");
  const navigate = useNavigate();

  const handleSubmitSignIn = async ({ username, password }) => {
    setSignInError("");
    try {
      const { data, status } = await axios.post(
        "http://localhost:12345/api/token",
        { name: username, password }
      );
      if (status === 200) {
        const token = typeof data === "string" ? data : data.token;
        if (!token) throw new Error("No token returned");
        localStorage.setItem("token", token);
        axios.defaults.headers.common.Authorization = `Bearer ${token}`;
        setOpenSignIn(false); // close on success
        navigate("/welcome", { replace: true });
      } else {
        setSignInError("Login failed. Status " + status);
      }
    } catch (err) {
      console.error(err);
      setSignInError("Invalid username or password");
    }
  };

  const handleSubmitSignUp = async ({ username, password }) => {
    setSignUpError("");

    // restrictions
    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
    if (!usernameRegex.test(username)) {
      setSignUpError("Username must be 3-20 chars, only letters, numbers, or underscore.");
      return;
    }
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*]).{8,}$/;
    if (!passwordRegex.test(password)) {
      setSignUpError("Password must be at least 8 characters and include upper, lower, number, and special character.");
      return;
    }

    try {
      const res = await axios.post("http://localhost:12345/api/signup", {
        name: username,
        password,
      });
      if (res.status === 200) {
        setSignUpError("");
        setOpenSignUp(false); // close on success
        setSignInError("");
      } else {
        setSignUpError("Signup failed. Status " + res.status);
      }
    } catch (err) {
      console.error(err);
      setSignUpError("Server error: " + (err?.response?.data || "Failed to sign up."));
    }
  };

  return (
    <div>
      <Background onReady={() => setLoading(false)} />
      {loading && <Loading text="Loading " />}

      <div className="container-fluid" style={{ position: "fixed", height: "100vh" }}>
        <div className="welcome-row">
          <Logo className="LogoWelcome" />
          <div className="welcome-text">
            <h1>Welcome to MyGarden!</h1>
          Welcome to our final project, created by Sahar Friedman and Adar Kliger. This project is designed to help users manage and track their garden with smart, interactive tools. By uploading photos, detecting plants, and keeping a record of growth and care,
          the system makes gardening more organized and engaging. We’re excited to share our work with you and hope you enjoy exploring the features we’ve built.
          </div>
        </div>

        <div className="welcomePageForm">
          <button className="sign-up-button" type="button" onClick={() => {setOpenSignUp(true);setSignUpError("");}}>
            Join Us
            
          </button>
          <button className="sign-in-button" type="button" onClick={() => {setOpenSignIn(true);setSignInError("");}}>
            Sign In
          </button>
        </div>

        {/* Correct usage: props on the component, error text as children */}
        <PopupForm
          isOpen={openSignIn}
          onClose={() => setOpenSignIn(false)}
          onSubmit={handleSubmitSignIn}
          text="Sign In"
          submitButton={<button type="submit">Login</button>}
            errorText={signInError}/>

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
