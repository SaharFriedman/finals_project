import React from "react";
import { useState } from "react";
import axios from 'axios';
function SignUp() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const handleSubmit = async (e) => {
        e.preventDefault();
        const formToJson = { name: username,password: password };
        try {
            const response = await axios.post("http://localhost:12345/api/signup", formToJson);
            if (response.status === 200) {
                alert("hazza");
            }
            else alert(response.status())
        } catch (err) {
            alert("failed to signup")
        }
    }
    return (
        <div>
            <h2>
                sign up page
            </h2>
            <form onSubmit={handleSubmit} className="signup-form">
                <input
                    type="text"
                    placeholder="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required >
                </input>
                <input
                    type="password"
                    placeholder="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required >
                </input>
                <button type="submit">Sign Up</button>
            </form>
        </div>
    )
}
export default SignUp