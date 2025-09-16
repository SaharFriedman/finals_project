import React, { useState } from "react";
import "./components.css";

export default function CustomFileUpload({
  label = "zibi",        // default button label
  onFileSelect,              // callback when file selected
}) {


  const handleChange = (e) => {
    const file = e.target.files[0];
    if (onFileSelect) {
      onFileSelect(file || null);
    }
  };

  return (
    <div className="custom-file-upload">
      <label className="upload-button">
        {label}
 <input
   type="file"
   accept="image/*"   // only allow images
   hidden
   onChange={handleChange}
 />
      </label>
    </div>
  );
}
