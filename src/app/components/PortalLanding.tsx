import { useEffect, useState } from "react";
import { Bot, Check, Cloud, Crown, FolderLock, Share2, Shield, ShieldCheck, Trash2, User, Users } from "lucide-react";
import { Portal, portalHome } from "../api";
import { PRODUCT_NAME, PRODUCT_NAME_SHORT } from "../lib/brand";

const navLinks = [
  { href: "#features", label: "Features" },
  { href: "#pricing", label: "Pricing" },
  { href: "#request", label: "Request" },
  { href: "#portals", label: "Portals" },
];

const features = [
  {
    title: "Private file library",
    blurb: "Upload, browse, and organize workspace files with quotas that stay visible.",
    icon: FolderLock,
  },
  {
    title: "Controlled sharing",
    blurb: "Send files to people you choose. Shared items stay separate from your own library.",
    icon: Share2,
  },
  {
    title: "Scan before it lands",
    blurb: "Uploads are checked before they are stored, so a bad file never becomes the copy of record.",
    icon: ShieldCheck,
  },
  {
    title: "AI assistant",
    blurb: "Ask questions about your files without leaving the workspace.",
    icon: Bot,
  },
  {
    title: "Friends chat",
    blurb: "Talk with people in the same workspace, next to the files you are working on.",
    icon: Users,
  },
  {
    title: "Trash you can undo",
    blurb: "Deleted files wait in trash until you restore them or clear them for good.",
    icon: Trash2,
  },
];

const steps = [
  { title: "Choose a portal", blurb: "User, admin, or super admin. Each sign-in stays in its own session." },
  { title: "Work in the library", blurb: "Upload, share, chat, and ask the assistant from the same workspace." },
  { title: "Keep oversight", blurb: "Admins watch the workspace. Super admin watches every workspace." },
];

const plans = [
  {
    name: "Member",
    storage: "50 GB",
    detail: "For people joining a workspace",
    points: ["Personal file library", "Sharing and trash", "Friends chat and AI assistant"],
    cta: "Enter user portal",
    href: "/user",
    featured: false,
  },
  {
    name: "Workspace",
    storage: "100 GB",
    detail: "For the admin who runs the workspace",
    points: ["You become the administrator", "Members, analytics, and settings", "Scan on every upload"],
    cta: "Request a workspace",
    href: "#request",
    featured: true,
  },
  {
    name: "Allocated",
    storage: "Custom",
    detail: "Storage set by the super admin",
    points: ["Quota raised above 100 GB", "Every workspace in one console", "Suspend or restore access"],
    cta: "Open super admin",
    href: "/system",
    featured: false,
  },
];

const portals: { id: Portal; title: string; blurb: string; icon: React.ElementType; accent: "green" | "red" }[] = [
  { id: "user", title: "User portal", blurb: "Files, sharing, trash, chat, and the AI assistant.", icon: User, accent: "green" },
  { id: "admin", title: "Admin portal", blurb: "Workspace analytics, members, and settings.", icon: Shield, accent: "green" },
  { id: "system", title: "Super Admin", blurb: "Every workspace and every administrator.", icon: Crown, accent: "red" },
];

