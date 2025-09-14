import axios from "axios";
import { useNavigate } from "react-router-dom";
import FormButton from "../art/components/buttons.js"

export default function SignOutButton() {
  const navigate = useNavigate();

  const onSignOut = () => {
    localStorage.removeItem("token");
    delete axios.defaults.headers.common.Authorization;
    navigate("/signin", { replace: true });
  };

  return (
      <FormButton btn_name="Sign out" on_click_method={onSignOut}></FormButton>
  );
}
