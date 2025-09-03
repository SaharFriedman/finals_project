import axios from "axios";
import { useNavigate } from "react-router-dom";

export default function SignOutButton() {
  const navigate = useNavigate();

  const onSignOut = () => {
    localStorage.removeItem("token");
    delete axios.defaults.headers.common.Authorization;
    navigate("/signin", { replace: true });
  };

  return (
    <button onClick={onSignOut}>
      Sign out
    </button>
  );
}
