import type { HTMLAttributes, ReactNode } from "react";

export function Panel({ children, className = "", ...rest }: { children: ReactNode } & HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`rounded-[14px] bg-panel border border-line overflow-hidden ${className}`} {...rest}>
      {children}
    </div>
  );
}
