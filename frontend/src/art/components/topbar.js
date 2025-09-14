import "./components.css";
import "../components/buttons.js"   
import SignOutButton from "../../components/SignOutButton.js";
const TopBar = () =>(
    <div style={{
        width: "100vw",
        alignItems: "center",
        justifyContent: "center",
        display: "flex",
        paddingTop: "10px",
        paddingBottom: "10px" // corrected from paddingDown
    }}>
        <div className="TopBar">
            <div style={{width:"60%", alignItems: "center", justifyContent: "center", gap: "7px", display: "flex"}}>
                <img
                    style={{ width: "45px", height: "45px"}}
                    src={require("../assets/tahat.png")}
                    alt="Logo"
                />
                <SignOutButton />
                <SignOutButton />
                                <SignOutButton />
            </div>
            <div style={{width: "10%"}}></div>
            <div style={{width: "30%"}}>

                <SignOutButton />
            </div>
            

        </div>
    </div>
)

export default TopBar;