import FacturasPageClient from "../components/facturas/FacturasPageClient";

export const metadata = {
  title: "Facturas",
};

export default function FacturasPage() {
  return (
    <section aria-label="Contenido facturas">
      <FacturasPageClient />
    </section>
  );
}
