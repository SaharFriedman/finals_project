import React from "react";
import { useState } from "react";
import axios from 'axios';
import { useNavigate } from "react-router-dom";
function Test() {
    const [imageFile, setImageFile] = useState(null);
    const [previewURL, setPreviewURL] = useState(null);
    const handleChange = (event) => {
        const file = event.target.files[0];
        if (file) {
            setImageFile(file);
            setPreviewURL(URL.createObjectURL(file));
        }
    };
    return (
        <div>
            <h3>Upload a plant photo</h3>
            <input
                type="file"
                accept="image/*"
                onChange={handleChange} />
            {previewURL && (
                <div style={{ marginTop: '10px' }}>
                    <img src={previewURL} alt="Uploaded preview" style={{ maxWidth: '300px' }} />
                </div>
            )}
            {imageFile && (
                <p>Image ready for upload: {imageFile.name}</p>
            )}
        </div>
    )
}
export default Test