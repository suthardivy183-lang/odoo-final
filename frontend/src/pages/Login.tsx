import * as React from "react";
import { useNavigate } from "react-router-dom";
import { Boxes, Sparkles, ShieldCheck, Activity, ArrowRight } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { homePath } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const HIGHLIGHTS = [
  { icon: Sparkles, title: "AI Operations Center", desc: "Surfaces what's broken and what to do next — not just dashboards." },
  { icon: Activity, title: "Live readiness signals", desc: "Know if you can build, what's short, and what to procure in real time." },
  { icon: ShieldCheck, title: "Auditable by design", desc: "Every action recorded as a business-readable activity timeline." },
];

const DEMO_ACCOUNTS = [
  { role: "Admin", user: "admin", pass: "admin123" },
  { role: "Sales", user: "sales", pass: "sales123" },
  { role: "Purchase", user: "purchase", pass: "purchase123" },
  { role: "Manufacturing", user: "manufacturing", pass: "manufacturing123" },
  { role: "Inventory Mgr", user: "inventory", pass: "inventory123" },
  { role: "Business Owner", user: "owner", pass: "owner123" },
];

export default function Login() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = React.useState("admin");
  const [password, setPassword] = React.useState("admin123");
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (user) navigate(homePath(user.role));
  }, [user, navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const u = await login(username, password);
      navigate(homePath(u.role));
    } catch (err: any) {
      setError(err.response?.data?.detail ?? "Invalid username or password");
    } finally {
      setLoading(false);
    }
  };

  const useDemo = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel — Linear command-center aesthetic */}
      <div className="relative hidden overflow-hidden bg-[#0b0d17] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="bg-grid-faint pointer-events-none absolute inset-0 opacity-[0.07]" />
        <div
          className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full opacity-50 blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(94,106,210,0.55), transparent 70%)" }}
        />
        <div
          className="pointer-events-none absolute -bottom-40 right-0 h-96 w-96 rounded-full opacity-40 blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(94,106,210,0.4), transparent 70%)" }}
        />

        <div className="relative flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary-emphasis shadow-lg">
            <Boxes className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold tracking-tight">Shiv Furniture</div>
            <div className="text-xs text-white/50">Works ERP</div>
          </div>
        </div>

        <div className="relative max-w-md">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white/70">
            <Sparkles className="h-3.5 w-3.5 text-indigo-300" />
            AI-native operations platform
          </div>
          <h1 className="text-3xl font-semibold leading-tight tracking-tight">
            Run the floor from one
            <span className="text-indigo-300"> operations center.</span>
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-white/60">
            Demand, procurement, production and inventory — unified, prioritized, and ready to act on.
          </p>

          <div className="mt-10 space-y-5">
            {HIGHLIGHTS.map((h) => (
              <div key={h.title} className="flex gap-3.5">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5">
                  <h.icon className="h-[18px] w-[18px] text-indigo-300" />
                </div>
                <div>
                  <div className="text-sm font-medium text-white/90">{h.title}</div>
                  <div className="text-[13px] leading-relaxed text-white/50">{h.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative text-xs text-white/40">© {new Date().getFullYear()} Shiv Furniture Works</div>
      </div>

      {/* Sign-in form — Stripe aesthetic */}
      <div className="flex items-center justify-center bg-background px-6 py-12">
        <div className="w-full max-w-[380px]">
          {/* Mobile brand */}
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary-emphasis text-white shadow-sm">
              <Boxes className="h-5 w-5" />
            </div>
            <div className="text-sm font-semibold tracking-tight">Shiv Furniture Works</div>
          </div>

          <h2 className="text-2xl font-semibold tracking-tight text-foreground">Sign in</h2>
          <p className="mt-1.5 text-[14px] text-muted-foreground">Welcome back. Enter your credentials to continue.</p>

          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="username">Username</Label>
              <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} required autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && (
              <div className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-[13px] font-medium text-destructive">
                {error}
              </div>
            )}
            <Button type="submit" size="lg" className="w-full" disabled={loading}>
              {loading ? "Signing in…" : (<>Sign in <ArrowRight className="h-4 w-4" /></>)}
            </Button>
          </form>

          <div className="mt-8">
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Demo accounts
            </div>
            <div className="grid grid-cols-2 gap-2">
              {DEMO_ACCOUNTS.map((a) => {
                const active = username === a.user;
                return (
                  <button
                    key={a.user}
                    type="button"
                    onClick={() => useDemo(a.user, a.pass)}
                    className={
                      "rounded-lg border px-3 py-2 text-left transition-colors " +
                      (active
                        ? "border-primary/40 bg-primary-wash"
                        : "border-border bg-card hover:border-border-strong hover:bg-accent")
                    }
                  >
                    <div className="text-[13px] font-medium text-foreground">{a.role}</div>
                    <div className="text-[11px] text-muted-foreground">{a.user}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
