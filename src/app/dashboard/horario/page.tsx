import HorarioPageClient from "../components/horario/HorarioPageClient";

export const metadata = {
  title: "Horario",
};

export default function HorarioPage() {
  return (
    <section aria-label="Contenido horario">
      <HorarioPageClient />
    </section>
  );
}
