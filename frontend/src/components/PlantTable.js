// PlantTable.jsx
import React from "react";

export default function PlantTable({ rows, setRows, containerOptions = [] }) {
  const update = (idx, patch) =>
    setRows(prev => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));

  return (
    <table border="1" cellPadding="6" style={{ borderCollapse: "collapse", width: "100%", marginTop: 12 }}>
      <thead>
        <tr>
          <th>#</th>               
          <th>Preview</th>
          <th>Label</th>
          <th>Container</th>
          <th>Confidence</th>
          <th>BBox [x1,y1,x2,y2]</th>
          <th>Notes</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={r.idx ?? i}>
            <td style={{ textAlign: "center", width: 40 }}>{r.idx}</td> 
            <td>
              {r.image && (
                <img
                  alt="crop"
                  src={`data:image/jpeg;base64,${r.image}`}
                  style={{ width: 80, height: 80, objectFit: "cover" }}
                />
              )}
            </td>
            <td>
              <input value={r.label || ""} onChange={e => update(i, { label: e.target.value })} />
            </td>
            <td>
              <select
                value={r.container || "unknown"}
                onChange={e => update(i, { container: e.target.value })}
              >
                {["unknown","pot","raised_bed","ground"].map(opt => (
                  <option key={opt} value={opt}>
                    {opt.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </td>
            <td>{r.confidence != null ? (r.confidence * 100).toFixed(0) + "%" : ""}</td>
            <td><code>{JSON.stringify(r.coords)}</code></td>
            <td>
              <input value={r.notes || ""} onChange={e => update(i, { notes: e.target.value })} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}