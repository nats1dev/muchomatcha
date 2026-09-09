import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { isRoleName } from "@/lib/auth/roles";
import { NumberFormatProvider } from "@/components/number-format-provider";
import { getNumberDisplaySettings } from "@/lib/number-format-server";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = isRoleName(session.user.role) ? session.user.role : "VIEWER";
  const numberSettings = await getNumberDisplaySettings(session.user.businessId);

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar role={role} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Suspense fallback={<div className="h-[73px] border-b border-border bg-card" />}>
          <Topbar userName={session.user.name ?? undefined} />
        </Suspense>
        <NumberFormatProvider settings={numberSettings}>
          <main className="flex-1 px-4 py-6 lg:px-6">{children}</main>
        </NumberFormatProvider>
      </div>
    </div>
  );
}
