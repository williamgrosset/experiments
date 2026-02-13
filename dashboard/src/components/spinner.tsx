interface SpinnerProps {
  /** Wrap in a full-height centered container (default: true) */
  fullPage?: boolean;
  className?: string;
}

export function Spinner({ fullPage = true, className }: SpinnerProps) {
  const spinner = (
    <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-800" />
  );

  if (!fullPage) {
    return <div className={className ?? "flex items-center justify-center py-16"}>{spinner}</div>;
  }

  return (
    <div className={className ?? "flex h-full items-center justify-center"}>
      {spinner}
    </div>
  );
}
