import React, { useEffect, useMemo, useRef, useState } from "react";
import "./components.css";
export default function SelectAreaDropdown({
  areas = [],
  value = "",
  onChange,
  placeholder = "Select area…",
  className = "",
}) {
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const rootRef = useRef(null);

  const items = useMemo(() => {
    return areas
      .map(a => {
        const id = a.area_id || a._id || a.id || a.areaId;
        return { id: String(id), label: a.name || a.area_name || "Area" };
      })
      .filter(x => x.id);
  }, [areas]);

  const selected = items.find(i => i.id === String(value));

  // close on outside click
  useEffect(() => {
    const onDocClick = e => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  // keyboard nav when open
  const onKeyDown = e => {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        setOpen(true);
        setActiveIdx(Math.max(0, items.findIndex(i => i.id === value)));
        e.preventDefault();
      }
      return;
    }
    if (e.key === "Escape") {
      setOpen(false);
      e.preventDefault();
    } else if (e.key === "ArrowDown") {
      setActiveIdx(i => (i + 1) % items.length);
      e.preventDefault();
    } else if (e.key === "ArrowUp") {
      setActiveIdx(i => (i - 1 + items.length) % items.length);
      e.preventDefault();
    } else if (e.key === "Home") {
      setActiveIdx(0);
      e.preventDefault();
    } else if (e.key === "End") {
      setActiveIdx(items.length - 1);
      e.preventDefault();
    } else if (e.key === "Enter" || e.key === " ") {
      const pick = items[activeIdx] || selected || items[0];
      if (pick && onChange) onChange(pick.id);
      setOpen(false);
      e.preventDefault();
    }
  };

  const selectItem = id => {
    onChange && onChange(id);
    setOpen(false);
  };

  return (
    <div
      ref={rootRef}
      className={`custom-select ${className}`}
      tabIndex={0}
      onKeyDown={onKeyDown}
      aria-haspopup="listbox"
      aria-expanded={open}
      role="combobox"
      aria-controls="area-options"
      aria-activedescendant={activeIdx >= 0 ? `area-opt-${activeIdx}` : undefined}
    >
      <button
        type="button"
        className="custom-select__button"
        onClick={() => setOpen(o => !o)}
      >
        <span className={`custom-select__value ${selected ? "" : "is-placeholder"}`}>
          {selected ? selected.label : placeholder}
        </span>
        <svg className="custom-select__chev" width="16" height="16" viewBox="0 0 24 24">
          <path fill="currentColor" d="M7 10l5 5 5-5z" />
        </svg>
      </button>

      {open && (
        <ul id="area-options" role="listbox" className="custom-select__list">
          {items.map((it, idx) => (
            <li
              id={`area-opt-${idx}`}
              key={it.id}
              role="option"
              aria-selected={String(value) === it.id}
              className={
                "custom-select__option" +
                (String(value) === it.id ? " is-selected" : "") +
                (idx === activeIdx ? " is-active" : "")
              }
              onMouseEnter={() => setActiveIdx(idx)}
              onMouseDown={e => e.preventDefault()} // prevent focus loss
              onClick={() => selectItem(it.id)}
            >
              {it.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
