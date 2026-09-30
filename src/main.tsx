import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";
import { installGuard, showRecoverySurface } from "./vendor/ajx-core/index.js";

// AJX Studios Gate 2: errors outside rendering are contained too (local only —
// WillULikeIT sends nothing to any server).
installGuard({
  tool: "willulikeit",
  version: "0.1.1+ajx-gate2",
  getStep: () => window.location.hash || "#/",
  onFatal: () => {
    const root = document.getElementById("root");
    if (!root || (root.textContent || "").trim().length < 5) {
      showRecoverySurface({
        title: "WillULikeIT hit a problem",
        body: "Your profiles and predictions are saved in this browser. Nothing was uploaded.",
        actions: [{ label: "Reload", primary: true, onClick: () => location.reload() }, { label: "Home", onClick: () => { location.hash = "#/"; location.reload(); } }]
      });
    }
  }
});

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
