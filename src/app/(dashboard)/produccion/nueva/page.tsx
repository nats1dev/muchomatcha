import { auth } from "@/auth";
import { listManufacturedIngredients } from "@/modules/production/service";
import { PageHeader } from "@/components/ui/page-header";
import { ProductionForm } from "@/components/production/production-form";

export default async function NuevaProduccionPage() {
  const session = await auth();
  if (!session?.user?.businessId) return null;

  const subproducts = await listManufacturedIngredients(session.user.businessId);

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Nueva Orden de Producción"
        description="Selecciona el subproducto y la cantidad a fabricar"
      />
      <ProductionForm subproducts={subproducts as never[]} />
    </div>
  );
}
