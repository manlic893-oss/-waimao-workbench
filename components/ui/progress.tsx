import { cn } from "@/lib/utils";

function Progress({ className, value }: { className?: string; value: number }) {
  return (
    <div className={cn("relative h-3 w-full overflow-hidden rounded-full bg-secondary", className)}>
      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${value}%` }} />
    </div>
  );
}

export { Progress };
