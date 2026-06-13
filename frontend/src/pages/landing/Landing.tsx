import * as React from "react";
import { Link } from "react-router-dom";
import {
  Menu,
  X,
  ArrowRight,
  Boxes,
  Gauge,
  ShoppingCart,
  Factory,
  Warehouse,
  Truck,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

const VIDEO_URL =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260406_094145_4a271a6c-3869-4f1c-8aa7-aeb0cb227994.mp4";

const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "About", href: "#about" },
];

const FEATURES = [
  { icon: Gauge, title: "AI Operations Center", desc: "A prioritized action queue that surfaces what's broken and what to do next — not just another dashboard." },
  { icon: ShoppingCart, title: "Sales & Procurement", desc: "Confirm sales orders to reserve stock and auto-trigger the purchasing your demand actually needs." },
  { icon: Factory, title: "Manufacturing & BOM", desc: "Plan, produce, and track work orders against multi-level bills of materials end to end." },
  { icon: Warehouse, title: "Inventory & Warehouse", desc: "Real-time on-hand, reserved, and free-to-use stock with shelf-level location mapping." },
  { icon: Truck, title: "Procurement Automation", desc: "Replenish on demand — the system raises purchase or manufacturing orders before you run out." },
  { icon: ShieldCheck, title: "Roles & Audit Trail", desc: "Six-role access control and a business-readable activity timeline of every change." },
];

const STYLES = `
  .liquid-glass {
    background: rgba(255, 255, 255, 0.01);
    background-blend-mode: luminosity;
    -webkit-backdrop-filter: blur(4px);
    backdrop-filter: blur(4px);
    border: none;
    box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.1);
    position: relative;
    overflow: hidden;
  }
  .liquid-glass::before {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: inherit;
    padding: 1.4px;
    background: linear-gradient(
      180deg,
      rgba(255, 255, 255, 0.45) 0%,
      rgba(255, 255, 255, 0.15) 20%,
      rgba(255, 255, 255, 0) 40%,
      rgba(255, 255, 255, 0) 60%,
      rgba(255, 255, 255, 0.15) 80%,
      rgba(255, 255, 255, 0.45) 100%
    );
    -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    -webkit-mask-composite: xor;
    mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    mask-composite: exclude;
    pointer-events: none;
  }
  @keyframes blurFadeUp {
    from { opacity: 0; filter: blur(20px); transform: translateY(40px); }
    to { opacity: 1; filter: blur(0); transform: translateY(0); }
  }
  .animate-blur-fade-up {
    opacity: 0;
    animation: blurFadeUp 1s ease-out forwards;
  }
`;

function BrandMark() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-red-500 to-red-700 shadow-lg shadow-red-600/30">
        <Boxes className="h-[18px] w-[18px]" />
      </span>
      <span className="text-lg font-semibold tracking-[-0.02em]">Shiv Furniture</span>
    </div>
  );
}

