import { Funnel } from "@/components/funnel/funnel";
import { Designs, Faq, FinalCta, HowItWorks, ReportContents } from "@/components/landing";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export default function HomePage() {
  return (
    <div id="top">
      <SiteHeader />
      <main>
        <Funnel />
        <HowItWorks />
        <Designs />
        <ReportContents />
        <Faq />
        <FinalCta />
      </main>
      <SiteFooter />
    </div>
  );
}
