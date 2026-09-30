import React from "react";
import { sanitizeError } from "../vendor/ajx-core/index.js";

/* AJX Studios Gate 2 — a render failure on any WillULikeIT page shows a
   recovery surface instead of a white page. Profiles, frozen predictions and
   outcomes live in this browser's storage and are untouched; the item draft
   (sessionStorage) can be cleared from here if it is what keeps failing. */
type P = { routeKey: string; children: React.ReactNode };
type S = { error: string | null };

export class RouteBoundary extends React.Component<P, S> {
  state: S = { error: null };
  static getDerivedStateFromError(e: unknown): S {
    return { error: sanitizeError(e).type };
  }
  componentDidUpdate(prev: P) {
    if (prev.routeKey !== this.props.routeKey && this.state.error) this.setState({ error: null });
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="wrap" role="alertdialog" aria-labelledby="wu-rec-title" style={{ padding: "24px 0" }}>
        <h2 id="wu-rec-title">Something went wrong on this page</h2>
        <p>Your taste profiles, frozen predictions and outcomes are saved in this browser and were not changed. Nothing was uploaded.</p>
        <div className="row" style={{ gap: 10, flexWrap: "wrap", display: "flex", marginTop: 12 }}>
          <button className="btn" onClick={() => this.setState({ error: null })}>Try again</button>
          <button className="btn ghost" onClick={() => { try { sessionStorage.removeItem("wulit.v1.draft"); } catch { /* */ } this.setState({ error: null }); window.location.hash = "#/predict"; }}>Clear the current item and start it again</button>
          <a className="btn ghost" href="#/">Home</a>
        </div>
        <p className="tiny" style={{ marginTop: 12 }}>Technical note (no personal content): {this.state.error}</p>
      </div>
    );
  }
}
