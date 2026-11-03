import PageHeader from "@/components/layout/page-header";
import OnboardingAsamalari from "@/components/bayiler/onboarding-asamalari";
import BasvuruTablosu from "@/components/bayiler/basvuru-tablosu";
import BasvuruDetay from "@/components/bayiler/basvuru-detay";
import BayiPerformansi from "@/components/bayiler/bayi-performansi";
import BolgeKapsamasi from "@/components/bayiler/bolge-kapsamasi";

export default function BayilerPage() {
  return (
    <>
      <PageHeader title="Bayi & Distribütör" />
      <OnboardingAsamalari />
      <BasvuruTablosu />
      <BasvuruDetay />
      <BayiPerformansi />
      <BolgeKapsamasi />
    </>
  );
}
