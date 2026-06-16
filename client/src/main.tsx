import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Build identifier — forces a unique bundle hash so CDNs don't serve a stale
// minified output when two builds happen to compress to the same bytes.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const __BUILD_ID__ = "2026-06-16-map-loader-fix-v2";
if (typeof window !== "undefined") (window as any).__BUILD_ID__ = __BUILD_ID__;

if (!window.location.hash) {
  window.location.hash = "#/";
}

createRoot(document.getElementById("root")!).render(<App />);
