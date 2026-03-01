import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const alt = "Mymic AI";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OgImage() {
  const manropeBold = await readFile(join(process.cwd(), "app/fonts/Manrope-Bold.ttf"));

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#0a0608",
          backgroundImage:
            "radial-gradient(circle at 18% 20%, rgba(123,0,204,0.45), transparent 42%), radial-gradient(circle at 82% 75%, rgba(212,0,106,0.4), transparent 46%)",
          color: "#f0e0f5",
          fontFamily: "Manrope",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 36,
            borderRadius: 24,
            border: "1px solid rgba(155,48,255,0.4)",
            boxShadow:
              "inset 0 0 0 1px rgba(255,45,138,0.2), 0 0 52px rgba(155,48,255,0.22)",
            background: "rgba(17,10,16,0.68)",
          }}
        />
        <div style={{ zIndex: 1, display: "flex", flexDirection: "column", gap: 14 }}>
          <div
            style={{
              fontSize: 80,
              lineHeight: 1,
              letterSpacing: "-0.04em",
              fontWeight: 700,
              textTransform: "uppercase",
              textShadow: "0 0 22px rgba(255,45,138,0.4)",
            }}
          >
            Mymic AI
          </div>
          <div
            style={{
              fontSize: 34,
              opacity: 0.9,
              letterSpacing: "-0.01em",
            }}
          >
            Autonomous Growth Copilot
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        {
          name: "Manrope",
          data: manropeBold,
          style: "normal",
          weight: 700,
        },
      ],
    }
  );
}
