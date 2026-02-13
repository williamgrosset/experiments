interface StatCardProps {
  label: string;
  value: string | number;
  mono?: boolean;
  size?: "sm" | "lg";
}

export function StatCard({ label, value, mono, size = "lg" }: StatCardProps) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white px-5 py-4">
      <p className="text-xs font-medium text-zinc-500">{label}</p>
      <p
        className={`${size === "lg" ? "mt-1 text-2xl font-semibold tracking-tight" : "mt-0.5 text-sm"} ${mono ? "font-mono" : ""} text-zinc-900`}
      >
        {value}
      </p>
    </div>
  );
}
