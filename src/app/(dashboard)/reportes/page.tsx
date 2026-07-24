import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const reports = [
  {
    id: "sales",
    title: "Ventas",
    description: "Detalle de ventas confirmadas y anuladas",
  },
  {
    id: "purchases",
    title: "Compras",
    description: "Compras por proveedor e ingrediente",
  },
  {
    id: "inventory",
    title: "Inventario actual",
    description: "Existencias, costos y valor",
  },
  {
    id: "expenses",
    title: "Gastos",
    description: "Gastos por categoría",
  },
  {
    id: "cash",
    title: "Cierres de caja",
    description: "Aperturas, cierres y diferencias",
  },
];

export default function ReportesPage() {
  return (
    <div>
      <PageHeader
        title="Reportes"
        description="Exporta información a CSV para análisis o respaldo"
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {reports.map((r) => (
          <Card key={r.id}>
            <CardHeader>
              <CardTitle>{r.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">{r.description}</p>
              <Button asChild variant="secondary">
                <a href={`/api/exports/${r.id}.csv`}>Descargar CSV</a>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="mt-4">
        <CardContent className="p-5 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Power BI</p>
          <p className="mt-1">
            Conéctate a PostgreSQL y consulta las vistas <code>bi_*</code>. Usa
            un usuario de solo lectura (ver <code>sql/roles.sql</code>).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
