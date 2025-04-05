import React from "react";
import { useState } from "react";
import axios from 'axios';
import { useNavigate } from "react-router-dom";
function SignIn() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const navigate = useNavigate();
    let handleSubmit = async (e) => {
        e.preventDefault();
        const formToJson = { name: username, password: password };
        try {
            const answer = await axios.post("http://localhost:12345/api/token", formToJson);
            if (answer.status === 200) {
                alert("log in successful");
                navigate("/analyse");
            }
        } catch (err) {
            alert("can't log in!")
        }
    }

    return (
        <div>
            <h2>
                sign in page
            </h2>
            <div>
                <button className="home-button" type="button" onClick={() => window.location.href = '/'} >
                    GO HOME
                </button>
            </div>
            <form onSubmit={handleSubmit} className="signin-form">
                <input
                    type="text"
                    required
                    placeholder="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)} />
                <input
                    type="password"
                    required
                    value={password}
                    placeholder="password"
                    onChange={(e) => setPassword(e.target.value)} />
                <button type="submit">sign in</button>
            </form>
        </div>
    )
}
export default SignIn