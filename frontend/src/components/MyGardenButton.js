import { useNavigate } from "react-router-dom";
import FormButton from "../art/components/buttons.js"
export default function SignOutButton() {
  const navigate = useNavigate();
  const onMyGarden = () => {
    navigate("/MyGarden", { replace: false });
  };

  return (
      <FormButton btn_name="My Garden" on_click_method={onMyGarden}></FormButton>
  );
}
