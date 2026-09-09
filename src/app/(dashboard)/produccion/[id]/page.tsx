import { auth } from "@/auth";
import { getProductionOrderDetail } from "@/modules/production/service";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { ProductionDetailCard } from "@/components/production/production-detail-card";

export default async function ProduccionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.businessId) return null;
  const { id } = await params;

  let detail;
  try {
    detail = await getProductionOrderDetail(session.user.businessId, id);
  } catch {
    notFound();
  }

  return (
    <div className="max-w-3xl">
      <PageHeader title={`Orden #${detail.order.orderNumber}`} />
      <ProductionDetailCard detail={detail} />
    </div>
  );
}
