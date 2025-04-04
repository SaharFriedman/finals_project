import React from "react";
function Home() {
    return (
        <div>
            <h2>
                WelcomePage
            </h2>
            <button className="sign-up-button" type="button" onClick={() => window.location.href = '/signup'}>
                Join Us
            </button>
        </div>
    )
}
export default Home