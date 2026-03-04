import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

export function AuthCallback() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isProcessing, setIsProcessing] = useState(true);

  useEffect(() => {
    const handleCallback = async () => {
      const searchParams = new URLSearchParams(location.search);
      const code = searchParams.get('code');
      const error = searchParams.get('error');
      const errorDescription = searchParams.get('error_description');

      // Check for hash params (Implicit flow)
      const hashParams = new URLSearchParams(location.hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      const errorHash = hashParams.get('error');
      const errorDescriptionHash = hashParams.get('error_description');

      if (error || errorHash) {
        console.error('Auth error:', error || errorHash, errorDescription || errorDescriptionHash);
        toast.error((errorDescription || errorDescriptionHash) || 'Authentication failed');
        // Stay on page to show error
        setIsProcessing(false);
        return;
      }

      if (code) {
        try {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
          // Session established, AuthContext will update via onAuthStateChange
        } catch (err: any) {
          console.error('Code exchange error:', err);
          toast.error(err.message || 'Failed to verify email');
          // Stay on page to show error
          setIsProcessing(false);
          return;
        }
      } else if (accessToken && refreshToken) {
          // If we have tokens in hash, set session manually
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (sessionError) {
             console.error('Session set error:', sessionError);
             toast.error(sessionError.message);
             setIsProcessing(false);
             return;
          }
      }

      // Allow some time for the session to propagate if we just exchanged code
      // or if Supabase is processing the hash.
      // We'll verify the session exists before finishing processing.
      const checkSession = async (attempts = 0) => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setIsProcessing(false);
          return;
        }

        // Retry every 500ms for up to 5 seconds (10 attempts)
        if (attempts < 10) {
          setTimeout(() => checkSession(attempts + 1), 500);
        } else {
          console.warn("Session check timed out after 5 seconds");
          setIsProcessing(false);
        }
      };
      
      checkSession();
    };

    handleCallback();
  }, [location, navigate]);

  useEffect(() => {
    if (!isProcessing && !isAuthLoading) {
      // Double check session directly from Supabase to be sure
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session || user) {
          // User is verified and logged in
          navigate("/onboarding/welcome");
        } else {
          // If we've finished processing and checking auth, and still no user
          navigate("/login");
        }
      });
    }
  }, [user, isProcessing, isAuthLoading, navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-white via-purple-50/30 to-white">
      <div className="flex flex-col items-center gap-4 p-8 bg-white rounded-lg shadow-sm border border-gray-100">
        {isProcessing ? (
          <>
            <Loader2 className="w-12 h-12 text-primary animate-spin" />
            <h2 className="text-xl font-semibold text-gray-700">Verifying your email...</h2>
            <p className="text-muted-foreground">Please wait while we confirm your account.</p>
          </>
        ) : (
          <>
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-red-500 font-bold text-xl">!</div>
            <h2 className="text-xl font-semibold text-gray-700">Verification Failed</h2>
            <p className="text-muted-foreground text-center max-w-sm">
              We couldn't verify your email link. It may be expired or invalid.
            </p>
            <button 
              onClick={() => navigate('/login')}
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
