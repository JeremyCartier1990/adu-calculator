import { Funnel } from "@/components/funnel/funnel";
import { DataSources, Designs, Faq, FinalCta, HeroPreview, HowItWorks, NoSalesCall, SampleReport } from "@/components/landing";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export default function HomePage() {
  return (
    <div id="top" className="max-md:pb-20">
      <SiteHeader />
      <main>
        <Funnel preview={<HeroPreview />} />
        <SampleReport />
        <NoSalesCall />
        <HowItWorks />
        <DataSources />
        <Designs />
        <Faq />
        <FinalCta />
      </main>
      <SiteFooter />
    </div>
  );
}
