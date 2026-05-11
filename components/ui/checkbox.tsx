import * as React from "react";
import { cn } from "@/lib/utils";

interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(({ className, label, ...props }, ref) => {
  return (
    <label className="inline-flex items-center gap-2">
      <input
        ref={ref}
        type="checkbox"
        className={cn("h-4 w-4 rounded border border-input text-primary focus:ring-primary", className)}
        {...props}
      />
      {label ? <span className="text-sm text-foreground">{label}</span> : null}
    </label>
  );
});

Checkbox.displayName = "Checkbox";

export { Checkbox };
