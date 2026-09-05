import PreciosPageClient from "../components/precios/PreciosPageClient";

export const metadata = {
  title: "Ref. Precios",
};

export default function PreciosPage() {
  return (
    <section aria-label="Contenido referencia de precios">
      <PreciosPageClient />
    </section>
  );
}
