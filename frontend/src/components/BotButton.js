import { useNavigate } from "react-router-dom";
import FormButton from "../art/components/buttons.js"
export default function SignOutButton() {
  const navigate = useNavigate();
  const onMyHelper = () => {
    navigate("/My-helper", { replace: false });
  };

  return (
      <FormButton btn_name="Garden Bot" on_click_method={onMyHelper}></FormButton>
  );
}
