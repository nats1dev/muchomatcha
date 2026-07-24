"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const mono = ["#1c1c1c", "#4a4a4a", "#6f6f6a", "#9a9a94", "#c8c8c2", "#deded9"];

export function SalesBarChart({
  data,
}: {
  data: Array<{ date: string; sales: number }>;
}) {
  if (!data.length) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Sin ventas en el período
      </p>
    );
  }
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid stroke="#deded9" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={(v) => v.slice(5)}
            tick={{ fill: "#6f6f6a", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "#6f6f6a", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            formatter={(value) => [`Q ${Number(value).toFixed(2)}`, "Ventas"]}
            contentStyle={{
              borderRadius: 10,
              borderColor: "#deded9",
              fontSize: 12,
            }}
          />
          <Bar dataKey="sales" fill="#1c1c1c" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CategoryPieChart({
  data,
}: {
  data: Array<{ name: string; value: number }>;
}) {
  if (!data.length) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Sin datos de categoría
      </p>
    );
  }
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={50}
            outerRadius={80}
            paddingAngle={2}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={mono[i % mono.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value) => [`Q ${Number(value).toFixed(2)}`, "Ventas"]}
            contentStyle={{
              borderRadius: 10,
              borderColor: "#deded9",
              fontSize: 12,
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
