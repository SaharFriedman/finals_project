// Background.js
import "./components.css";
import React, { memo, useEffect, useRef } from "react";
import bgVideo from "../assets/background_video.mp4";

export default memo( function Background({ onReady }) {
  const videoRef = useRef(null);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    let called = false;
    const done = () => {
      if (called) return;
      called = true;
      onReady && onReady();
    };

    v.addEventListener("canplaythrough", done, { once: true });
    v.addEventListener("loadeddata", done, { once: true });
    v.addEventListener("error", done, { once: true });

    return () => {
      v.removeEventListener("canplaythrough", done);
      v.removeEventListener("loadeddata", done);
      v.removeEventListener("error", done);
    };
  }, [onReady]);

  return (
    <div className="background-video-container" aria-hidden="true">
      <video
        ref={videoRef}             
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
      >
        <source src={bgVideo} type="video/mp4" />
      </video>
    </div>
  );
})
