import DashboardPaymentsSection from "./components/payments/DashboardPaymentsSection";

export const metadata = {
  title: "Pagos QR",
};

export default function DashboardPage() {
  return (
    <section aria-label="Contenido pagos QR">
      <DashboardPaymentsSection />
    </section>
  );
}
