import { useMemo } from "react";
import { Check, X } from "lucide-react";

interface Requirement {
  label: string;
  met: boolean;
}

function getRequirements(password: string): Requirement[] {
  return [
    { label: "At least 8 characters", met: password.length >= 8 },
    { label: "Uppercase letter (A–Z)", met: /[A-Z]/.test(password) },
    { label: "Lowercase letter (a–z)", met: /[a-z]/.test(password) },
    { label: "Number (0–9)", met: /[0-9]/.test(password) },
    { label: "Special character (!@#$…)", met: /[^A-Za-z0-9]/.test(password) },
  ];
}

type StrengthLevel = "empty" | "weak" | "fair" | "good" | "strong";

function getStrength(metCount: number): StrengthLevel {
  if (metCount === 0) return "empty";
  if (metCount <= 2) return "weak";
  if (metCount === 3) return "fair";
  if (metCount === 4) return "good";
  return "strong";
}

const STRENGTH_CONFIG: Record<StrengthLevel, { label: string; color: string; bars: number }> = {
  empty:  { label: "",       color: "bg-gray-200 dark:bg-gray-700", bars: 0 },
  weak:   { label: "Weak",   color: "bg-red-500",    bars: 1 },
  fair:   { label: "Fair",   color: "bg-orange-400", bars: 2 },
  good:   { label: "Good",   color: "bg-yellow-400", bars: 3 },
  strong: { label: "Strong", color: "bg-green-500",  bars: 4 },
};

interface PasswordStrengthMeterProps {
  password: string;
  /** Show checklist of individual requirements. Defaults to true. */
  showRequirements?: boolean;
}

export function PasswordStrengthMeter({ password, showRequirements = true }: PasswordStrengthMeterProps) {
  const requirements = useMemo(() => getRequirements(password), [password]);
  const metCount = requirements.filter((r) => r.met).length;
  const level = getStrength(password.length === 0 ? 0 : metCount);
  const config = STRENGTH_CONFIG[level];

  if (password.length === 0) return null;

  return (
    <div className="mt-2 space-y-2">
      {/* Strength bar */}
      <div className="flex items-center gap-2">
        <div className="flex flex-1 gap-1">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                i < config.bars ? config.color : "bg-gray-200 dark:bg-gray-700"
              }`}
            />
          ))}
        </div>
        {config.label && (
          <span
            className={`text-xs font-medium min-w-[42px] text-right transition-colors duration-200 ${
              level === "weak"   ? "text-red-500"    :
              level === "fair"   ? "text-orange-400" :
              level === "good"   ? "text-yellow-500" :
                                   "text-green-500"
            }`}
          >
            {config.label}
          </span>
        )}
      </div>

      {/* Requirements checklist */}
      {showRequirements && (
        <ul className="grid grid-cols-1 gap-1">
          {requirements.map((req) => (
            <li key={req.label} className="flex items-center gap-1.5 text-xs">
              {req.met ? (
                <Check className="w-3.5 h-3.5 text-green-500 shrink-0" />
              ) : (
                <X className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500 shrink-0" />
              )}
              <span className={req.met ? "text-green-600 dark:text-green-400" : "text-gray-500 dark:text-gray-400"}>
                {req.label}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
