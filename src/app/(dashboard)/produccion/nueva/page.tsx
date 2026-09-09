import { listManufacturedIngredients } from "@/modules/production/service";
import { requirePageRole } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/page-header";
import { ProductionForm } from "@/components/production/production-form";

export default async function NuevaProduccionPage() {
  const session = await requirePageRole("CASHIER");

  const subproducts = await listManufacturedIngredients(session.businessId);

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Nueva Orden de Producción"
        description="Selecciona el subproducto y la cantidad a fabricar"
      />
      <ProductionForm subproducts={subproducts} />
    </div>
  );
}