export function PortalLanding() {
  const [solid, setSolid] = useState(false);

  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="landing-root relative min-h-screen bg-[#F4F7F5] text-[#0A1F14]">
      <header className={solid ? "landing-nav is-solid" : "landing-nav"}>
        <div className="h-[3px] bg-[#145A32]" />
        <nav className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-6">
          <a href="#top" className="flex min-w-0 items-center gap-2.5 text-[#0A1F14]">
            <span className="nexus-mark flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
              <Cloud className="h-4 w-4 text-white" />
            </span>
            <span className="truncate font-brand text-sm leading-tight">{PRODUCT_NAME_SHORT}</span>
          </a>

          <div className="ml-2 flex min-w-0 items-center gap-0.5 overflow-x-auto">
            {navLinks.map((link) => (
              <a key={link.href} href={link.href} className="landing-nav-link shrink-0 px-3 py-1.5 text-sm font-medium">
                {link.label}
              </a>
            ))}
          </div>

          <a
            href={portalHome("user")}
            className="ml-auto shrink-0 rounded-lg bg-[#145A32] px-4 py-2 text-sm font-semibold text-white transition duration-200 hover:bg-[#1B7A44]"
          >
            Open workspace
          </a>
        </nav>
      </header>

      <section id="top" className="relative flex min-h-[calc(100svh-4.25rem)] items-center overflow-hidden bg-[#07140e]">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat hero-drift"
          style={{ backgroundImage: "url('/CloudImage.jpg')" }}
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/50 to-black/10" aria-hidden="true" />

        <div className="landing-rise relative z-10 mx-auto w-full max-w-6xl px-6 py-20">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-[#B7F5CF]">
            Data storage operations platform
          </p>
          <h1 className="font-brand max-w-3xl text-4xl text-white sm:text-6xl">
            {PRODUCT_NAME}
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-white/90 sm:text-lg">
            Store files, share them with the right people, and run each workspace from its own portal.
            Sessions stay isolated.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a
              href={portalHome("user")}
              className="rounded-lg bg-[#145A32] px-5 py-3 text-sm font-semibold text-white transition duration-200 hover:bg-[#1B7A44]"
            >
              Enter user portal
            </a>
            <a
              href="#portals"
              className="rounded-lg border border-white/40 px-5 py-3 text-sm font-semibold text-white transition duration-200 hover:bg-white/10"
            >
              Choose a portal
            </a>
          </div>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-6xl scroll-mt-24 px-6 py-20">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#145A32]">What you get</p>
        <h2 className="font-display mt-2 max-w-lg text-3xl text-[#0A1F14] sm:text-4xl">
          One workspace for files, people, and oversight
        </h2>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ title, blurb, icon: Icon }, index) => (
            <article
              key={title}
              className="landing-card landing-rise rounded-2xl p-6"
              style={{ animationDelay: `${index * 70}ms` }}
            >
              <div className="landing-card-icon mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-[#E8F5EE] text-[#145A32]">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="text-base font-semibold text-[#0A1F14]">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#4A5C52]">{blurb}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="security" className="scroll-mt-24 border-y border-[rgba(10,31,20,0.1)] bg-white">
        <div className="mx-auto grid max-w-6xl gap-8 px-6 py-16 md:grid-cols-[1.1fr_0.9fr] md:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#145A32]">Security</p>
            <h2 className="font-display mt-2 text-3xl text-[#0A1F14] sm:text-4xl">Checked files. Separate sessions.</h2>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-[#4A5C52]">
              Uploads are scanned before they are stored. User, admin, and super admin each sign in on their own path, so one role cannot wander into another.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <article className="landing-card rounded-2xl p-5">
              <ShieldCheck className="mb-3 h-5 w-5 text-[#145A32]" />
              <h3 className="font-semibold">Scan on upload</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-[#4A5C52]">A file is stored only after the check finishes.</p>
            </article>
            <article className="landing-card rounded-2xl p-5">
              <Shield className="mb-3 h-5 w-5 text-[#FF0000]" />
              <h3 className="font-semibold">Role portals</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-[#4A5C52]">Three doors. Three sessions. No shared login screen.</p>
            </article>
          </div>
        </div>
      </section>

      <section id="workflow" className="scroll-mt-24">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#145A32]">Workflow</p>
          <h2 className="font-display mt-2 text-3xl text-[#0A1F14] sm:text-4xl">Three steps, then you are in</h2>
          <ol className="mt-10 grid gap-5 md:grid-cols-3">
            {steps.map((step, index) => (
              <li key={step.title} className="landing-card rounded-2xl p-6">
                <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#145A32]">0{index + 1}</span>
                <h3 className="mt-3 text-lg font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#4A5C52]">{step.blurb}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="pricing" className="scroll-mt-24 border-t border-[rgba(10,31,20,0.08)] bg-white">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#145A32]">Pricing</p>
          <h2 className="font-display mt-2 max-w-lg text-3xl text-[#0A1F14] sm:text-4xl">Storage that matches the role</h2>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-[#4A5C52]">
            Members start at 50 GB. A new workspace includes 100 GB. The super admin can raise that total later.
          </p>
          <div className="mt-10 grid items-stretch gap-5 lg:grid-cols-3">
            {plans.map((plan) => (
              <article
                key={plan.name}
                className={`flex flex-col rounded-2xl border p-6 ${
                  plan.featured
                    ? "border-[#145A32] bg-[#0A1F14] text-white shadow-xl"
                    : "border-[rgba(10,31,20,0.1)] bg-[#F4F7F5] text-[#0A1F14]"
                }`}
              >
                <p className={`text-xs font-semibold uppercase tracking-[0.14em] ${plan.featured ? "text-[#B7F5CF]" : "text-[#145A32]"}`}>
                  {plan.featured ? "For admins" : "Included"}
                </p>
                <h3 className="mt-3 text-lg font-semibold">{plan.name}</h3>
                <p className="font-brand text-4xl leading-none">{plan.storage}</p>
                <p className={`mt-2 text-sm ${plan.featured ? "text-white/75" : "text-[#4A5C52]"}`}>{plan.detail}</p>
                <ul className="mt-6 space-y-2.5 text-sm">
                  {plan.points.map((point) => (
                    <li key={point} className="flex items-start gap-2">
                      <Check className={`mt-0.5 h-4 w-4 shrink-0 ${plan.featured ? "text-[#B7F5CF]" : "text-[#145A32]"}`} />
                      <span className={plan.featured ? "text-white/90" : "text-[#4A5C52]"}>{point}</span>
                    </li>
                  ))}
                </ul>
                <a
                  href={plan.href}
                  className={`mt-8 inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold transition duration-200 ${
                    plan.featured
                      ? "bg-white text-[#145A32] hover:bg-[#E8F5EE]"
                      : "bg-[#145A32] text-white hover:bg-[#1B7A44]"
                  }`}
                >
                  {plan.cta}
                </a>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="request" className="scroll-mt-24">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-6 py-20 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#145A32]">Request a workspace</p>
            <h2 className="font-display mt-2 text-3xl text-[#0A1F14] sm:text-4xl">Open an admin workspace</h2>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-[#4A5C52]">
              Ask for a workspace and you become its administrator. You name the organization, then add members from the admin portal.
            </p>
            <ul className="mt-6 space-y-2 text-sm text-[#4A5C52]">
              <li>Your name, organization, and email</li>
              <li>A password of at least 8 characters</li>
              <li>Sign-in stays on the admin portal</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-[rgba(10,31,20,0.1)] bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold">Workspace request</p>
            <p className="mt-1 text-sm leading-relaxed text-[#4A5C52]">
              This opens the admin form. The workspace is created when you submit it there.
            </p>
            <a
              href="/admin?request=workspace"
              className="mt-6 inline-flex w-full items-center justify-center rounded-lg bg-[#145A32] px-4 py-3 text-sm font-semibold text-white transition duration-200 hover:bg-[#1B7A44]"
            >
              Request workspace as admin
            </a>
            <a href={portalHome("admin")} className="mt-3 block text-center text-sm text-[#145A32] hover:underline">
              Already an admin? Sign in
            </a>
          </div>
        </div>
      </section>

      <section id="portals" className="scroll-mt-24 bg-[#07140e]">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#7CFFB2]">Sign in</p>
          <h2 className="font-display mt-2 text-3xl text-white sm:text-4xl">Pick the portal that matches your role</h2>
          <div className="mt-10 grid gap-5 sm:grid-cols-3">
            {portals.map(({ id, title, blurb, icon: Icon, accent }, index) => (
              <a
                key={id}
                href={portalHome(id)}
                className={`landing-portal group rounded-2xl p-6 text-white ${accent === "red" ? "landing-portal--signal" : ""}`}
              >
                <div className="mb-8 flex items-start justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10">
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="text-3xl font-bold text-white/15">0{index + 1}</span>
                </div>
                <p className="text-xl font-semibold">{title}</p>
                <p className="mt-2 text-sm leading-relaxed text-white/75">{blurb}</p>
                <p className="landing-portal-go mt-6 text-xs font-bold uppercase tracking-[0.12em] text-white">
                  Open /{id} <span aria-hidden="true">→</span>
                </p>
              </a>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-[rgba(10,31,20,0.1)] bg-white text-[#0A1F14]">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-14 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2">
            <a href="#top" className="flex items-center gap-2.5">
              <span className="nexus-mark flex h-9 w-9 items-center justify-center rounded-lg">
                <Cloud className="h-4 w-4 text-white" />
              </span>
              <span className="font-brand text-sm leading-tight">{PRODUCT_NAME}</span>
            </a>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-[#4A5C52]">
              Files, sharing, and oversight for each workspace. Every portal keeps its own session.
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#145A32]">Explore</p>
            <ul className="mt-4 space-y-2.5 text-sm">
              {navLinks.map((link) => (
                <li key={link.href}>
                  <a href={link.href} className="text-[#4A5C52] transition-colors hover:text-[#145A32]">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#145A32]">Portals</p>
            <ul className="mt-4 space-y-2.5 text-sm">
              {portals.map((portal) => (
                <li key={portal.id}>
                  <a href={portalHome(portal.id)} className="text-[#4A5C52] transition-colors hover:text-[#145A32]">
                    {portal.title}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="border-t border-[rgba(10,31,20,0.08)]">
          <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-5 text-xs text-[#4A5C52] sm:flex-row sm:items-center sm:justify-between">
            <p>{PRODUCT_NAME}</p>
            <p>User, admin, and super admin sign in separately.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
