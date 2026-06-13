import { useNavigate } from "react-router-dom";
import { ShieldAlert, ArrowRight } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { homePath } from "@/lib/permissions";
import { Button } from "@/components/ui/button";

export default function Unauthorized() {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-6">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive ring-1 ring-destructive/20">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Access restricted</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
          Your role{user?.role ? ` (${user.role.replace(/_/g, " ")})` : ""} doesn't have permission to view this page.
          Contact an administrator if you believe this is a mistake.
        </p>
        <Button className="mt-6" onClick={() => navigate(homePath(user?.role))}>
          Go to your home <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
