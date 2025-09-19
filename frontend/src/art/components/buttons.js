import React from "react";
import "./components.css";


const FormButton = ({btn_name, on_click_method}) => {
    return (
        <>
            <button className="FormButton" onClick={on_click_method}>
                {btn_name}
            </button>
        </>
    );
};
export default FormButton;