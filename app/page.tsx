import { Estimator } from "@/components/estimator";
import { Hero } from "@/components/hero";
import { HowItWorks } from "@/components/how-it-works";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export default function HomePage() {
  return (
    <div id="top">
      <SiteHeader />
      <main>
        <Hero />
        <HowItWorks />
        <Estimator />
      </main>
      <SiteFooter />
    </div>
  );
}
