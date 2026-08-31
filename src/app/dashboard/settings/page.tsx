import StatsAccessGate from "../components/stats/StatsAccessGate";
import SettingsPageClient from "../components/settings/SettingsPageClient";

export const metadata = {
  title: "Configuración",
};

export default function SettingsPage() {
  return (
    <section aria-label="Contenido configuración">
      <StatsAccessGate>
        <SettingsPageClient />
      </StatsAccessGate>
    </section>
  );
}
