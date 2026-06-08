import { useCallback, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  isOnboardingResumeMode,
  ONBOARDING_PROFILE_RETURN,
  resolveOnboardingStepDestination,
} from "@/lib/onboarding/onboardingResume";

export function useOnboardingResume() {
  const location = useLocation();
  const navigate = useNavigate();
  const resume = useMemo(
    () => isOnboardingResumeMode(location.search),
    [location.search],
  );

  const finishStep = useCallback(
    (defaultNextPath: string) => {
      navigate(resolveOnboardingStepDestination(resume, defaultNextPath), { replace: resume });
    },
    [navigate, resume],
  );

  const returnToProfile = useCallback(() => {
    navigate(ONBOARDING_PROFILE_RETURN, { replace: true });
  }, [navigate]);

  const goBack = useCallback(
    (defaultBackPath: string) => {
      if (resume) {
        returnToProfile();
        return;
      }
      navigate(defaultBackPath);
    },
    [navigate, resume, returnToProfile],
  );

  return { resume, finishStep, goBack, returnToProfile };
}
