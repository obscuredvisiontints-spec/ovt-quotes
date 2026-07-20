import React, { useState, useMemo, useRef, useEffect } from "react";
import { Plus, Trash2, Save, FolderOpen, X, Printer, ChevronRight, Upload, Camera, Eye, EyeOff } from "lucide-react";

const TEAL = "#00C9C8";
const TEAL_DEEP = "#00918f";
const INK = "#0B0F0F";
const GRAPHITE = "#1a1a1a";
const STEEL = "#6b7280";
const PAPER = "#F7F8F8";

const DEFAULT_FILM_PRESETS = [
  { id: "reflective", group: "Film", label: "Reflective", products: "Silver 20, 30, 40, Bronze 20, 35", rate: 12.50 },
  { id: "dual-neutral", group: "Film", label: "Dual Reflective / Neutral", products: "Visio 5, 15, 25, 35, Nocturna 10, 20, 30, 40", rate: 12.75 },
  { id: "ceramic", group: "Film", label: "Ceramic", products: "Keramos 35, 45, 55", rate: 14.50 },
  { id: "specialty-ceramic", group: "Film", label: "Specialty Ceramic", products: "Clarion 70", rate: 15.50 },
  { id: "exterior", group: "Film", label: "Exterior", products: "Silver Reflective 15, 40, Neutral 20, Clarion 60", rate: 14.50 },
  { id: "decorative", group: "Film", label: "Decorative", products: "Frost, Whiteout, Blackout", rate: 12.25 },
  { id: "fortis-4mil", group: "Protection", label: "Fortis 4mil", products: "Fortis 4mil", rate: 14.50 },
  { id: "fortis-8mil", group: "Protection", label: "Fortis 8mil (Clear, Interior)", products: "Fortis 8mil", rate: 15.00 },
  { id: "fortis-14mil", group: "Protection", label: "Fortis 14mil / 7 Exterior", products: "Fortis 14mil, 7 Exterior", rate: 16.50 },
  { id: "fortis-8mil-premium", group: "Protection", label: "Fortis 8mil Neutral 35 (Tinted)", products: "Fortis 8mil, Neutral 35", rate: 17.50 },
  { id: "fortis-13-frost", group: "Protection", label: "Fortis 13 - Frost", products: "Fortis 13 - Frost", rate: 17.50 },
];

const UNIT_LABELS = {
  flat: "Flat fee",
  linear_ft: "$/linear ft",
  sqft: "$/sq ft",
  equipment_percent: "% of rental cost",
};
const UNIT_QTY_LABELS = {
  flat: "Count",
  linear_ft: "Linear feet",
  sqft: "Sq ft",
  equipment_percent: "Rental cost ($)",
};

const DEFAULT_ADDON_PRESETS = [
  { id: "wet-glaze", name: "Structural Attachment (Wet Glaze)", unit: "linear_ft", rate: 7.50, note: "$6.50–$8.50 per linear ft" },
  { id: "removal-only", name: "Removal Only", unit: "sqft", rate: 6.00, note: "" },
  { id: "removal-retint", name: "Removal & Retint", unit: "sqft", rate: 4.00, note: "" },
  { id: "ladder", name: "Ladder Required", unit: "flat", rate: 100, note: "" },
  { id: "height-20-25", name: "Height Charge 20'-25'", unit: "sqft", rate: 2.00, note: "" },
  { id: "height-30-35", name: "Height Charge 30'-35'", unit: "sqft", rate: 3.00, note: "" },
  { id: "height-35-40", name: "Height Charge 35'-40'", unit: "sqft", rate: 4.00, note: "" },
  { id: "scaffolding", name: "Scaffolding", unit: "flat", rate: 150, note: "" },
  { id: "scissor-lift", name: "Scissor Lift Rental Markup", unit: "equipment_percent", rate: 12, note: "Enter the rental cost — adds this % on top" },
  { id: "difficult-access", name: "Difficult Access", unit: "sqft", rate: 3.50, note: "$2–$5 per sq ft depending on severity" },
];

const uid = () => Math.random().toString(36).slice(2, 10);
const money = (n) => (isNaN(n) ? "$0.00" : n.toLocaleString("en-CA", { style: "currency", currency: "CAD" }));
const sqftOf = (w) => ((parseFloat(w.width) || 0) * (parseFloat(w.length) || 0) / 144) * (parseInt(w.qty) || 0);

const DEFAULT_ROLL_WIDTHS = [36, 48, 60, 72];

// First-Fit Decreasing Height shelf packing: pieces already have {cross, length} in inches
// (cross = dimension that must sit under the roll width, length = dimension pulled along the roll).
function packShelves(pieces, rollWidth, kerf) {
  const sorted = [...pieces].sort((a, b) => b.length - a.length);
  const shelves = [];
  sorted.forEach((p) => {
    let placed = false;
    for (const shelf of shelves) {
      const addWidth = (shelf.pieces.length > 0 ? kerf : 0) + p.cross;
      if (shelf.remaining >= addWidth) {
        shelf.pieces.push(p);
        shelf.remaining -= addWidth;
        placed = true;
        break;
      }
    }
    if (!placed) {
      shelves.push({ height: p.length, remaining: rollWidth - p.cross, pieces: [p] });
    }
  });
  const totalLength = shelves.reduce((s, sh, idx) => s + sh.height + (idx > 0 ? kerf : 0), 0);
  return { shelves, totalLength };
}

function addOnLineTotal(line) {
  const rate = parseFloat(line.rate) || 0;
  const qty = parseFloat(line.qty) || 0;
  if (line.unit === "equipment_percent") return qty * (rate / 100);
  if (line.unit === "flat") return rate * (qty || 1);
  return rate * qty;
}

function HexBadge({ size = 34 }) {
  return (
    <div
      style={{
        width: size, height: size * 0.87,
        background: `linear-gradient(135deg, ${TEAL}, ${TEAL_DEEP})`,
        clipPath: "polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)",
        flexShrink: 0,
      }}
    />
  );
}
function SectionTitle({ children }) {
  return <div style={{ fontSize: 12, letterSpacing: 1.2, textTransform: "uppercase", fontWeight: 800, color: GRAPHITE }}>{children}</div>;
}
function MiniLabel({ children }) {
  return <div style={{ fontSize: 10, letterSpacing: 0.5, textTransform: "uppercase", color: STEEL }} className="mb-1">{children}</div>;
}

