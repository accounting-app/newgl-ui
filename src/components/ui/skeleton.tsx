type SkeletonProps = {
  className?: string;
};

// Shared loading placeholder. Deliberately just a styled <div> -- callers
// size AND shape it via className (h-4 w-24 rounded-full for a pill, h-24
// w-full rounded-lg for a card, etc.) to match the real content's exact
// footprint, which is the whole point: a skeleton exists to hold the
// layout's shape steady while data loads, not just to say "loading". No
// default radius here on purpose -- baking one in would sit in the same
// className string as a caller's own radius override with no reliable way
// to say which one wins, so every caller states its own shape explicitly.
// Uses the same background-tint-not-shadow depth language as the rest of
// the design system (see DESIGN.md), just one step darker so it reads as
// "not here yet" against a card's own background.
export function Skeleton({ className = "" }: SkeletonProps) {
  return <div aria-hidden="true" className={`animate-pulse bg-[var(--color-container-background-secondary)] ${className}`.trim()} />;
}
