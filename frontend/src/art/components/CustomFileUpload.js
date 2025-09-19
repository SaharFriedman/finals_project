import React  from "react";
import "./components.css";

export default function CustomFileUpload({ label = "upload a file", onFileSelect }) {
  const fileInputRef = React.useRef(null);

  const handleChange = (e) => {
    const file = e.target.files[0];
    if (onFileSelect) onFileSelect(file || null);
  };

  return (
    <div>
      <button
        type="button"
        className="MyGardenSecondMenuButton"
        onClick={() => fileInputRef.current?.click()}
      >
        {label}
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={handleChange}
      />
    </div>
  );
}
