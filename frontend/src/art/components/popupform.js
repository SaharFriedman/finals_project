import React from "react";
import "./components.css";

export default function PopupForm({ 
  isOpen, 
  onClose, 
  onSubmit, 
  submitButton, 
  errorText = "",
  text 
}) {
  if (!isOpen) return null; // don’t render if closed

  const handleSubmit = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const username = formData.get("username");
    const password = formData.get("password");
    onSubmit({ username, password });
  };

  return (
    <div className="popup-overlay" onClick={onClose}>
      <div className="popup-container" onClick={(e) => e.stopPropagation()}>
        <form onSubmit={handleSubmit} className="popup-form">
          {text && <p className="popup-text">{text}</p>}

          <input
            type="text"
            name="username"
            placeholder="Username"
            required
          />
          <input
            type="password"
            name="password"
            placeholder="Password"
            required
          />
          {(errorText) && (
            <div
              className="popup-error">
              {errorText ? <p style={{ margin: 0 }}>{errorText}</p> : null}
            </div>
          )}
          <div className="popup-actions">
            {submitButton || <button type="submit">Submit</button>}
          </div>
        </form>
      </div>
    </div>
  );
}
