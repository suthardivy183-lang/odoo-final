import * as React from "react";
import {
  Search,
  User,
  Menu,
  X,
  Star,
  Clock,
  Calendar,
  Play,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

const VIDEO_URL =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260406_094145_4a271a6c-3869-4f1c-8aa7-aeb0cb227994.mp4";

const NAV_LINKS = ["Movies", "TV Series", "Editor's Pick", "Interviews", "User Reviews"];

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

export default function Landing() {
  const [menuOpen, setMenuOpen] = React.useState(false);

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-black font-sans text-white">
      <style>{STYLES}</style>

      {/* Background video */}
      <video
        className="fixed inset-0 z-0 h-full w-full object-cover"
        src={VIDEO_URL}
        autoPlay
        loop
        muted
        playsInline
      />

      {/* Bottom blur overlay (blur only, no darkening) */}
      <div
        className="pointer-events-none fixed inset-0 z-[1] backdrop-blur-xl"
        style={{
          WebkitMaskImage: "linear-gradient(to top, black 0%, transparent 45%)",
          maskImage: "linear-gradient(to top, black 0%, transparent 45%)",
        }}
      />

      {/* Navbar */}
      <nav className="relative z-50 flex items-center justify-between px-4 py-4 sm:px-6 md:px-12 md:py-6">
        {/* Logo */}
        <div
          className="animate-blur-fade-up flex h-8 items-center text-xl font-bold tracking-[-0.04em] md:h-10 md:text-2xl"
          style={{ animationDelay: "0ms" }}
        >
          CINEMATIC
        </div>

        {/* Desktop nav links */}
        <div className="hidden items-center gap-8 lg:flex">
          {NAV_LINKS.map((link, i) => (
            <a
              key={link}
              href="#"
              className="animate-blur-fade-up text-sm text-white transition-colors hover:text-gray-300"
              style={{ animationDelay: `${100 + i * 50}ms` }}
            >
              {link}
            </a>
          ))}
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-3">
          {/* Search (sm+) */}
          <button
            className="animate-blur-fade-up hidden items-center gap-2 rounded-full px-4 py-2 text-sm font-medium liquid-glass sm:flex md:px-6"
            style={{ animationDelay: "350ms" }}
          >
            <span>Search</span>
            <Search size={18} />
          </button>

          {/* User (sm+) */}
          <button
            className="animate-blur-fade-up hidden h-10 w-10 items-center justify-center rounded-full liquid-glass sm:flex"
            style={{ animationDelay: "400ms" }}
            aria-label="Profile"
          >
            <User size={18} />
          </button>

          {/* Hamburger (below lg) */}
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="animate-blur-fade-up relative flex h-10 w-10 items-center justify-center rounded-full liquid-glass lg:hidden"
            style={{ animationDelay: "350ms" }}
            aria-label="Menu"
          >
            <Menu
              size={18}
              className={`absolute transition-all duration-500 ease-out ${
                menuOpen ? "rotate-180 scale-50 opacity-0" : "rotate-0 scale-100 opacity-100"
              }`}
            />
            <X
              size={18}
              className={`absolute transition-all duration-500 ease-out ${
                menuOpen ? "rotate-0 scale-100 opacity-100" : "-rotate-180 scale-50 opacity-0"
              }`}
            />
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      <div
        className={`absolute left-0 right-0 top-[72px] z-40 border-b border-t border-gray-800 bg-gray-900/95 shadow-2xl backdrop-blur-lg transition-all duration-500 ease-out lg:hidden ${
          menuOpen ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-4 opacity-0"
        }`}
      >
        <div className="flex flex-col gap-1 px-4 py-3 sm:px-6">
          {NAV_LINKS.map((link, i) => (
            <a
              key={link}
              href="#"
              className="rounded-lg px-3 py-3 text-sm text-white transition-all hover:bg-gray-800/50"
              style={{
                transform: menuOpen ? "translateX(0)" : "translateX(-12px)",
                opacity: menuOpen ? 1 : 0,
                transition: `all 500ms ease-out ${i * 50}ms`,
              }}
            >
              {link}
            </a>
          ))}

          {/* Search + profile below sm */}
          <div className="mt-2 flex items-center gap-3 border-t border-gray-800 pt-3 sm:hidden">
            <button className="flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium liquid-glass">
              <span>Search</span>
              <Search size={18} />
            </button>
            <button
              className="flex h-10 w-10 items-center justify-center rounded-full liquid-glass"
              aria-label="Profile"
            >
              <User size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Hero content */}
      <main className="relative z-10 flex flex-1 flex-col justify-end px-4 pb-8 sm:px-6 md:px-12 md:pb-16">
        <div className="flex flex-col items-end gap-8 md:flex-row">
          {/* Left */}
          <div className="flex-1">
            {/* Metadata */}
            <div
              className="animate-blur-fade-up mb-6 flex flex-wrap items-center gap-3 text-xs sm:gap-6 sm:text-sm md:mb-8"
              style={{ animationDelay: "300ms" }}
            >
              <span className="flex items-center gap-2">
                <Star size={16} className="fill-white sm:h-5 sm:w-5" />
                <span className="font-medium">8.7/10 IMDB</span>
              </span>
              <span className="flex items-center gap-2">
                <Clock size={16} className="sm:h-5 sm:w-5" />
                <span>132 min</span>
              </span>
              <span className="flex items-center gap-2">
                <Calendar size={16} className="sm:h-5 sm:w-5" />
                <span>April, 2025</span>
              </span>
            </div>

            {/* Title */}
            <h1
              className="animate-blur-fade-up mb-4 text-3xl font-normal sm:text-5xl md:mb-6 md:text-6xl lg:text-7xl"
              style={{ animationDelay: "400ms", letterSpacing: "-0.04em" }}
            >
              Step Through. Work Smarter.
            </h1>

            {/* Description */}
            <p
              className="animate-blur-fade-up mb-6 max-w-2xl text-base text-gray-400 sm:text-lg md:mb-12 md:text-xl"
              style={{ animationDelay: "500ms" }}
            >
              A voyage through forgotten realms, where past and future intertwine.
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap gap-3 sm:gap-4">
              <button
                className="animate-blur-fade-up flex items-center gap-2 rounded-full bg-white px-6 py-2.5 font-medium text-black transition-colors hover:bg-gray-200 sm:px-8 sm:py-3"
                style={{ animationDelay: "600ms" }}
              >
                <Play size={18} className="fill-black" />
                <span>Watch Now</span>
              </button>
              <button
                className="animate-blur-fade-up rounded-full px-6 py-2.5 font-medium liquid-glass sm:px-8 sm:py-3"
                style={{ animationDelay: "700ms" }}
              >
                Learn More
              </button>
            </div>
          </div>

          {/* Right: nav arrows */}
          <div className="flex gap-3 self-start md:w-auto md:self-end">
            <button
              className="animate-blur-fade-up flex items-center gap-2 rounded-full px-4 py-2.5 font-medium liquid-glass sm:px-6 sm:py-3"
              style={{ animationDelay: "800ms" }}
            >
              <ChevronLeft size={18} />
              <span>Previous</span>
            </button>
            <button
              className="animate-blur-fade-up flex items-center gap-2 rounded-full px-4 py-2.5 font-medium liquid-glass sm:px-6 sm:py-3"
              style={{ animationDelay: "900ms" }}
            >
              <span>Next</span>
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
