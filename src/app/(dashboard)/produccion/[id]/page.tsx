import { getProductionOrderDetail } from "@/modules/production/service";
import { requirePageRole } from "@/lib/auth/session";
import { hasAtLeast } from "@/lib/auth/roles";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { ProductionDetailCard } from "@/components/production/production-detail-card";

export default async function ProduccionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePageRole("VIEWER");
  const { id } = await params;

  let detail;
  try {
    detail = await getProductionOrderDetail(session.businessId, id);
  } catch {
    notFound();
  }

  return (
    <div className="max-w-3xl">
      <PageHeader title={`Orden #${detail.order.orderNumber}`} />
      <ProductionDetailCard detail={detail} canOperate={hasAtLeast(session.role, "CASHIER")} canCancel={hasAtLeast(session.role, "ADMIN")} />
    </div>
  );
}
