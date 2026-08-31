import SalesPageClient from "../components/sales/SalesPageClient";

export const metadata = {
  title: "Ventas",
};

export default function SalesPage() {
  return (
    <section aria-label="Contenido ventas">
      <SalesPageClient />
    </section>
  );
}
