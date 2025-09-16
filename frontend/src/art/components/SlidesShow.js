import { useRef, useState } from "react";
import "./components.css";

export default function SlideShow({ slidesComponents = [], title = "" }) {
  const railRef = useRef(null);
  const [selected, setSelected] = useState(null);

  const scrollByAmount = (dir = 1) => {
    const el = railRef.current;
    if (!el) return;
    const amount = Math.floor(el.clientWidth * 0.9);
    el.scrollBy({ left: dir * amount, behavior: "smooth" });
  };

  return (
    <section className="nf-carousel">
      {title ? <h3 className="nf-title">{title}</h3> : null}

      <button
        className="nf-nav nf-nav-left"
        aria-label="Scroll left"
        style={{ height: "100%" }}
        onClick={() => scrollByAmount(-1)}
      >
        <svg xmlns="http://www.w3.org/2000/svg" height="48px" viewBox="0 -960 960 960" width="48px" fill="#ffffffff"><path d="M405-104 29-481l376-376 39 38-339 338 339 338-39 39Z" /></svg>
      </button>

      <div className="nf-rail" ref={railRef} tabIndex={0}>
        {slidesComponents.map((item, i) => (
          <div
            className="nf-card"
            key={i}
            title={item.text || "Open"}
            onClick={() => setSelected(item)}
          >
            <img
              src={item.photo}
              alt={item.text || `slide ${i + 1}`}
              loading="lazy"
              onError={(e) => {
                e.currentTarget.style.visibility = "hidden";
              }}
            />
            <div className="nf-overlay" />
            {item.text ? <div className="nf-caption">{item.text}</div> : null}
          </div>
        ))}
      </div>

      <button
        className="nf-nav nf-nav-right"
        aria-label="Scroll right"
        style={{ height: "100%" }}
        onClick={() => scrollByAmount(1)}
      >
        <svg xmlns="http://www.w3.org/2000/svg" height="48px" viewBox="0 -960 960 960" width="48px" fill="#ffffffff"><path d="m314-105-39-38 339-339-339-338 39-38 376 376-376 377Z" /></svg>
      </button>
      {selected && (
  <div className="modal-backdrop" onClick={() => setSelected(null)}>
    <div
      className="modal-content"
      onClick={e => e.stopPropagation()} // stop bubbling
    >
      <h3>{selected.text}</h3>
      <p>{selected.body}</p>
      <button className="modal-close" onClick={() => setSelected(null)}>
        Close
      </button>
    </div>
  </div>
)}
    </section>
  );
}
