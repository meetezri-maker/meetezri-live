import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/app/components/ui/button";
import { BrandLogo } from "@/app/components/BrandLogo";
import { useAuth } from "@/app/contexts/AuthContext";

const DASHBOARD_PATH = "/app/dashboard";

export function AuthActivateAccount() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, refreshProfile } = useAuth();
  const token = searchParams.get("token")?.trim() ?? "";
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    token ? "loading" : "error"
  );
  const [message, setMessage] = useState(
    token ? "Activating your account…" : "Activation link is missing or invalid."
  );

  useEffect(() => {
    if (!token) return;

    let cancelled = false;
    (async () => {
      try {
        await api.confirmAccountActivation(token);
        if (cancelled) return;
        setStatus("success");
        setMessage("Your account is active again.");
      } catch (error: unknown) {
        if (cancelled) return;
        setStatus("error");
        setMessage(
          error instanceof Error
            ? error.message
            : "We could not activate your account. Request a new email after signing in."
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (status !== "success" || !user) return;

    let cancelled = false;
    (async () => {
      try {
        await refreshProfile();
      } catch {
        /* still send user to dashboard; ProtectedRoute handles auth edge cases */
      }
      if (!cancelled) {
        navigate(DASHBOARD_PATH, { replace: true });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [status, user, refreshProfile, navigate]);

  const handlePrimaryAction = () => {
    if (status === "success") {
      navigate(DASHBOARD_PATH, { replace: true });
      return;
    }
    navigate("/login", { replace: true });
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0a0b18] px-4 py-12">
      <div className="mb-8">
        <BrandLogo heightClass="h-10" variant="onDark" />
      </div>
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#12141f] p-8 text-center shadow-2xl">
        {status === "loading" ? (
          <Loader2 className="mx-auto h-10 w-10 animate-spin text-violet-400" aria-hidden />
        ) : status === "success" ? (
          <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-400" aria-hidden />
        ) : (
          <AlertCircle className="mx-auto h-10 w-10 text-rose-400" aria-hidden />
        )}
        <h1 className="mt-4 text-xl font-semibold text-zinc-100">
          {status === "success" ? "Account activated" : status === "loading" ? "Please wait" : "Activation failed"}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-zinc-400">{message}</p>
        {status !== "loading" ? (
          <Button className="mt-6 w-full" onClick={handlePrimaryAction}>
            {status === "success" ? "Go to dashboard" : "Go to sign in"}
          </Button>
        ) : null}
        {status === "error" ? (
          <p className="mt-4 text-xs text-zinc-500">
            Signed in with a deactivated account?{" "}
            <Link to="/login" className="text-violet-300 hover:text-violet-200">
              Sign in
            </Link>{" "}
            and use &quot;Send activation email&quot; in the modal.
          </p>
        ) : null}
      </div>
    </div>
  );
}
