import { ImageResponse } from "next/og";

export const alt = "Dolab — try clothes on a 3D avatar before you buy";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const swatches = ["#9bb59a", "#c97b5a", "#4f6d8f", "#d9a35b", "#3f3a36"];

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "72px 94px",
          background: "#f5f1ea",
          color: "#26221e",
          fontFamily: "Arial",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", maxWidth: 640 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, color: "#3e5c48", fontSize: 28, fontWeight: 700 }}>
            <span style={{ width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", background: "#3e5c48", color: "#fbfaf6", borderRadius: 12 }}>D</span>
            Dolab
          </div>
          <div style={{ display: "flex", marginTop: 44, fontSize: 70, lineHeight: 1.1, fontWeight: 700, letterSpacing: -2 }}>
            Try it on before you buy.
          </div>
          <div style={{ display: "flex", marginTop: 24, color: "#776f66", fontSize: 28 }}>
            A clothing store with a 3D fitting room.
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 44 }}>
            {swatches.map((c) => (
              <div key={c} style={{ width: 40, height: 40, borderRadius: 20, background: c }} />
            ))}
          </div>
        </div>
        <div style={{ width: 320, height: 440, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 160, background: "#e2eadf" }}>
          <svg width="200" height="360" viewBox="0 0 200 400">
            <rect x="74" y="236" width="24" height="112" rx="12" fill="#34507a" />
            <rect x="102" y="236" width="24" height="112" rx="12" fill="#34507a" />
            <rect x="68" y="340" width="34" height="24" rx="11" fill="#f5f3ee" />
            <rect x="98" y="340" width="34" height="24" rx="11" fill="#f5f3ee" />
            <line x1="68" y1="134" x2="50" y2="222" stroke="#c97b5a" strokeWidth="28" strokeLinecap="round" />
            <line x1="132" y1="134" x2="150" y2="222" stroke="#c97b5a" strokeWidth="28" strokeLinecap="round" />
            <path d="M66,128 Q100,116 134,128 L132,244 Q100,250 68,244 Z" fill="#c97b5a" />
            <circle cx="49" cy="233" r="11" fill="#e8b48f" />
            <circle cx="151" cy="233" r="11" fill="#e8b48f" />
            <circle cx="100" cy="72" r="40" fill="#e8b48f" />
            <path d="M60,74 Q56,28 100,28 Q144,28 140,74 Q134,52 114,48 Q100,60 76,52 Q64,60 60,74 Z" fill="#3b2a20" />
            <circle cx="86" cy="79" r="5" fill="#2b211c" />
            <circle cx="114" cy="79" r="5" fill="#2b211c" />
            <path d="M91,95 Q100,104 109,95" fill="none" stroke="#7a3e2e" strokeWidth="3" strokeLinecap="round" />
          </svg>
        </div>
      </div>
    ),
    { ...size },
  );
}
