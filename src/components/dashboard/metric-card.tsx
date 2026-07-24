import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function MetricCard({
  label,
  value,
  hint,
  dark,
  className,
}: {
  label: string;
  value: string;
  hint?: string;
  dark?: boolean;
  className?: string;
}) {
  return (
    <Card
      className={cn(
        dark && "border-primary bg-primary text-primary-foreground",
        className,
      )}
    >
      <CardContent className="p-5">
        <p
          className={cn(
            "text-sm",
            dark ? "text-white/70" : "text-muted-foreground",
          )}
        >
          {label}
        </p>
        <p className="mt-2 text-[32px] font-semibold leading-none tabular-nums tracking-tight">
          {value}
        </p>
        {hint ? (
          <p
            className={cn(
              "mt-2 text-xs",
              dark ? "text-white/60" : "text-muted-foreground",
            )}
          >
            {hint}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
