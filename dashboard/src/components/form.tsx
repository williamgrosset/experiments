import { forwardRef } from "react";

/* ------------------------------------------------------------------ */
/*  Input                                                              */
/* ------------------------------------------------------------------ */

type InputSize = "sm" | "md";

const inputSizeStyles: Record<InputSize, string> = {
  sm: "rounded-md px-2.5 py-1.5",
  md: "rounded-lg px-3 py-2",
};

interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  size?: InputSize;
  mono?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  function Input({ size = "md", mono, className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={`w-full border border-zinc-300 text-sm outline-none transition-colors focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 ${inputSizeStyles[size]} ${mono ? "font-mono" : ""} ${className ?? ""}`}
        {...props}
      />
    );
  },
);

/* ------------------------------------------------------------------ */
/*  Textarea                                                           */
/* ------------------------------------------------------------------ */

interface TextareaProps
  extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "size"> {
  size?: InputSize;
  mono?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ size = "md", mono, className, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        className={`w-full border border-zinc-300 text-sm outline-none transition-colors focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 ${inputSizeStyles[size]} ${mono ? "font-mono" : ""} ${className ?? ""}`}
        {...props}
      />
    );
  },
);

/* ------------------------------------------------------------------ */
/*  Select                                                             */
/* ------------------------------------------------------------------ */

type SelectVariant = "form" | "filter";

const selectVariantStyles: Record<SelectVariant, string> = {
  form: "border-zinc-300 transition-colors focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200",
  filter: "border-zinc-200 focus:border-zinc-400",
};

interface SelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "size"> {
  size?: InputSize;
  variant?: SelectVariant;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  function Select({ size = "md", variant = "form", className, ...props }, ref) {
    return (
      <select
        ref={ref}
        className={`w-full border bg-white text-sm outline-none ${inputSizeStyles[size]} ${selectVariantStyles[variant]} ${className ?? ""}`}
        {...props}
      />
    );
  },
);

/* ------------------------------------------------------------------ */
/*  FormField                                                          */
/* ------------------------------------------------------------------ */

interface FormFieldProps {
  label: string;
  optional?: boolean;
  hint?: string;
  error?: string;
  labelSize?: "sm" | "xs";
  children: React.ReactNode;
  className?: string;
}

export function FormField({
  label,
  optional,
  hint,
  error,
  labelSize = "sm",
  children,
  className,
}: FormFieldProps) {
  return (
    <div className={className}>
      <label
        className={`block font-medium ${labelSize === "xs" ? "text-xs text-zinc-600" : "text-sm text-zinc-700"}`}
      >
        {label}
        {optional && (
          <span className="ml-1 font-normal text-zinc-400">(optional)</span>
        )}
      </label>
      <div className="mt-1.5">{children}</div>
      {hint && <p className="mt-1 text-xs text-zinc-400">{hint}</p>}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
