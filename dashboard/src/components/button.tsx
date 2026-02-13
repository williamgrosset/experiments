import Link from "next/link";

type ButtonVariant =
  | "primary"
  | "secondary"
  | "danger"
  | "danger-outline"
  | "ghost";
type ButtonSize = "xs" | "sm" | "md";

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-50",
  secondary:
    "border border-zinc-200 text-zinc-700 hover:bg-zinc-50 disabled:opacity-50",
  danger:
    "bg-red-600 text-white hover:bg-red-700 disabled:opacity-50",
  "danger-outline":
    "border border-red-200 bg-white text-red-600 hover:bg-red-50 disabled:opacity-50",
  ghost:
    "text-zinc-500 hover:text-zinc-900 disabled:opacity-30",
};

const sizeStyles: Record<ButtonSize, string> = {
  xs: "px-0 py-0 text-xs",
  sm: "px-3 py-1.5",
  md: "px-3.5 py-2",
};

interface ButtonBaseProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  loadingText?: string;
  children: React.ReactNode;
  className?: string;
}

type ButtonProps = ButtonBaseProps &
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, keyof ButtonBaseProps>;

export function Button({
  variant = "primary",
  size = "md",
  loading,
  loadingText,
  children,
  className,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={`rounded-lg text-sm font-medium transition-colors ${sizeStyles[size]} ${variantStyles[variant]} ${className ?? ""}`}
      {...props}
    >
      {loading && loadingText ? loadingText : children}
    </button>
  );
}

interface ButtonLinkProps {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: React.ReactNode;
  className?: string;
}

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  children,
  className,
}: ButtonLinkProps) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center rounded-lg text-sm font-medium transition-colors ${sizeStyles[size]} ${variantStyles[variant]} ${className ?? ""}`}
    >
      {children}
    </Link>
  );
}
