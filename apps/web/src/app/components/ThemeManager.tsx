import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export function ThemeManager() {
  const location = useLocation();

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    const pathname = location.pathname;
    
    // Check if current route is an app route where dark mode might be enabled
    const isAppRoute = pathname.startsWith("/app") || pathname.startsWith("/admin") || pathname.startsWith("/onboarding");

    // If we are on a public route (not an app route), force light mode
    if (!isAppRoute) {
      root.classList.remove("dark");
    }
    
    // Note: For app routes, AppLayout handles adding the dark class if needed.
    // We only need to ensure it's removed when leaving app routes.
  }, [location.pathname]);

  return null;
}
