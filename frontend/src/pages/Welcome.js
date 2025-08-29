import React from "react";
import SignOutButton from "../components/SignOutButton";
function Home() {
    return (
        <div>
            <h2>
                WelcomePage
            </h2>
            <h3> welcome to the best website ever</h3>
            <button className="my-garden-button" type="button" onClick={() => window.location.href = '/MyGarden'}>
                enter your gardens
            </button>
            <SignOutButton />
        </div>
    )
}
export default Home