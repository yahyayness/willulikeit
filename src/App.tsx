import { AppProvider, useRoute } from "./state";
import { BrandMark } from "./components/viz";
import { VERSIONS, FLOTILLA } from "./versions";
import { Home } from "./routes/Home";
import { Taste } from "./routes/Taste";
import { Predict } from "./routes/Predict";
import { Result } from "./routes/Result";
import { After } from "./routes/After";
import { Log } from "./routes/Log";
import { About } from "./routes/About";
import { RouteBoundary } from "./components/RouteBoundary";

export function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}

function Shell() {
  const r = useRoute();
  const page = r[0] ?? "";
  let body: JSX.Element;
  switch (page) {
    case "taste":
      body = <Taste id={r[1]} />;
      break;
    case "predict":
      body = <Predict />;
      break;
    case "r":
      body = <Result batchId={r[1]} focus={r[2]} />;
      break;
    case "after":
      body = <After fitId={r[1]} />;
      break;
    case "log":
      body = <Log />;
      break;
    case "about":
      body = <About />;
      break;
    default:
      body = <Home />;
  }
  const nav = [
    ["taste", "Taste"],
    ["predict", "Predict"],
    ["log", "Log"],
    ["about", "How", "opt"]
  ];
  return (
    <>
      <div className="flotilla" aria-hidden="true" title="JRF · MP6 · WillULikeIT · FEELLLM">
        <span className="f-jrf" />
        <span className="f-mp6" />
        <span className="f-wulit" />
        <span className="f-feel" />
      </div>
      <div className="wrap">
        <header className="topbar">
          <a className="brand" href="#/">
            <BrandMark />
            <span>
              <span className="brand-name">
                Will U Like <em>It?</em>
              </span>
              <span className="brand-sub">willulikeit.org · sensory fit</span>
            </span>
          </a>
          <nav className="nav" aria-label="Main">
            {nav.map(([k, t, c]) => (
              <a key={k} href={`#/${k}`} className={c} aria-current={page === k || (k === "predict" && (page === "r" || page === "after")) ? "page" : undefined}>
                {t}
              </a>
            ))}
          </nav>
        </header>
        <main><RouteBoundary routeKey={r.join("/")}>{body}</RouteBoundary></main>
        <footer className="site">
          <div>
            <b>WillULikeIT</b> — experimental Ajinomatrix project with FEELLLM.org. Predictions are estimates, not validated probabilities. Everything stays in your browser unless you export it.
          </div>
          <div className="links">
            <a href={FLOTILLA.jrf}>jrf.recipes</a>
            <a href={FLOTILLA.studio}>ajinoverse.studio</a>
            <a href={FLOTILLA.recorder}>record.mp6.app</a>
            <a href={FLOTILLA.mp6}>mp6.app</a>
            <a href={FLOTILLA.feelllm}>feelllm.org</a>
            <a href="#/about">method &amp; honesty rules</a>
          </div>
          <div className="vers">
            {VERSIONS.app} · {VERSIONS.fit} · {VERSIONS.mp6} · {VERSIONS.jrf} · {VERSIONS.brief}
          </div>
        </footer>
      </div>
    </>
  );
}
