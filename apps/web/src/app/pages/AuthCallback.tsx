// import { useEffect, useState } from "react";
// import { useNavigate, useLocation } from "react-router-dom";
// import { useAuth } from "../contexts/AuthContext";
// import { Loader2 } from "lucide-react";
// import { supabase } from "@/lib/supabase";
// import { toast } from "sonner";

// export function AuthCallback() {
//   const { user, isLoading: isAuthLoading } = useAuth();
//   const navigate = useNavigate();
//   const location = useLocation();
//   const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
//   const [errorMessage, setErrorMessage] = useState<string>('');

//   useEffect(() => {
//     const handleCallback = async () => {
//       // 1. Parse Parameters
//       const searchParams = new URLSearchParams(location.search);
//       const code = searchParams.get('code');
//       const error = searchParams.get('error');
//       const errorDescription = searchParams.get('error_description');

//       const hashParams = new URLSearchParams(location.hash.substring(1));
//       const accessToken = hashParams.get('access_token');
//       const refreshToken = hashParams.get('refresh_token');
//       const errorHash = hashParams.get('error');
//       const errorDescriptionHash = hashParams.get('error_description');

//       // 2. Handle Errors from URL
//       if (error || errorHash) {
//         const msg = errorDescription || errorDescriptionHash || 'Authentication failed';
//         console.error('Auth error:', error || errorHash, msg);
//         toast.error(msg);
//         setErrorMessage(msg);
//         setStatus('error');
//         return;
//       }

//       // 3. Handle Code Exchange (PKCE)
//       if (code) {
//         try {
//           const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
//           if (exchangeError) throw exchangeError;
//         } catch (err: any) {
//           console.error('Code exchange error:', err);
//           const msg = err.message || 'Failed to verify email';
//           toast.error(msg);
//           setErrorMessage(msg);
//           setStatus('error');
//           return;
//         }
//       } 
//       // 4. Handle Tokens (Implicit)
//       else if (accessToken && refreshToken) {
//           const { error: sessionError } = await supabase.auth.setSession({
//             access_token: accessToken,
//             refresh_token: refreshToken,
//           });
//           if (sessionError) {
//              console.error('Session set error:', sessionError);
//              const msg = sessionError.message;
//              toast.error(msg);
//              setErrorMessage(msg);
//              setStatus('error');
//              return;
//           }
//       }

//       // 5. Verify Session Establishment
//       const checkSession = async (attempts = 0) => {
//         const { data: { session } } = await supabase.auth.getSession();
        
//         if (session) {
//           setStatus('success');
//           // Wait a moment for context to update, then redirect
//           setTimeout(() => navigate("/onboarding/welcome"), 500);
//           return;
//         }

//         // Retry every 500ms for up to 5 seconds (10 attempts)
//         if (attempts < 10) {
//           setTimeout(() => checkSession(attempts + 1), 500);
//         } else {
//           console.warn("Session check timed out after 5 seconds");
//           setErrorMessage("Session establishment timed out. Please try logging in.");
//           setStatus('error');
//         }
//       };
      
//       checkSession();
//     };

//     handleCallback();
//   }, [location, navigate]);

//   return (
//     <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-white via-purple-50/30 to-white">
//       <div className="flex flex-col items-center gap-4 p-8 bg-white rounded-lg shadow-sm border border-gray-100">
//         {status === 'processing' && (
//           <>
//             <Loader2 className="w-12 h-12 text-primary animate-spin" />
//             <h2 className="text-xl font-semibold text-gray-700">Verifying your email...</h2>
//             <p className="text-muted-foreground">Please wait while we confirm your account.</p>
//           </>
//         )}

//         {status === 'success' && (
//            <>
//             <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center text-green-500 font-bold text-xl">✓</div>
//             <h2 className="text-xl font-semibold text-gray-700">Email Verified!</h2>
//             <p className="text-muted-foreground">Redirecting to onboarding...</p>
//           </>
//         )}

//         {status === 'error' && (
//           <>
//             <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-red-500 font-bold text-xl">!</div>
//             <h2 className="text-xl font-semibold text-gray-700">Verification Failed</h2>
//             <p className="text-muted-foreground text-center max-w-sm">
//               {errorMessage || "We couldn't verify your email link. It may be expired or invalid."}
//             </p>
//             <button 
//               onClick={() => navigate('/login')}
//               className="mt-4 px-6 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors"
//             >
//               Go to Login
//             </button>
//           </>
//         )}
//       </div>
//     </div>
//   );
// }
import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

export function AuthCallback() {
  const navigate = useNavigate();
  const location = useLocation();
  const ran = useRef(false);

  const [status, setStatus] = useState<"processing" | "success" | "error">("processing");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (ran.current) return; // prevents double-run in StrictMode
    ran.current = true;

    const run = async () => {
      try {
        const searchParams = new URLSearchParams(location.search);
        const code = searchParams.get("code");
        const error = searchParams.get("error");
        const errorDescription = searchParams.get("error_description");

        if (error) {
          throw new Error(errorDescription || "Authentication failed");
        }

        // If PKCE code is present, exchange it
        if (code) {
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;

          if (data?.session) {
            setStatus("success");
            navigate("/onboarding/welcome", { replace: true });
            return;
          }
        }

        // Fallback: if session already exists (some flows)
        const { data: sessData } = await supabase.auth.getSession();
        if (sessData?.session) {
          setStatus("success");
          navigate("/onboarding/welcome", { replace: true });
          return;
        }

        // Final fallback: wait for auth event once (no polling)
        const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
          if (session) {
            setStatus("success");
            navigate("/onboarding/welcome", { replace: true });
            sub.subscription.unsubscribe();
          }
        });

        // Give it a short window then fail fast
        setTimeout(() => {
          sub.subscription.unsubscribe();
          setStatus("error");
          setErrorMessage("Session not created. Please try logging in again.");
        }, 2000);
      } catch (err: any) {
        const msg = err?.message || "Verification failed";
        toast.error(msg);
        setErrorMessage(msg);
        setStatus("error");
      }
    };

    run();
  }, [location, navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-white via-purple-50/30 to-white">
      <div className="flex flex-col items-center gap-4 p-8 bg-white rounded-lg shadow-sm border border-gray-100">
        {status === "processing" && (
          <>
            <Loader2 className="w-12 h-12 text-primary animate-spin" />
            <h2 className="text-xl font-semibold text-gray-700">Verifying your email...</h2>
            <p className="text-muted-foreground">Please wait while we confirm your account.</p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center text-green-500 font-bold text-xl">✓</div>
            <h2 className="text-xl font-semibold text-gray-700">Email Verified!</h2>
            <p className="text-muted-foreground">Redirecting...</p>
          </>
        )}

        {status === "error" && (
          <>
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-red-500 font-bold text-xl">!</div>
            <h2 className="text-xl font-semibold text-gray-700">Verification Failed</h2>
            <p className="text-muted-foreground text-center max-w-sm">
              {errorMessage || "We couldn't verify your email link. It may be expired or invalid."}
            </p>
            <button
              onClick={() => navigate("/login")}
              className="mt-4 px-6 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors"
            >
              Go to Login
            </button>
          </>
        )}
      </div>
    </div>
  );
}