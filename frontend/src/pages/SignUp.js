import React from "react";
import { useState } from "react";
import axios from 'axios';

function SignUp() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    // this function verify that the user submitted the code properly
    const handleSubmit = async (e) => {
        // prevent refreshing the page upon submission
        e.preventDefault();
        // reformat to send to server
        const formToJson = { name: username,password: password };
        try {
            // recieve the server response to validate submition
            const response = await axios.post("http://localhost:12345/api/signup", formToJson);
            if (response.status === 200) {
                // refactor alert!
                alert("sign up successful");
            }
            // refactor alert!
            else alert(response.status())
        } catch (err) {
            // refactor alert!
            alert("failed to signup")
        }
    }
    return (
        <div>
            <h2>
                sign up page
            </h2>
            <div>
                {/* navigate to home button */}
                <button className="home-button" type="button" onClick={() => window.location.href = '/'} >
                    GO HOME
                    </button>
            </div>
            {/* submition form */}
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