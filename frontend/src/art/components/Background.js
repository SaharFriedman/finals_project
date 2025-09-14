import "./components.css";
import bgVideo from "../assets/background_video.mp4"
export default function Background() {
  return (
    <div className="container-fluid background-video-container">
      <video autoPlay muted loop playsInline>
        <source src={bgVideo} type="video/mp4" />
      </video>
    </div>
  );
} 