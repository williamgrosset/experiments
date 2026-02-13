type MaxWidth = "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl";

const maxWidthStyles: Record<MaxWidth, string> = {
  xs: "max-w-xs",
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  "3xl": "max-w-3xl",
  "4xl": "max-w-4xl",
  "5xl": "max-w-5xl",
};

interface PageContainerProps {
  maxWidth?: MaxWidth;
  children: React.ReactNode;
}

export function PageContainer({
  maxWidth = "5xl",
  children,
}: PageContainerProps) {
  return (
    <div className={`mx-auto ${maxWidthStyles[maxWidth]} px-8 py-10`}>
      {children}
    </div>
  );
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export function PageHeader({ title, subtitle, action }: PageHeaderProps) {
  if (action) {
    return (
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          {subtitle && (
            <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>
          )}
        </div>
        {action}
      </div>
    );
  }

  return (
    <div className="mb-8">
      <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
      {subtitle && (
        <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>
      )}
    </div>
  );
}
