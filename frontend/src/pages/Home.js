function Home() {
    return (
        <div>
            <h2>
                WelcomePage
            </h2>
            <button className="sign-up-button" type="button" onClick={() => window.location.href = '/signup'}>
                Join Us
            </button>
            <button className="sign-in-button" type="button" onClick={() => window.location.href = '/signin'}>
                sign in
            </button>
        </div>
    )
}
export default Home