import { Cloud, Crown, Shield, User } from "lucide-react";
import { Portal, portalHome } from "../api";
import { PRODUCT_NAME } from "../lib/brand";

export function PortalLanding() {
  const portals: { id: Portal; title: string; blurb: string; icon: React.ElementType; accent: "green" | "red" }[] = [
    { id: "user", title: "User portal", blurb: "Files, sharing, trash, and AI assistant", icon: User, accent: "green" },
    { id: "admin", title: "Admin portal", blurb: "Workspace analytics, members, and settings", icon: Shield, accent: "green" },
    { id: "system", title: "Super Admin", blurb: "Manage every workspace and administrator", icon: Crown, accent: "red" },
  ];

  return (
    // Page shell: black base so the photo never washes out white text
    <div className="relative min-h-screen overflow-hidden bg-black flex items-center justify-center p-6">
      {/* Full-bleed photo + slow zoom (same effect as before) */}
      <div
        className="absolute inset-[-4%] bg-cover bg-center bg-no-repeat brightness-[0.45] contrast-110 hero-drift"
        style={{ backgroundImage: "url('/CloudImage.jpg')" }}
        aria-hidden="true"
      />

      {/* Dark veil = high contrast for white text on the image */}
      <div
        className="absolute inset-0 bg-gradient-to-b from-black/75 via-black/50 to-black/80"
        aria-hidden="true"
      />

      {/* Brand signal bar: dark green → pure red */}
      <div className="absolute top-0 inset-x-0 h-[3px] z-20 bg-gradient-to-r from-[#145A32] via-[#145A32] to-[#FF0000]" />

      <div className="relative z-10 w-full max-w-5xl animate-in fade-in slide-in-from-bottom-2 duration-700">
        {/* Header — white + drop shadow so it stays readable on any photo area */}
        <div className="text-center mb-10">
          <div className="w-14 h-14 rounded-xl nexus-mark flex items-center justify-center mx-auto mb-4">
            <Cloud className="w-6 h-6 text-white" />
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#7CFFB2] drop-shadow-[0_1px_8px_rgba(0,0,0,0.9)] mb-3">
            Cloud storage operations platform
          </p>
          <h1 className="font-brand text-3xl sm:text-5xl text-white drop-shadow-[0_2px_16px_rgba(0,0,0,0.95)]">
            {PRODUCT_NAME}
          </h1>
          <p className="mt-4 text-sm sm:text-base text-white/90 max-w-xl mx-auto leading-relaxed drop-shadow-[0_1px_10px_rgba(0,0,0,0.9)]">
            Industrial-grade cloud storage. Select a portal — each session stays isolated.
          </p>
        </div>

        {/* Portal cards — dark glass so text stays bright white */}
        <div className="grid sm:grid-cols-3 gap-4">
          {portals.map(({ id, title, blurb, icon: Icon, accent }, index) => (
            <a
              key={id}
              href={portalHome(id)}
              className="group rounded-xl border border-white/25 bg-black/70 backdrop-blur-md p-5 shadow-2xl transition hover:-translate-y-1 hover:border-white/40 hover:bg-black/80"
            >
              <div className="flex items-start justify-between mb-4">
                <div
                  className={
                    accent === "red"
                      ? "w-10 h-10 rounded-lg flex items-center justify-center bg-red-500/20"
                      : "w-10 h-10 rounded-lg flex items-center justify-center bg-green-500/20"
                  }
                >
                  <Icon className={accent === "red" ? "w-4 h-4 text-red-400" : "w-4 h-4 text-green-400"} />
                </div>
                <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/50">
                  0{index + 1}
                </span>
              </div>

              <p className="text-lg font-bold text-white">{title}</p>
              <p className="text-xs text-white/75 mt-1.5 leading-relaxed">{blurb}</p>
              <p className="mt-5 text-xs font-bold uppercase tracking-[0.12em] text-green-400 group-hover:text-red-500 transition-colors">
                Open /{id} →
              </p>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