function WindowRow({ w, idx, filmPresets, onUpdate, onRemove, highlighted }) {
  const sqft = sqftOf(w);
  const preset = filmPresets.find((f) => f.id === w.film);
  const rate = preset?.rate || 0;
  const total = sqft * rate;
  const filmGroup = filmPresets.filter((f) => f.group === "Film");
  const protectionGroup = filmPresets.filter((f) => f.group === "Protection");
  return (
    <div style={{ border: `1px solid ${highlighted ? TEAL : "#eee"}`, borderRadius: 6, background: highlighted ? "#f0fffe" : "#fff" }} className="p-2.5">
      <div className="grid grid-cols-12 gap-2 items-end">
        <div className="col-span-1 flex items-center justify-center">
          <div style={{ background: INK, color: "#fff", borderRadius: "50%", width: 20, height: 20, fontSize: 10, fontWeight: 800 }} className="flex items-center justify-center">
            {idx + 1}
          </div>
        </div>
        <div className="col-span-3">
          <MiniLabel>Width (in)</MiniLabel>
          <input type="number" value={w.width} onChange={(e) => onUpdate("width", e.target.value)} className="w-full text-sm px-2 py-1.5 rounded border" style={{ borderColor: "#ddd" }} />
        </div>
        <div className="col-span-3">
          <MiniLabel>Length (in)</MiniLabel>
          <input type="number" value={w.length} onChange={(e) => onUpdate("length", e.target.value)} className="w-full text-sm px-2 py-1.5 rounded border" style={{ borderColor: "#ddd" }} />
        </div>
        <div className="col-span-2">
          <MiniLabel>Qty</MiniLabel>
          <input type="number" value={w.qty} onChange={(e) => onUpdate("qty", e.target.value)} className="w-full text-sm px-2 py-1.5 rounded border" style={{ borderColor: "#ddd" }} />
        </div>
        <div className="col-span-1 flex justify-end">
          <button onClick={onRemove} className="text-red-500 p-1.5"><Trash2 size={15} /></button>
        </div>
      </div>
      <div className="mt-2">
        <MiniLabel>Film / Protection Type</MiniLabel>
        <select value={w.film} onChange={(e) => onUpdate("film", e.target.value)} className="w-full text-sm px-2 py-1.5 rounded border" style={{ borderColor: "#ddd" }}>
          <optgroup label="Film">
            {filmGroup.map((f) => (
              <option key={f.id} value={f.id}>{money(f.rate)}/sq ft — {f.label} ({f.products})</option>
            ))}
          </optgroup>
          <optgroup label="Protection">
            {protectionGroup.map((f) => (
              <option key={f.id} value={f.id}>{money(f.rate)}/sq ft — {f.label} ({f.products})</option>
            ))}
          </optgroup>
        </select>
      </div>
      <div className="mt-2">
        <MiniLabel>Film Used (actual product)</MiniLabel>
        <input
          value={w.filmName}
          onChange={(e) => onUpdate("filmName", e.target.value)}
          placeholder="e.g. Keramos 45"
          className="w-full text-sm px-2 py-1.5 rounded border"
          style={{ borderColor: "#ddd" }}
        />
      </div>
      <div className="flex justify-between mt-1.5 text-xs" style={{ color: STEEL }}>
        <span>{sqft.toFixed(2)} sq ft &times; {money(rate)}/sq ft</span>
        <span style={{ fontFamily: "ui-monospace, monospace", fontWeight: 700, color: INK }}>{money(total)}</span>
      </div>
    </div>
  );
}

function RoomCard({ room, filmPresets, onRename, onRemoveRoom, onAddWindow, onUpdateWindow, onRemoveWindow, onPhoto, onToggleHidden }) {
  const imgRef = useRef(null);
  const [activePinId, setActivePinId] = useState(null);

  const roomSqft = room.windows.reduce((s, w) => s + sqftOf(w), 0);
  const roomTotal = room.windows.reduce((s, w) => {
    const rate = filmPresets.find((f) => f.id === w.film)?.rate || 0;
    return s + sqftOf(w) * rate;
  }, 0);

  const handlePhotoClick = (e) => {
    const rect = imgRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    const id = onAddWindow({ x, y });
    setActivePinId(id);
  };

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onPhoto(reader.result);
    reader.readAsDataURL(file);
  };

  if (room.hidden) {
    return (
      <div style={{ border: "1px dashed #ddd", borderRadius: 8, background: "#fafafa" }} className="px-3 py-2.5 flex items-center justify-between">
        <span className="text-sm font-semibold" style={{ color: STEEL }}>{room.name} <span className="text-xs font-normal">(hidden — excluded from totals)</span></span>
        <div className="flex items-center gap-2">
          <button onClick={onToggleHidden} className="flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded" style={{ background: "#fff", color: TEAL_DEEP, border: `1px solid ${TEAL}` }}>
            <Eye size={13} /> Show
          </button>
          <button onClick={onRemoveRoom} className="text-red-500 p-1"><Trash2 size={14} /></button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ border: "1px solid #eee", borderRadius: 8 }} className="p-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <input
          value={room.name}
          onChange={(e) => onRename(e.target.value)}
          style={{ fontWeight: 700, fontSize: 13, border: "none", background: "transparent" }}
          className="focus:outline-none flex-1"
        />
        <span className="text-xs whitespace-nowrap" style={{ color: STEEL }}>
          {roomSqft.toFixed(2)} sf &middot; <span style={{ fontWeight: 700, color: INK }}>{money(roomTotal)}</span>
        </span>
        <button onClick={onToggleHidden} className="p-1" style={{ color: STEEL }} title="Hide room">
          <EyeOff size={14} />
        </button>
        <button onClick={onRemoveRoom} className="text-red-500 p-1"><Trash2 size={14} /></button>
      </div>

      {room.photo ? (
        <div style={{ position: "relative", borderRadius: 6, overflow: "hidden", border: "1px solid #e5e7eb" }} className="mb-3">
          <img ref={imgRef} src={room.photo} onClick={handlePhotoClick} alt={room.name} style={{ width: "100%", display: "block", cursor: "crosshair" }} />
          {room.windows.filter((w) => w.x != null).map((w, idx) => (
            <button
              key={w.id}
              onClick={(e) => { e.stopPropagation(); setActivePinId(w.id === activePinId ? null : w.id); }}
              style={{
                position: "absolute", left: `${w.x}%`, top: `${w.y}%`, transform: "translate(-50%, -100%) rotate(-45deg)",
                background: w.id === activePinId ? TEAL : INK, color: "#fff", border: "2px solid #fff",
                borderRadius: "50% 50% 50% 0", width: 24, height: 24, display: "flex", alignItems: "center",
                justifyContent: "center", fontSize: 10, fontWeight: 800, boxShadow: "0 1px 4px rgba(0,0,0,0.4)",
              }}
            >
              <span style={{ transform: "rotate(45deg)" }}>{room.windows.indexOf(w) + 1}</span>
            </button>
          ))}
        </div>
      ) : (
        <label className="flex items-center justify-center gap-2 cursor-pointer text-xs font-semibold mb-3 py-2 rounded" style={{ border: "1px dashed #ccc", color: STEEL }}>
          <Camera size={13} /> Add photo (optional)
          <input type="file" accept="image/*" className="hidden" onChange={handleFile} />
        </label>
      )}

      <div className="space-y-2">
        {room.windows.map((w, idx) => (
          <WindowRow
            key={w.id}
            w={w}
            idx={idx}
            filmPresets={filmPresets}
            highlighted={w.id === activePinId}
            onUpdate={(field, value) => onUpdateWindow(w.id, field, value)}
            onRemove={() => onRemoveWindow(w.id)}
          />
        ))}
      </div>

      <button
        onClick={() => onAddWindow({})}
        className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold py-2 mt-2 rounded"
        style={{ background: PAPER, color: TEAL_DEEP, border: `1px solid ${TEAL}` }}
      >
        <Plus size={13} /> Add Window
      </button>
    </div>
  );
}