export default function Landing() {
  const [menuOpen, setMenuOpen] = React.useState(false);

  return (
    <div className="relative bg-black font-sans text-white">
      <style>{STYLES}</style>

      {/* Background video (behind the hero) */}
      <video
        className="fixed inset-0 z-0 h-full w-full object-cover"
        src={VIDEO_URL}
        autoPlay
        loop
        muted
        playsInline
      />
      {/* Bottom blur overlay — blur only, no darkening */}
      <div
        className="pointer-events-none fixed inset-0 z-[1] backdrop-blur-xl"
        style={{
          WebkitMaskImage: "linear-gradient(to top, black 0%, transparent 45%)",
          maskImage: "linear-gradient(to top, black 0%, transparent 45%)",
        }}
      />

      {/* ───────────── HERO ───────────── */}
      <section className="relative z-10 flex min-h-screen flex-col">
        {/* Navbar */}
        <nav className="flex items-center justify-between px-4 py-4 sm:px-6 md:px-12 md:py-6">
          <div className="animate-blur-fade-up" style={{ animationDelay: "0ms" }}>
            <BrandMark />
          </div>

          {/* Desktop nav links */}
          <div className="hidden items-center gap-8 lg:flex">
            {NAV_LINKS.map((link, i) => (
              <a
                key={link.label}
                href={link.href}
                className="animate-blur-fade-up text-sm text-white/90 transition-colors hover:text-white"
                style={{ animationDelay: `${100 + i * 50}ms` }}
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* Auth actions */}
          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="animate-blur-fade-up hidden rounded-full px-5 py-2 text-sm font-medium liquid-glass sm:inline-flex sm:items-center"
              style={{ animationDelay: "300ms" }}
            >
              Log in
            </Link>
            <Link
              to="/login"
              className="animate-blur-fade-up hidden items-center gap-1.5 rounded-full bg-red-600 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-red-600/30 transition-colors hover:bg-red-700 sm:inline-flex"
              style={{ animationDelay: "350ms" }}
            >
              Sign up <ArrowRight className="h-4 w-4" />
            </Link>

            {/* Hamburger (below lg) */}
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="animate-blur-fade-up relative flex h-10 w-10 items-center justify-center rounded-full liquid-glass lg:hidden"
              style={{ animationDelay: "300ms" }}
              aria-label="Menu"
            >
              <Menu
                size={18}
                className={`absolute transition-all duration-500 ease-out ${menuOpen ? "rotate-180 scale-50 opacity-0" : "rotate-0 scale-100 opacity-100"}`}
              />
              <X
                size={18}
                className={`absolute transition-all duration-500 ease-out ${menuOpen ? "rotate-0 scale-100 opacity-100" : "-rotate-180 scale-50 opacity-0"}`}
              />
            </button>
          </div>
        </nav>

        {/* Mobile menu */}
        <div
          className={`absolute left-0 right-0 top-[72px] z-40 border-b border-t border-gray-800 bg-gray-900/95 shadow-2xl backdrop-blur-lg transition-all duration-500 ease-out lg:hidden ${menuOpen ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-4 opacity-0"}`}
        >
          <div className="flex flex-col gap-1 px-4 py-3 sm:px-6">
            {NAV_LINKS.map((link, i) => (
              <a
                key={link.label}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="rounded-lg px-3 py-3 text-sm text-white transition-all hover:bg-gray-800/50"
                style={{ transform: menuOpen ? "translateX(0)" : "translateX(-12px)", opacity: menuOpen ? 1 : 0, transition: `all 500ms ease-out ${i * 50}ms` }}
              >
                {link.label}
              </a>
            ))}
            <div className="mt-2 flex items-center gap-3 border-t border-gray-800 pt-3">
              <Link to="/login" className="flex flex-1 items-center justify-center rounded-full px-4 py-2.5 text-sm font-medium liquid-glass">Log in</Link>
              <Link to="/login" className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-red-600 px-4 py-2.5 text-sm font-semibold text-white">Sign up <ArrowRight className="h-4 w-4" /></Link>
            </div>
          </div>
        </div>

        {/* Hero content (bottom) */}
        <div className="flex flex-1 flex-col justify-end px-4 pb-12 sm:px-6 md:px-12 md:pb-20">
          <div className="max-w-3xl">
            <div
              className="animate-blur-fade-up mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-white/80"
              style={{ animationDelay: "300ms" }}
            >
              <Sparkles className="h-3.5 w-3.5 text-red-400" />
              AI-native operations platform
            </div>

            <h1
              className="animate-blur-fade-up mb-4 text-3xl font-normal sm:text-5xl md:mb-6 md:text-6xl lg:text-7xl"
              style={{ animationDelay: "400ms", letterSpacing: "-0.04em" }}
            >
              From demand to delivery,<br className="hidden sm:block" /> in one system.
            </h1>

            <p
              className="animate-blur-fade-up mb-8 max-w-2xl text-base text-gray-300 sm:text-lg md:text-xl"
              style={{ animationDelay: "500ms" }}
            >
              Shiv Furniture Works ERP unifies sales, procurement, manufacturing, and inventory —
              with an AI operations center that tells your team what to do next.
            </p>

            <div className="flex flex-wrap gap-3 sm:gap-4">
              <Link
                to="/login"
                className="animate-blur-fade-up flex items-center gap-2 rounded-full bg-red-600 px-7 py-3 font-semibold text-white shadow-lg shadow-red-600/30 transition-colors hover:bg-red-700"
                style={{ animationDelay: "600ms" }}
              >
                Get started <ArrowRight className="h-[18px] w-[18px]" />
              </Link>
              <a
                href="#features"
                className="animate-blur-fade-up rounded-full px-7 py-3 font-medium liquid-glass"
                style={{ animationDelay: "700ms" }}
              >
                Explore features
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ───────────── FEATURES ───────────── */}
      <section id="features" className="relative z-10 bg-black px-4 py-20 sm:px-6 md:px-12 md:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-2xl">
            <div className="mb-3 text-sm font-semibold uppercase tracking-wider text-red-400">Features</div>
            <h2 className="text-3xl font-semibold tracking-[-0.03em] sm:text-4xl md:text-5xl">Everything it takes to run the floor</h2>
            <p className="mt-4 text-base text-gray-400 sm:text-lg">
              One connected system across the entire operation — so a single sale flows straight through to procurement, production, and stock.
            </p>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition-colors hover:border-white/20 hover:bg-white/[0.05]">
                <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-red-500/20 to-red-700/20 text-red-400 ring-1 ring-red-500/20">
                  <f.icon className="h-5 w-5" />
                </span>
                <h3 className="text-lg font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-400">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────── ABOUT ───────────── */}
      <section id="about" className="relative z-10 border-t border-white/10 bg-black px-4 py-20 sm:px-6 md:px-12 md:py-28">
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            <div className="mb-3 text-sm font-semibold uppercase tracking-wider text-red-400">About</div>
            <h2 className="text-3xl font-semibold tracking-[-0.03em] sm:text-4xl md:text-5xl">Built for makers, from demand to delivery</h2>
            <p className="mt-5 text-base leading-relaxed text-gray-400 sm:text-lg">
              Shiv Furniture Works is a modern mini-ERP for manufacturing businesses. It replaces
              spreadsheets and disconnected tools with one operational backbone — capturing customer
              demand, reserving inventory, planning production against bills of materials, and
              automatically procuring what's short.
            </p>
            <p className="mt-4 text-base leading-relaxed text-gray-400 sm:text-lg">
              An AI operations center continuously watches the business and turns raw data into a
              ranked list of decisions, so teams spend less time hunting through screens and more
              time keeping product moving.
            </p>
            <Link
              to="/login"
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-red-600 px-7 py-3 font-semibold text-white shadow-lg shadow-red-600/30 transition-colors hover:bg-red-700"
            >
              Get started <ArrowRight className="h-[18px] w-[18px]" />
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {[
              { k: "6", v: "operational modules" },
              { k: "6", v: "access roles" },
              { k: "Real-time", v: "inventory & readiness" },
              { k: "End-to-end", v: "demand to delivery" },
            ].map((s) => (
              <div key={s.v} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                <div className="text-3xl font-semibold tracking-tight text-white">{s.k}</div>
                <div className="mt-1 text-sm text-gray-400">{s.v}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────── FOOTER ───────────── */}
      <footer className="relative z-10 border-t border-white/10 bg-black px-4 py-10 sm:px-6 md:px-12">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
          <BrandMark />
          <p className="text-sm text-gray-500">© {new Date().getFullYear()} Shiv Furniture Works · Mini ERP</p>
          <div className="flex items-center gap-3">
            <Link to="/login" className="rounded-full px-5 py-2 text-sm font-medium liquid-glass">Log in</Link>
            <Link to="/login" className="rounded-full bg-red-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700">Sign up</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
