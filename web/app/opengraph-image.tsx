import { ImageResponse } from "next/og";
export const alt = "Stockroom — inventory intelligence for small businesses";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export default function Image() {
  return new ImageResponse(<div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#f5f5ee", width: "100%", height: "100%", padding: 70, color: "#13292b" }}><div style={{ display: "flex", fontSize: 34, fontWeight: 700 }}>stockroom.</div><div style={{ display: "flex", flexDirection: "column", fontSize: 80, fontWeight: 700, lineHeight: 1.05 }}><span>A clearer view of</span><span style={{ color: "#167766" }}>what keeps you moving.</span></div><div style={{ display: "flex", fontSize: 25 }}>Inventory · Suppliers · Stock intelligence</div></div>, size);
}
