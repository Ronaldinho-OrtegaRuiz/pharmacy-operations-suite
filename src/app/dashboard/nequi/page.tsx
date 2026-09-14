import NequiPageClient from "../components/nequi/NequiPageClient";

export const metadata = {
  title: "Pagos Nequi",
};

export default function NequiPage() {
  return (
    <section aria-label="Contenido pagos Nequi">
      <NequiPageClient />
    </section>
  );
}
