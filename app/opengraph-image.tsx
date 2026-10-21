import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

import { profile } from "@/lib/portfolio-data";

// Social share card shown when the site link is posted (WhatsApp, Facebook, X, LinkedIn…).
export const alt = `${profile.name} | ${profile.role}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const asset = (path: string) => readFile(join(process.cwd(), "assets", path));

const stack = ["Next.js", "Tailwind CSS", "GSAP", "Three.js"];

export default async function Image() {
  const [display, sans, sansMedium, portrait] = await Promise.all([
    asset("fonts/space-grotesk-latin-700-normal.ttf"),
    asset("fonts/dm-sans-latin-400-normal.ttf"),
    asset("fonts/dm-sans-latin-500-normal.ttf"),
    asset("og-portrait.jpg"),
  ]);
  const portraitSrc = `data:image/jpeg;base64,${portrait.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          overflow: "hidden",
          background: "#05050a",
          fontFamily: "DM Sans",
          color: "#fff",
        }}
      >
        {/* Nebula glows */}
        {/* Full-frame layers: satori clips elements placed at negative offsets. */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: 1200,
            height: 630,
            backgroundImage:
              "radial-gradient(circle at 140px 50px, rgba(99,102,241,0.45) 0px, rgba(99,102,241,0) 520px)",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: 1200,
            height: 630,
            backgroundImage:
              "radial-gradient(circle at 1060px 630px, rgba(232,121,168,0.3) 0px, rgba(232,121,168,0) 520px)",
          }}
        />
        {/* Planet horizon, echoing the hero */}
        <div
          style={{
            position: "absolute",
            left: -300,
            top: 560,
            width: 1800,
            height: 1800,
            borderRadius: 9999,
            background: "#000",
            borderTop: "2px solid rgba(147,165,244,0.55)",
            boxShadow: "0 -30px 120px rgba(99,102,241,0.55)",
          }}
        />

        {/* Text column */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "0 0 40px 80px",
            width: 760,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              fontSize: 20,
              fontWeight: 500,
              letterSpacing: 6,
              color: "#93a5f4",
            }}
          >
            <div style={{ width: 44, height: 2, background: "#93a5f4" }} />
            PORTFOLIO
          </div>

          <div
            style={{
              marginTop: 26,
              fontFamily: "Space Grotesk",
              fontSize: 104,
              lineHeight: 1,
              letterSpacing: -3,
            }}
          >
            {profile.name}
          </div>

          <div
            style={{
              marginTop: 18,
              fontFamily: "Space Grotesk",
              fontSize: 50,
              lineHeight: 1.1,
              backgroundImage: "linear-gradient(90deg, #93a5f4, #a78bfa 50%, #e879a8)",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            {profile.role}
          </div>

          <div style={{ marginTop: 24, fontSize: 26, color: "rgba(255,255,255,0.72)" }}>
            {`${profile.yearsOfExperience} years building fast, polished web experiences.`}
          </div>

          <div style={{ display: "flex", gap: 12, marginTop: 34 }}>
            {stack.map((tech) => (
              <div
                key={tech}
                style={{
                  display: "flex",
                  padding: "10px 20px",
                  borderRadius: 9999,
                  border: "1px solid rgba(255,255,255,0.16)",
                  background: "rgba(255,255,255,0.06)",
                  fontSize: 20,
                  fontWeight: 500,
                  color: "rgba(255,255,255,0.88)",
                }}
              >
                {tech}
              </div>
            ))}
          </div>
        </div>

        {/* Portrait with gradient frame */}
        <div
          style={{
            position: "absolute",
            right: 80,
            top: 70,
            display: "flex",
            padding: 4,
            borderRadius: 36,
            backgroundImage: "linear-gradient(140deg, #93a5f4, #a78bfa 45%, #e879a8)",
            boxShadow: "0 30px 80px rgba(99,102,241,0.45)",
          }}
        >
          <img
            src={portraitSrc}
            width={312}
            height={390}
            alt=""
            style={{ borderRadius: 32, objectFit: "cover" }}
          />
        </div>

        {/* Footer URL */}
        <div
          style={{
            position: "absolute",
            right: 80,
            bottom: 44,
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontSize: 22,
            fontWeight: 500,
            color: "rgba(255,255,255,0.8)",
          }}
        >
          <div style={{ width: 10, height: 10, borderRadius: 9999, background: "#34d399" }} />
          abdorabe.vercel.app
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Space Grotesk", data: display, weight: 700, style: "normal" },
        { name: "DM Sans", data: sans, weight: 400, style: "normal" },
        { name: "DM Sans", data: sansMedium, weight: 500, style: "normal" },
      ],
    }
  );
}
