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
  const [loading, setLoading] = useState(true);   // start loading until video is ready
  const navigate = useNavigate();

  const handleSubmitSignIn = async ({ username, password }) => {
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
        navigate("/welcome", { replace: true });
      }
    } catch (err) {
      console.error(err);
      alert("Can't log in!");
    }
    setOpenSignIn(false);
  };

  const handleSubmitSignUp = async ({ username, password }) => {
    try {
      const res = await axios.post("http://localhost:12345/api/signup", {
        name: username,
        password,
      });
      if (res.status === 200) {
        alert("Sign up successful!");
      } else {
        alert("Failed: " + res.status);
      }
    } catch (err) {
      console.error(err);
      alert("Failed to sign up!");
    }
    setOpenSignUp(false);
  };

  return (
    <div>
      <Background onReady={() => setLoading(false)} />
      {loading && <Loading text="Loading " />}

      <div className="container-fluid" style={{ position: "fixed", height: "100vh" }}>
        <div className="welcome-row">
          <Logo className="LogoWelcome" />
          <div className="welcome-text">
            <h1>Hi, my name is Zibi</h1>
            Zibi is a fictional character created for this website demo. Zibi represents a friendly guide to help users get started.
            zibi is nice. be more like zibi!
          </div>
        </div>

        <div className="welcomePageForm">
          <button className="sign-up-button" type="button" onClick={() => setOpenSignUp(true)}>
            Join Us
          </button>
          <button className="sign-in-button" type="button" onClick={() => setOpenSignIn(true)}>
            Sign In
          </button>
        </div>

        <PopupForm
          isOpen={openSignIn}
          onClose={() => setOpenSignIn(false)}
          onSubmit={handleSubmitSignIn}
          text="Zibi Sign In"
          submitButton={<button type="submit">Login</button>}
        />

        <PopupForm
          isOpen={openSignUp}
          onClose={() => setOpenSignUp(false)}
          onSubmit={handleSubmitSignUp}
          text="Zibi Sign Up"
          submitButton={<button type="submit">Sign Up</button>}
        />
      </div>
    </div>
  );
}
export default Home;
