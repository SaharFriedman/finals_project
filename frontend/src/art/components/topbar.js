import "./components.css";
import "../components/buttons.js"   
import { Link } from "react-router-dom";
import SignOutButton from "../../components/SignOutButton.js";


import { ReactComponent as Logo } from "../assets/LOGO_svg.svg";
const TopBar = ({btn1,btn2,btn3,btn4}) =>(
    <div style={{
        width: "100vw",
        alignItems: "center",
        justifyContent: "center",
        display: "flex",
        paddingTop: "10px",
        paddingBottom: "10px"
    }}>
        <div className="TopBar">
            <div style={{width:"60%", alignItems: "center", justifyContent: "center", gap: "12px", display: "flex"}}>
                <Link to="/welcome">
                <Logo className="Logo" />
                </Link>
                {btn1}
                {btn2}
                {btn3}
                {btn4}
            </div>
            <div style={{width: "10%"}}></div>
            <div style={{width: "30%"}}>

                <SignOutButton />
            </div>
            

        </div>
    </div>
)

export default TopBar;