function CutLayoutView({ group }) {
  const containerWidth = 280;
  const scale = containerWidth / group.chosenWidth;
  return (
    <div className="mt-2">
      <div style={{ maxHeight: 420, overflowY: "auto", border: `2px solid ${INK}`, borderRadius: 4 }}>
        <div style={{ width: containerWidth }}>
          {group.shelves.map((shelf, si) => (
            <div
              key={si}
              style={{ display: "flex", height: Math.max(shelf.height * scale, 16), borderBottom: si < group.shelves.length - 1 ? "1px dashed #999" : "none" }}
            >
              {shelf.pieces.map((p, pi) => (
                <div
                  key={p.id}
                  title={`${p.label}: ${p.width.toFixed(1)}\u00d7${p.height.toFixed(1)}"`}
                  style={{
                    width: Math.max(p.cross * scale, 4),
                    height: "100%",
                    background: pi % 2 === 0 ? "#e6fffe" : "#d4f7f6",
                    borderRight: pi < shelf.pieces.length - 1 ? "1px solid #999" : "none",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 9,
                    textAlign: "center",
                    color: GRAPHITE,
                    overflow: "hidden",
                  }}
                >
                  {p.width.toFixed(0)}&times;{p.height.toFixed(0)}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-2 space-y-1">
        {group.shelves.map((shelf, si) => (
          <div key={si} className="text-xs" style={{ color: STEEL }}>
            Cut {si + 1}: {shelf.pieces.map((p) => `${p.label} (${p.width.toFixed(1)}\u00d7${p.height.toFixed(1)}")`).join(", ")} — {shelf.height.toFixed(1)}" of roll
          </div>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const [customer, setCustomer] = useState({ name: "", address: "", phone: "", date: new Date().toISOString().slice(0, 10) });
  const [filmPresets, setFilmPresets] = useState(DEFAULT_FILM_PRESETS);
  const [floors, setFloors] = useState([
    { id: uid(), name: "Main Floor", hidden: false, rooms: [{ id: uid(), name: "Living Room", photo: null, hidden: false, windows: [] }] },
  ]);
  const [tripFee, setTripFee] = useState(0);
  const [taxRate, setTaxRate] = useState(13);
  const [rollWidths, setRollWidths] = useState(DEFAULT_ROLL_WIDTHS);
  const [rollBuffer, setRollBuffer] = useState(1.5);
  const [crossBuffer, setCrossBuffer] = useState(0);
  const [kerf, setKerf] = useState(0.03125);
  const [rollOverrides, setRollOverrides] = useState({});
  const [expandedGroups, setExpandedGroups] = useState({});
  const [addOnPresets, setAddOnPresets] = useState(DEFAULT_ADDON_PRESETS);
  const [appliedAddOns, setAppliedAddOns] = useState([]);
  const [kmTraveled, setKmTraveled] = useState(0);
  const [fuelRatePerKm, setFuelRatePerKm] = useState(0.5);
  const [saved, setSaved] = useState([]);
  const [showSaved, setShowSaved] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.list("roomquote:");
        if (res && res.keys) {
          const items = await Promise.all(
            res.keys.map(async (k) => {
              try { const r = await window.storage.get(k); return r ? JSON.parse(r.value) : null; } catch { return null; }
            })
          );
          setSaved(items.filter(Boolean).sort((a, b) => b.savedAt - a.savedAt));
        }
      } catch (e) {}
    })();
  }, []);

  const addFloor = () => setFloors((f) => [...f, { id: uid(), name: `Floor ${f.length + 1}`, hidden: false, rooms: [{ id: uid(), name: "Room 1", photo: null, hidden: false, windows: [] }] }]);
  const removeFloor = (id) => setFloors((f) => f.filter((fl) => fl.id !== id));
  const renameFloor = (id, name) => setFloors((f) => f.map((fl) => (fl.id === id ? { ...fl, name } : fl)));
  const toggleFloorHidden = (id) => setFloors((f) => f.map((fl) => (fl.id === id ? { ...fl, hidden: !fl.hidden } : fl)));

  const addRoom = (floorId) =>
    setFloors((f) => f.map((fl) => (fl.id === floorId ? { ...fl, rooms: [...fl.rooms, { id: uid(), name: `Room ${fl.rooms.length + 1}`, photo: null, hidden: false, windows: [] }] } : fl)));
  const removeRoom = (floorId, roomId) =>
    setFloors((f) => f.map((fl) => (fl.id === floorId ? { ...fl, rooms: fl.rooms.filter((r) => r.id !== roomId) } : fl)));
  const toggleRoomHidden = (floorId, roomId) =>
    setFloors((f) => f.map((fl) => (fl.id === floorId ? { ...fl, rooms: fl.rooms.map((r) => (r.id === roomId ? { ...r, hidden: !r.hidden } : r)) } : fl)));
  const renameRoom = (floorId, roomId, name) =>
    setFloors((f) => f.map((fl) => (fl.id === floorId ? { ...fl, rooms: fl.rooms.map((r) => (r.id === roomId ? { ...r, name } : r)) } : fl)));
  const setRoomPhoto = (floorId, roomId, photo) =>
    setFloors((f) => f.map((fl) => (fl.id === floorId ? { ...fl, rooms: fl.rooms.map((r) => (r.id === roomId ? { ...r, photo } : r)) } : fl)));

  const addWindow = (floorId, roomId, pin) => {
    const id = uid();
    setFloors((f) =>
      f.map((fl) =>
        fl.id === floorId
          ? {
              ...fl,
              rooms: fl.rooms.map((r) =>
                r.id === roomId
                  ? { ...r, windows: [...r.windows, { id, width: "", length: "", qty: 1, film: filmPresets[0].id, filmName: "", ...pin }] }
                  : r
              ),
            }
          : fl
      )
    );
    return id;
  };
  const updateWindow = (floorId, roomId, winId, field, value) =>
    setFloors((f) =>
      f.map((fl) =>
        fl.id === floorId
          ? { ...fl, rooms: fl.rooms.map((r) => (r.id === roomId ? { ...r, windows: r.windows.map((w) => (w.id === winId ? { ...w, [field]: value } : w)) } : r)) }
          : fl
      )
    );
  const removeWindow = (floorId, roomId, winId) =>
    setFloors((f) =>
      f.map((fl) =>
        fl.id === floorId ? { ...fl, rooms: fl.rooms.map((r) => (r.id === roomId ? { ...r, windows: r.windows.filter((w) => w.id !== winId) } : r)) } : fl
      )
    );

  const updateFilmPreset = (id, field, value) => setFilmPresets((fp) => fp.map((f) => (f.id === id ? { ...f, [field]: value } : f)));
  const addFilmPreset = (group) => setFilmPresets((fp) => [...fp, { id: uid(), group, label: "New Option", products: "", rate: 0 }]);
  const removeFilmPreset = (id) => setFilmPresets((fp) => fp.filter((f) => f.id !== id));

  const updateRollWidth = (idx, value) => setRollWidths((rw) => rw.map((w, i) => (i === idx ? value : w)));

  const updateAddOnPreset = (id, field, value) => setAddOnPresets((ap) => ap.map((a) => (a.id === id ? { ...a, [field]: value } : a)));
  const addAddOnPreset = () => setAddOnPresets((ap) => [...ap, { id: uid(), name: "New Add-On", unit: "flat", rate: 0, note: "" }]);
  const removeAddOnPreset = (id) => setAddOnPresets((ap) => ap.filter((a) => a.id !== id));

  const addAppliedAddOn = (presetId) => {
    const preset = addOnPresets.find((a) => a.id === presetId);
    if (!preset) return;
    setAppliedAddOns((list) => [
      ...list,
      { id: uid(), presetId: preset.id, name: preset.name, unit: preset.unit, rate: preset.rate, qty: preset.unit === "flat" ? 1 : "" },
    ]);
  };
  const updateAppliedAddOn = (id, field, value) => setAppliedAddOns((list) => list.map((a) => (a.id === id ? { ...a, [field]: value } : a)));
  const removeAppliedAddOn = (id) => setAppliedAddOns((list) => list.filter((a) => a.id !== id));

  // Group every window pane (across visible floors/rooms) by the actual roll product used —
  // falls back to the preset label if no product name was typed in, since only identical
  // products come off the same physical roll.
  const rollPlan = useMemo(() => {
    const groups = {};
    floors.filter((fl) => !fl.hidden).forEach((fl) => {
      fl.rooms.filter((r) => !r.hidden).forEach((r) => {
        r.windows.forEach((w, wi) => {
          const width = parseFloat(w.width) || 0;
          const height = parseFloat(w.length) || 0;
          const qty = parseInt(w.qty) || 0;
          if (width <= 0 || height <= 0 || qty <= 0) return;
          const preset = filmPresets.find((f) => f.id === w.film);
          const productName = (w.filmName || "").trim();
          const key = productName ? `p:${productName.toLowerCase()}` : `c:${w.film}`;
          const displayName = productName || (preset ? `${preset.label} (no product typed in yet)` : "Unspecified");
          if (!groups[key]) groups[key] = { key, displayName, pieces: [] };
          for (let i = 0; i < qty; i++) {
            groups[key].pieces.push({
              id: `${w.id}-${i}`,
              label: `${fl.name} • ${r.name} • Window ${wi + 1}${qty > 1 ? ` (${i + 1}/${qty})` : ""}`,
              width,
              height,
            });
          }
        });
      });
    });
    return Object.values(groups);
  }, [floors, filmPresets]);

  const rollResults = useMemo(() => {
    const sortedWidths = [...rollWidths].filter((w) => w > 0).sort((a, b) => a - b);
    return rollPlan.map((g) => {
      const pieces = g.pieces.map((p) => ({
        ...p,
        cross: Math.min(p.width, p.height) + crossBuffer,
        length: Math.max(p.width, p.height) + rollBuffer,
      }));
      const maxCross = Math.max(...pieces.map((p) => p.cross));
      const fitWidths = sortedWidths.filter((w) => w >= maxCross);
      const oversized = fitWidths.length === 0;
      const recommended = oversized ? sortedWidths[sortedWidths.length - 1] : fitWidths[0];
      const availableWidths = oversized ? sortedWidths : fitWidths;
      const overriden = rollOverrides[g.key];
      const chosenWidth = overriden && availableWidths.includes(overriden) ? overriden : recommended;
      const packed = packShelves(pieces, chosenWidth, kerf);
      return {
        ...g,
        pieces,
        maxCross,
        recommended,
        oversized,
        availableWidths,
        chosenWidth,
        totalLengthIn: packed.totalLength,
        shelves: packed.shelves,
        pieceCount: pieces.length,
      };
    });
  }, [rollPlan, rollWidths, rollBuffer, crossBuffer, kerf, rollOverrides]);

  const computed = useMemo(() => {
    let grandSqft = 0, grandTotal = 0;
    const byFilm = {};
    const floorSummaries = floors.map((fl) => {
      let floorSqft = 0, floorTotal = 0;
      fl.rooms.filter((r) => !r.hidden).forEach((r) => {
        r.windows.forEach((w) => {
          const sqft = sqftOf(w);
          const rate = filmPresets.find((f) => f.id === w.film)?.rate || 0;
          const total = sqft * rate;
          floorSqft += sqft;
          floorTotal += total;
          if (!fl.hidden) {
            byFilm[w.film] = byFilm[w.film] || { sqft: 0, total: 0 };
            byFilm[w.film].sqft += sqft;
            byFilm[w.film].total += total;
          }
        });
      });
      if (!fl.hidden) {
        grandSqft += floorSqft;
        grandTotal += floorTotal;
      }
      return { id: fl.id, name: fl.name, sqft: floorSqft, total: floorTotal, hidden: fl.hidden };
    });
    return { floorSummaries, byFilm, grandSqft, grandTotal };
  }, [floors, filmPresets]);

  const addOnsTotal = appliedAddOns.reduce((s, a) => s + addOnLineTotal(a), 0);
  const fuelCost = (parseFloat(kmTraveled) || 0) * (parseFloat(fuelRatePerKm) || 0);
  const subtotal = computed.grandTotal + addOnsTotal + (parseFloat(tripFee) || 0) + fuelCost;
  const tax = subtotal * ((parseFloat(taxRate) || 0) / 100);
  const finalTotal = subtotal + tax;

  const saveQuote = async () => {
    const quote = {
      id: uid(), savedAt: Date.now(), customer, filmPresets,
      floors: floors.map((fl) => ({ ...fl, rooms: fl.rooms.map((r) => ({ ...r, photo: null })) })),
      tripFee, taxRate, addOnPresets, appliedAddOns, kmTraveled, fuelRatePerKm,
      grandTotal: finalTotal,
    };
    try {
      await window.storage.set(`roomquote:${quote.id}`, JSON.stringify(quote));
      setSaved((s) => [quote, ...s]);
      setStatus("Quote saved (photos aren't stored — re-attach if you reload).");
      setTimeout(() => setStatus(""), 3500);
    } catch (e) {
      setStatus("Save failed — try again.");
      setTimeout(() => setStatus(""), 2500);
    }
  };
  const loadQuote = (q) => {
    setCustomer(q.customer);
    setFilmPresets(q.filmPresets || DEFAULT_FILM_PRESETS);
    setFloors(q.floors.map((fl) => ({ ...fl, hidden: !!fl.hidden, rooms: fl.rooms.map((r) => ({ ...r, hidden: !!r.hidden })) })));
    setTripFee(q.tripFee);
    setTaxRate(q.taxRate);
    setAddOnPresets(q.addOnPresets || DEFAULT_ADDON_PRESETS);
    setAppliedAddOns(q.appliedAddOns || []);
    setKmTraveled(q.kmTraveled || 0);
    setFuelRatePerKm(q.fuelRatePerKm != null ? q.fuelRatePerKm : 0.5);
    setShowSaved(false);
  };
  const deleteQuote = async (id) => {
    try { await window.storage.delete(`roomquote:${id}`); setSaved((s) => s.filter((q) => q.id !== id)); } catch (e) {}
  };

  return (
    <div style={{ background: PAPER, minHeight: "100vh", color: INK, fontFamily: "'Helvetica Neue', Arial, sans-serif" }}>
      <div style={{ background: INK, color: "#fff" }}>
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <HexBadge />
            <div>
              <div style={{ fontStyle: "italic", fontWeight: 800, fontSize: 20 }}>Obscured Vision <span style={{ color: TEAL }}>Tints</span></div>
              <div style={{ fontSize: 11, color: "#9ca3af", letterSpacing: 1.5, textTransform: "uppercase" }}>Floor / Room Flat Glass Quote</div>
            </div>
          </div>
          <div className="flex gap-2 print:hidden">
            <button onClick={() => setShowSaved(true)} className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded" style={{ background: "#242424", color: "#fff" }}><FolderOpen size={15} /> Saved ({saved.length})</button>
            <button onClick={saveQuote} className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded" style={{ background: TEAL, color: INK }}><Save size={15} /> Save</button>
            <button onClick={() => window.print()} className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded" style={{ background: "transparent", color: "#fff", border: "1px solid #3a3a3a" }}><Printer size={15} /> Print</button>
          </div>
        </div>
        <div style={{ height: 3, background: `linear-gradient(90deg, ${TEAL}, transparent)` }} />
      </div>

      {status && <div className="max-w-6xl mx-auto px-6 pt-3 text-sm font-semibold" style={{ color: TEAL_DEEP }}>{status}</div>}

      <div className="max-w-6xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <section style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8 }} className="p-5">
            <SectionTitle>Customer</SectionTitle>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div><MiniLabel>Name</MiniLabel><input value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} className="w-full text-sm px-2.5 py-2 rounded border" style={{ borderColor: "#ddd" }} /></div>
              <div><MiniLabel>Phone</MiniLabel><input value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} className="w-full text-sm px-2.5 py-2 rounded border" style={{ borderColor: "#ddd" }} /></div>
              <div className="col-span-2"><MiniLabel>Address</MiniLabel><input value={customer.address} onChange={(e) => setCustomer({ ...customer, address: e.target.value })} className="w-full text-sm px-2.5 py-2 rounded border" style={{ borderColor: "#ddd" }} /></div>
            </div>
          </section>

          {floors.map((fl) => {
            const fs = computed.floorSummaries.find((s) => s.id === fl.id);

            if (fl.hidden) {
              return (
                <div key={fl.id} style={{ border: "1px dashed #ccc", borderRadius: 8, background: "#fafafa" }} className="p-4 flex items-center justify-between">
                  <span className="text-sm font-semibold" style={{ color: STEEL }}>
                    {fl.name} <span className="text-xs font-normal">(hidden — excluded from totals)</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => toggleFloorHidden(fl.id)} className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded" style={{ background: "#fff", color: TEAL_DEEP, border: `1px solid ${TEAL}` }}>
                      <Eye size={14} /> Show
                    </button>
                    {floors.length > 1 && <button onClick={() => removeFloor(fl.id)} className="text-red-500 p-1"><Trash2 size={15} /></button>}
                  </div>
                </div>
              );
            }

            return (
              <section key={fl.id} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8 }} className="p-5">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <input value={fl.name} onChange={(e) => renameFloor(fl.id, e.target.value)} style={{ fontWeight: 800, fontSize: 15, border: "none", background: "transparent" }} className="focus:outline-none" />
                  <div className="text-xs" style={{ color: STEEL }}>
                    {fs.sqft.toFixed(2)} sq ft &middot; <span style={{ fontWeight: 700, color: INK }}>{money(fs.total)}</span>
                  </div>
                  <button onClick={() => toggleFloorHidden(fl.id)} className="p-1" style={{ color: STEEL }} title="Hide floor">
                    <EyeOff size={15} />
                  </button>
                  {floors.length > 1 && <button onClick={() => removeFloor(fl.id)} className="text-red-500 p-1"><Trash2 size={15} /></button>}
                </div>

                <div className="space-y-3">
                  {fl.rooms.map((r) => (
                    <RoomCard
                      key={r.id}
                      room={r}
                      filmPresets={filmPresets}
                      onRename={(name) => renameRoom(fl.id, r.id, name)}
                      onRemoveRoom={() => removeRoom(fl.id, r.id)}
                      onAddWindow={(pin) => addWindow(fl.id, r.id, pin)}
                      onUpdateWindow={(winId, field, value) => updateWindow(fl.id, r.id, winId, field, value)}
                      onRemoveWindow={(winId) => removeWindow(fl.id, r.id, winId)}
                      onPhoto={(photo) => setRoomPhoto(fl.id, r.id, photo)}
                      onToggleHidden={() => toggleRoomHidden(fl.id, r.id)}
                    />
                  ))}
                </div>

                <button
                  onClick={() => addRoom(fl.id)}
                  className="w-full flex items-center justify-center gap-1.5 text-sm font-semibold py-2.5 mt-3 rounded"
                  style={{ background: PAPER, color: TEAL_DEEP, border: `1px dashed ${TEAL}` }}
                >
                  <Plus size={14} /> Add Room
                </button>
              </section>
            );
          })}

          <button onClick={addFloor} className="w-full flex items-center justify-center gap-2 text-sm font-semibold py-3 rounded" style={{ background: "#fff", color: TEAL_DEEP, border: `1px dashed ${TEAL}` }}>
            <Plus size={16} /> Add Floor
          </button>

          <section style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8 }} className="p-5">
            <SectionTitle>Film & Protection Price List</SectionTitle>
            <div className="text-xs mt-1" style={{ color: STEEL }}>Edit rates, labels, or the product list any time — add or delete options as your lineup changes.</div>

            {["Film", "Protection"].map((groupName) => (
              <div key={groupName} className="mt-4">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold uppercase" style={{ color: TEAL_DEEP, letterSpacing: 1 }}>{groupName}</div>
                  <button onClick={() => addFilmPreset(groupName)} className="flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded" style={{ background: PAPER, color: TEAL_DEEP, border: `1px solid ${TEAL}` }}>
                    <Plus size={12} /> Add
                  </button>
                </div>
                <div className="space-y-2 mt-2">
                  {filmPresets.filter((f) => f.group === groupName).map((f) => (
                    <div key={f.id} className="grid grid-cols-12 gap-2 items-end p-2" style={{ border: "1px solid #eee", borderRadius: 6 }}>
                      <div className="col-span-3">
                        <MiniLabel>Rate ($/sq ft)</MiniLabel>
                        <input type="number" step="0.25" value={f.rate} onChange={(e) => updateFilmPreset(f.id, "rate", parseFloat(e.target.value) || 0)} className="w-full text-sm px-2 py-1.5 rounded border" style={{ borderColor: "#ddd" }} />
                      </div>
                      <div className="col-span-3">
                        <MiniLabel>Label</MiniLabel>
                        <input value={f.label} onChange={(e) => updateFilmPreset(f.id, "label", e.target.value)} className="w-full text-sm px-2 py-1.5 rounded border" style={{ borderColor: "#ddd" }} />
                      </div>
                      <div className="col-span-5">
                        <MiniLabel>Products</MiniLabel>
                        <input value={f.products} onChange={(e) => updateFilmPreset(f.id, "products", e.target.value)} className="w-full text-sm px-2 py-1.5 rounded border" style={{ borderColor: "#ddd" }} />
                      </div>
                      <div className="col-span-1 flex justify-end">
                        <button onClick={() => removeFilmPreset(f.id)} className="text-red-500 p-1.5"><Trash2 size={15} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </section>

          <section style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8 }} className="p-5">
            <SectionTitle>Add-Ons & Extra Charges</SectionTitle>
            <div className="text-xs mt-1" style={{ color: STEEL }}>Manage your standard charges below, then add them to this specific quote in the section underneath.</div>

            <div className="mt-4">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold uppercase" style={{ color: TEAL_DEEP, letterSpacing: 1 }}>Your Add-On Presets</div>
                <button onClick={addAddOnPreset} className="flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded" style={{ background: PAPER, color: TEAL_DEEP, border: `1px solid ${TEAL}` }}>
                  <Plus size={12} /> Add
                </button>
              </div>
              <div className="space-y-2 mt-2">
                {addOnPresets.map((a) => (
                  <div key={a.id} style={{ border: "1px solid #eee", borderRadius: 6 }} className="p-2">
                    <div className="grid grid-cols-12 gap-2 items-end">
                      <div className="col-span-4">
                        <MiniLabel>Name</MiniLabel>
                        <input value={a.name} onChange={(e) => updateAddOnPreset(a.id, "name", e.target.value)} className="w-full text-sm px-2 py-1.5 rounded border" style={{ borderColor: "#ddd" }} />
                      </div>
                      <div className="col-span-3">
                        <MiniLabel>Unit</MiniLabel>
                        <select value={a.unit} onChange={(e) => updateAddOnPreset(a.id, "unit", e.target.value)} className="w-full text-sm px-2 py-1.5 rounded border" style={{ borderColor: "#ddd" }}>
                          {Object.entries(UNIT_LABELS).map(([val, label]) => <option key={val} value={val}>{label}</option>)}
                        </select>
                      </div>
                      <div className="col-span-2">
                        <MiniLabel>Rate</MiniLabel>
                        <input type="number" step="0.25" value={a.rate} onChange={(e) => updateAddOnPreset(a.id, "rate", parseFloat(e.target.value) || 0)} className="w-full text-sm px-2 py-1.5 rounded border" style={{ borderColor: "#ddd" }} />
                      </div>
                      <div className="col-span-2">
                        <MiniLabel>Note</MiniLabel>
                        <input value={a.note} onChange={(e) => updateAddOnPreset(a.id, "note", e.target.value)} placeholder="e.g. price range" className="w-full text-sm px-2 py-1.5 rounded border" style={{ borderColor: "#ddd" }} />
                      </div>
                      <div className="col-span-1 flex justify-end">
                        <button onClick={() => removeAddOnPreset(a.id)} className="text-red-500 p-1.5"><Trash2 size={15} /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="text-xs font-bold uppercase" style={{ color: TEAL_DEEP, letterSpacing: 1 }}>Applied to This Quote</div>
                <select
                  onChange={(e) => { if (e.target.value) { addAppliedAddOn(e.target.value); e.target.value = ""; } }}
                  defaultValue=""
                  className="text-sm px-2 py-1.5 rounded border"
                  style={{ borderColor: "#ddd" }}
                >
                  <option value="" disabled>+ Add a charge...</option>
                  {addOnPresets.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>

              <div className="space-y-2 mt-2">
                {appliedAddOns.length === 0 && <div className="text-xs" style={{ color: STEEL }}>No add-ons applied to this quote yet.</div>}
                {appliedAddOns.map((line) => (
                  <div key={line.id} style={{ border: "1px solid #eee", borderRadius: 6 }} className="p-2">
                    <div className="grid grid-cols-12 gap-2 items-end">
                      <div className="col-span-4">
                        <MiniLabel>Charge</MiniLabel>
                        <input value={line.name} onChange={(e) => updateAppliedAddOn(line.id, "name", e.target.value)} className="w-full text-sm px-2 py-1.5 rounded border" style={{ borderColor: "#ddd" }} />
                      </div>
                      <div className="col-span-2">
                        <MiniLabel>Rate</MiniLabel>
                        <input type="number" step="0.25" value={line.rate} onChange={(e) => updateAppliedAddOn(line.id, "rate", parseFloat(e.target.value) || 0)} className="w-full text-sm px-2 py-1.5 rounded border" style={{ borderColor: "#ddd" }} />
                      </div>
                      <div className="col-span-3">
                        <MiniLabel>{UNIT_QTY_LABELS[line.unit]}</MiniLabel>
                        <input type="number" step="0.5" value={line.qty} onChange={(e) => updateAppliedAddOn(line.id, "qty", e.target.value)} className="w-full text-sm px-2 py-1.5 rounded border" style={{ borderColor: "#ddd" }} />
                      </div>
                      <div className="col-span-2 text-right">
                        <MiniLabel>Total</MiniLabel>
                        <div style={{ fontFamily: "ui-monospace, monospace", fontWeight: 700 }} className="text-sm">{money(addOnLineTotal(line))}</div>
                      </div>
                      <div className="col-span-1 flex justify-end">
                        <button onClick={() => removeAppliedAddOn(line.id)} className="text-red-500 p-1.5"><Trash2 size={15} /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8 }} className="p-5">
            <SectionTitle>Roll & Cut Planning</SectionTitle>
            <div className="text-xs mt-1" style={{ color: STEEL }}>
              Groups every pane by the actual film product (or preset, if you haven't typed one in yet) and tells you the smallest roll width that covers it.
            </div>
            <div className="grid grid-cols-3 gap-3 mt-3">
              <div>
                <MiniLabel>Length buffer — extra to pull (in)</MiniLabel>
                <input type="number" step="0.25" value={rollBuffer} onChange={(e) => setRollBuffer(parseFloat(e.target.value) || 0)} className="w-full text-sm px-2 py-1.5 rounded border" style={{ borderColor: "#ddd" }} />
              </div>
              <div>
                <MiniLabel>Width margin — cross (in)</MiniLabel>
                <input type="number" step="0.125" value={crossBuffer} onChange={(e) => setCrossBuffer(parseFloat(e.target.value) || 0)} className="w-full text-sm px-2 py-1.5 rounded border" style={{ borderColor: "#ddd" }} />
              </div>
              <div>
                <MiniLabel>Blade width / kerf (in)</MiniLabel>
                <input type="number" step="0.03125" value={kerf} onChange={(e) => setKerf(parseFloat(e.target.value) || 0)} className="w-full text-sm px-2 py-1.5 rounded border" style={{ borderColor: "#ddd" }} />
              </div>
            </div>
            <div className="text-xs mt-1.5" style={{ color: STEEL }}>
              Length buffer only pads the length you pull off the roll. Width margin only pads the cross-cut — keep this at 0 if a piece is meant to use the full roll width.
            </div>
            <div className="mt-3">
              <MiniLabel>Roll widths you stock (in)</MiniLabel>
              <div className="flex gap-2">
                {rollWidths.map((w, i) => (
                  <input
                    key={i}
                    type="number"
                    value={w}
                    onChange={(e) => updateRollWidth(i, parseFloat(e.target.value) || 0)}
                    className="w-16 text-sm px-2 py-1.5 rounded border"
                    style={{ borderColor: "#ddd" }}
                  />
                ))}
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {rollResults.length === 0 && (
                <div className="text-xs" style={{ color: STEEL }}>Add window measurements above to see roll recommendations.</div>
              )}
              {rollResults.length > 0 && (
                <button
                  onClick={() => {
                    const allOpen = rollResults.every((g) => expandedGroups[g.key]);
                    const next = {};
                    rollResults.forEach((g) => { next[g.key] = !allOpen; });
                    setExpandedGroups(next);
                  }}
                  className="text-xs font-semibold px-3 py-1.5 rounded"
                  style={{ background: PAPER, color: TEAL_DEEP, border: `1px solid ${TEAL}` }}
                >
                  {rollResults.every((g) => expandedGroups[g.key]) ? "Hide all cut layouts" : "Show all cut layouts"}
                </button>
              )}
              {rollResults.map((g) => (
                <div key={g.key} style={{ border: "1px solid #eee", borderRadius: 6 }} className="p-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <div className="text-sm font-semibold">{g.displayName}</div>
                      <div className="text-xs" style={{ color: STEEL }}>
                        {g.pieceCount} piece{g.pieceCount !== 1 ? "s" : ""} &middot; needs at least {g.maxCross.toFixed(2)}" cross
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <MiniLabel>Roll width</MiniLabel>
                      <select
                        value={g.chosenWidth}
                        onChange={(e) => setRollOverrides((o) => ({ ...o, [g.key]: parseFloat(e.target.value) }))}
                        className="text-sm px-2 py-1 rounded border"
                        style={{ borderColor: "#ddd" }}
                      >
                        {g.availableWidths.map((w) => (
                          <option key={w} value={w}>{w}"</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {g.oversized && (
                    <div className="text-xs mt-1.5" style={{ color: "#b91c1c" }}>
                      No stocked roll width covers this piece — showing your widest available. Confirm with your supplier or plan a splice.
                    </div>
                  )}
                  <div className="flex justify-between mt-2 text-sm">
                    <span style={{ color: STEEL }}>Length needed</span>
                    <span style={{ fontFamily: "ui-monospace, monospace", fontWeight: 700 }}>
                      {g.totalLengthIn.toFixed(1)}" ({(g.totalLengthIn / 36).toFixed(2)} yd)
                    </span>
                  </div>
                  <button
                    onClick={() => setExpandedGroups((eg) => ({ ...eg, [g.key]: !eg[g.key] }))}
                    className="text-xs font-semibold mt-2"
                    style={{ color: TEAL_DEEP }}
                  >
                    {expandedGroups[g.key] ? "Hide cut layout" : "Show cut layout"}
                  </button>
                  {expandedGroups[g.key] && <CutLayoutView group={g} />}
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="lg:col-span-1">
          <div style={{ position: "sticky", top: 20 }} className="space-y-4">
            <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8 }} className="p-5">
              <SectionTitle>Per Floor</SectionTitle>
              <div className="mt-3 space-y-2 text-sm">
                {computed.floorSummaries.filter((fs) => !fs.hidden).map((fs) => (
                  <div key={fs.id} className="flex justify-between">
                    <span style={{ color: STEEL }}>{fs.name}</span>
                    <span style={{ fontFamily: "ui-monospace, monospace" }}>{fs.sqft.toFixed(1)} sf &middot; {money(fs.total)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8 }} className="p-5">
              <SectionTitle>By Film / Protection Type</SectionTitle>
              <div className="mt-3 space-y-2 text-sm">
                {Object.keys(computed.byFilm).length === 0 && <div style={{ color: STEEL }} className="text-xs">No windows added yet.</div>}
                {Object.entries(computed.byFilm).map(([id, v]) => (
                  <div key={id} className="flex justify-between">
                    <span style={{ color: STEEL }}>{filmPresets.find((f) => f.id === id)?.label || id}</span>
                    <span style={{ fontFamily: "ui-monospace, monospace" }}>{v.sqft.toFixed(1)} sf &middot; {money(v.total)}</span>
                  </div>
                ))}
              </div>
            </div>

            {appliedAddOns.length > 0 && (
              <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8 }} className="p-5">
                <SectionTitle>Add-Ons</SectionTitle>
                <div className="mt-3 space-y-2 text-sm">
                  {appliedAddOns.map((a) => (
                    <div key={a.id} className="flex justify-between">
                      <span style={{ color: STEEL }}>{a.name}</span>
                      <span style={{ fontFamily: "ui-monospace, monospace" }}>{money(addOnLineTotal(a))}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8 }} className="p-5">
              <SectionTitle>Travel / Fuel</SectionTitle>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div>
                  <MiniLabel>Distance (km)</MiniLabel>
                  <input type="number" value={kmTraveled} onChange={(e) => setKmTraveled(e.target.value)} className="w-full text-sm px-2 py-1.5 rounded border" style={{ borderColor: "#ddd" }} />
                </div>
                <div>
                  <MiniLabel>Rate ($/km)</MiniLabel>
                  <input type="number" step="0.05" value={fuelRatePerKm} onChange={(e) => setFuelRatePerKm(e.target.value)} className="w-full text-sm px-2 py-1.5 rounded border" style={{ borderColor: "#ddd" }} />
                </div>
              </div>
              <div className="flex justify-between mt-2 text-sm">
                <span style={{ color: STEEL }}>Fuel charge</span>
                <span style={{ fontFamily: "ui-monospace, monospace", fontWeight: 700 }}>{money(fuelCost)}</span>
              </div>
            </div>

            <div style={{ background: INK, color: "#fff", borderRadius: 8 }} className="p-5">
              <div style={{ fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", color: "#9ca3af" }}>Quote Total</div>
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between"><span style={{ color: "#9ca3af" }}>Total sq ft</span><span style={{ fontFamily: "ui-monospace, monospace" }}>{computed.grandSqft.toFixed(2)}</span></div>
                <div className="flex justify-between"><span style={{ color: "#9ca3af" }}>Materials + labor</span><span style={{ fontFamily: "ui-monospace, monospace" }}>{money(computed.grandTotal)}</span></div>
                <div className="flex justify-between"><span style={{ color: "#9ca3af" }}>Add-ons</span><span style={{ fontFamily: "ui-monospace, monospace" }}>{money(addOnsTotal)}</span></div>
                <div className="flex items-center justify-between">
                  <span style={{ color: "#9ca3af" }}>Trip / setup fee</span>
                  <input type="number" value={tripFee} onChange={(e) => setTripFee(e.target.value)} className="w-20 text-sm px-2 py-1 rounded text-right" style={{ background: "#242424", color: "#fff", border: "1px solid #3a3a3a" }} />
                </div>
                <div className="flex justify-between"><span style={{ color: "#9ca3af" }}>Fuel</span><span style={{ fontFamily: "ui-monospace, monospace" }}>{money(fuelCost)}</span></div>
                <div className="flex justify-between"><span style={{ color: "#9ca3af" }}>Subtotal</span><span style={{ fontFamily: "ui-monospace, monospace" }}>{money(subtotal)}</span></div>
                <div className="flex items-center justify-between">
                  <span style={{ color: "#9ca3af" }}>Tax rate (%)</span>
                  <input type="number" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} className="w-16 text-sm px-2 py-1 rounded text-right" style={{ background: "#242424", color: "#fff", border: "1px solid #3a3a3a" }} />
                </div>
                <div className="flex justify-between"><span style={{ color: "#9ca3af" }}>Tax</span><span style={{ fontFamily: "ui-monospace, monospace" }}>{money(tax)}</span></div>
              </div>
              <div style={{ height: 1, background: "#333" }} className="my-3" />
              <div className="flex items-baseline justify-between">
                <span style={{ fontSize: 13, color: "#9ca3af" }}>Total</span>
                <span style={{ fontSize: 26, fontWeight: 800, color: TEAL, fontFamily: "ui-monospace, monospace" }}>{money(finalTotal)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showSaved && (
        <div className="fixed inset-0 z-50 flex justify-end print:hidden" style={{ background: "rgba(0,0,0,0.4)" }}>
          <div style={{ background: "#fff", width: 360, maxWidth: "90vw" }} className="h-full p-5 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <SectionTitle>Saved Quotes</SectionTitle>
              <button onClick={() => setShowSaved(false)}><X size={18} /></button>
            </div>
            {saved.length === 0 && <div className="text-sm" style={{ color: STEEL }}>No saved quotes yet.</div>}
            <div className="space-y-2">
              {saved.map((q) => (
                <div key={q.id} style={{ border: "1px solid #eee", borderRadius: 6 }} className="p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold">{q.customer?.name || "Unnamed customer"}</div>
                      <div className="text-xs" style={{ color: STEEL }}>{new Date(q.savedAt).toLocaleDateString()} &middot; {money(q.grandTotal)}</div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => loadQuote(q)} style={{ color: TEAL_DEEP }}><ChevronRight size={18} /></button>
                      <button onClick={() => deleteQuote(q.id)} className="text-red-500"><Trash2 size={16} /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
