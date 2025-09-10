// a function to render the plant table and functionality (dates logic e.g)
export default function PlantTable({ rows, setRows}) {
  const remove = (i) => setRows(prev => prev.filter((_, idx) => idx !== i));
  const update = (idx, patch) =>
    setRows(prev => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));

  const ymd = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
  };
  const today = new Date();
  const todayStr = ymd(today);
  const monthMax = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  return (
    <table border="1" cellPadding="6" style={{ borderCollapse: "collapse", width: "100%", marginTop: 12 }}>
      <thead>
        <tr>
          <th>#</th>
          <th>Delete</th>
          <th>Preview</th>
          <th>Label</th>
          <th>Container</th>
          <th>Confidence</th>
          <th>BBox [x1,y1,x2,y2]</th>
          <th>Notes</th>
          <th>Watered</th>
          <th>Fertilized</th>
          <th>Planted</th>

        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={r.idx ?? i}>
            <td style={{ textAlign: "center", width: 40 }}>{r.idx}</td>
            <td>
           <button type="button" onClick={() => remove(i)}>Delete</button>
           </td>
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
              {/* replace underscore with " " for raised_garden for example*/}
                {["unknown", "pot", "raised_bed", "ground"].map(opt => (
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
            <td>
              <input
                type="date"
                max={todayStr}
                value={(r.lastWateredAt && String(r.lastWateredAt).slice(0, 10)) || ""}
                onChange={e => {
                  const v = e.target.value; // "YYYY-MM-DD" or ""
                  if (v && v > todayStr) return; // block future
                  update(i, { lastWateredAt: v || null });
                }}
              />
            </td>
            <td>
              <input
                type="date"
                max={todayStr}
                value={(r.lastFertilizedAt && String(r.lastFertilizedAt).slice(0, 10)) || ""}
                onChange={e => {
                  const v = e.target.value;
                  if (v && v > todayStr) return;
                  update(i, { lastFertilizedAt: v || null });
                }}
              />
            </td>
           <td>
              <input
                type="month"
                max={monthMax}
                value={
                  r.plantedYear && r.plantedMonth
                    ? `${r.plantedYear}-${String(r.plantedMonth).padStart(2, "0")}`
                    : ""
                }
                onChange={e => {
                  const v = e.target.value; // "YYYY-MM" or ""
                  if (!v) return update(i, { plantedMonth: null, plantedYear: null });
                  if (v > monthMax) return; // block future month
                  const [yy, mm] = v.split("-");
                  update(i, { plantedYear: Number(yy), plantedMonth: Number(mm) });
                }}
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}