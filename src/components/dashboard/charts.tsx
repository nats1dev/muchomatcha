"use client";

import dynamic from "next/dynamic";

const chartFallback = (
  <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">
    Cargando gráfico…
  </div>
);

export const SalesBarChart = dynamic(
  () =>
    import("./charts-impl").then((m) => m.SalesBarChart),
  { ssr: false, loading: () => chartFallback },
);

export const CategoryPieChart = dynamic(
  () =>
    import("./charts-impl").then((m) => m.CategoryPieChart),
  { ssr: false, loading: () => chartFallback },
);
