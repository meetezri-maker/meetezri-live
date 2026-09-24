import {
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  type ComponentType,
} from "react";
import { cn } from "@/lib/utils";
import type { FoundingMemberFormProps } from "./FoundingMemberForm";

type FoundingMemberFormModule = {
  FoundingMemberForm: ComponentType<FoundingMemberFormProps>;
};

let foundingMemberFormPromise: Promise<{ default: ComponentType<FoundingMemberFormProps> }> | null =
  null;

function loadFoundingMemberForm() {
  foundingMemberFormPromise ??= import("./FoundingMemberForm").then(
    (module: FoundingMemberFormModule) => ({
      default: module.FoundingMemberForm,
    }),
  );
  return foundingMemberFormPromise;
}

const LazyFoundingMemberForm = lazy(loadFoundingMemberForm);

export function preloadFoundingMemberForm() {
  void loadFoundingMemberForm();
}

function FoundingMemberFormFallback({
  compact = false,
  className,
}: Pick<FoundingMemberFormProps, "compact" | "className">) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex w-full items-center justify-center rounded-2xl border border-white/10 bg-black/20 px-4 text-center text-sm text-white/65",
        compact ? "min-h-64" : "min-h-[22rem]",
        className,
      )}
    >
      Loading the Founding Circle form…
    </div>
  );
}

export function FoundingMemberFormSuspense(props: FoundingMemberFormProps) {
  return (
    <Suspense
      fallback={<FoundingMemberFormFallback compact={props.compact} className={props.className} />}
    >
      <LazyFoundingMemberForm {...props} />
    </Suspense>
  );
}

export function DeferredFoundingMemberForm(props: FoundingMemberFormProps) {
  const [shouldLoad, setShouldLoad] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (shouldLoad) return;

    if (typeof window === "undefined" || !("IntersectionObserver" in window)) {
      preloadFoundingMemberForm();
      setShouldLoad(true);
      return;
    }

    const node = rootRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;

        preloadFoundingMemberForm();
        setShouldLoad(true);
        observer.disconnect();
      },
      { rootMargin: "900px 0px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [shouldLoad]);

  return (
    <div ref={rootRef}>
      {shouldLoad ? (
        <FoundingMemberFormSuspense {...props} />
      ) : (
        <FoundingMemberFormFallback compact={props.compact} className={props.className} />
      )}
    </div>
  );
}
