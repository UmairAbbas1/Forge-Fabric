import { useRouter, useCanGoBack } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

interface BackButtonProps {
  /** Route to go to when there's no previous entry in this session's navigation stack (e.g. a direct deep link). */
  fallbackTo: string;
  className?: string;
  label?: string;
}

/**
 * Pops the actual router navigation stack (router.history.back()) instead of
 * jumping to a hardcoded route, so Dispatch -> Finance -> Back returns to
 * Dispatch. Falls back to `fallbackTo` only when there's no prior entry in
 * this session (e.g. a direct deep link with nothing before it).
 */
export function BackButton({ fallbackTo, className = "", label = "Back" }: BackButtonProps) {
  const router = useRouter();
  const canGoBack = useCanGoBack();

  const handleClick = () => {
    if (canGoBack) {
      router.history.back();
    } else {
      router.navigate({ to: fallbackTo });
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      title={canGoBack ? "Back" : `Back to ${fallbackTo}`}
      className={
        className ||
        "inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 border border-neutral-300 transition-all cursor-pointer shrink-0"
      }
    >
      <ArrowLeft className="w-3.5 h-3.5 text-neutral-500" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
