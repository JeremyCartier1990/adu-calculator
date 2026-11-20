import { Funnel } from "@/components/funnel/funnel";
import { DataSources, Designs, Faq, FinalCta, HowItWorks, SampleReport } from "@/components/landing";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export default function HomePage() {
  return (
    <div id="top" className="max-md:pb-20">
      <SiteHeader />
      <main>
        <Funnel />
        <DataSources />
        <SampleReport />
        <HowItWorks />
        <Designs />
        <Faq />
        <FinalCta />
      </main>
      <SiteFooter />
    </div>
  );
}
