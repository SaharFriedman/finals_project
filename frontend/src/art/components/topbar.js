import "./components.css";
import "../components/buttons.js"   
import SignOutButton from "../../components/SignOutButton.js";
import MyGardenButton from "../../components/MyGardenButton.js";
import MyHelper from "../../components/BotButton.js";

import { ReactComponent as Logo } from "../assets/LOGO_svg.svg";
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
            <div style={{width:"60%", alignItems: "center", justifyContent: "center", gap: "12px", display: "flex"}}>
                <Logo className="Logo"/>
                <MyGardenButton />
                <MyHelper />
            </div>
            <div style={{width: "10%"}}></div>
            <div style={{width: "30%"}}>

                <SignOutButton />
            </div>
            

        </div>
    </div>
)

export default TopBar;