import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/marketing";
import { PricingPlans } from "@/components/pricing-plans";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import {
  PLAN_ORDER,
  PRICING_FAQ,
  comparisonRows,
  pricingCopy,
  regionalRows,
} from "@/lib/pricing-page";
import { defaultOpenGraph, defaultTwitter, faqJsonLd, pricingJsonLd } from "@/lib/seo";
import { DODO_CUSTOMER_PORTAL_URL, SITE_URL, TIERS, installUrl } from "@/lib/site";

const path = "/pricing";
const title = "AnimeVocab Pricing: Free, Pro $8/mo, Max $16/mo";
const description =
  "AnimeVocab pricing: the extension is free forever, Pro is $8/mo and Max $16/mo for more Listening Mode hours and AI coach messages. Regional prices included.";

export const metadata: Metadata = {
  title,
  description,
  keywords: [
    "animevocab pricing",
    "animevocab price",
    "animevocab free",
    "anime japanese extension pricing",
    "migaku alternative price",
    "language reactor alternative price",
  ],
  alternates: { canonical: `${SITE_URL}${path}` },
  openGraph: {
    ...defaultOpenGraph,
    title,
    description,
    url: `${SITE_URL}${path}`,
  },
  twitter: {
    ...defaultTwitter,
    title: "AnimeVocab pricing",
    description: "Free forever core, $8/mo Pro, $16/mo Max. Regional pricing in four countries.",
  },
};

export default function PricingPage() {
  const rows = comparisonRows();
  const regional = regionalRows();
  const faqLd = faqJsonLd(PRICING_FAQ);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(pricingJsonLd()) }}
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <SiteHeader compact />
      <main id="main">
        <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "Pricing" }]} currentPath={path} />

        <section className="cmp-hero">
          <div className="wrap">
            <h1>{pricingCopy.h1}</h1>
            <p className="lede">{pricingCopy.lede}</p>
            <div className="cmp-verdict">
              <span className="vtag">{pricingCopy.verdictTag}</span>
              <p>{pricingCopy.verdict}</p>
            </div>
          </div>
        </section>

        <section id="plans">
          <div className="wrap">
            <div className="section-head">
              <h2>{pricingCopy.plansHeading}</h2>
              <p>{pricingCopy.plansSub}</p>
            </div>
            <div className="pricing-plans">
              <PricingPlans />
            </div>
          </div>
        </section>

        <section id="compare">
          <div className="wrap">
            <div className="section-head">
              <h2>{pricingCopy.tableHeading}</h2>
              <p>{pricingCopy.tableSub}</p>
            </div>
            <div className="table-scroll">
              <table className="cmp">
                <thead>
                  <tr>
                    <th scope="col">&nbsp;</th>
                    {PLAN_ORDER.map((id) => (
                      <th key={id} scope="col" className={id === "pro" ? "us" : undefined}>
                        {TIERS[id].name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.label}>
                      <th scope="row">
                        {row.label}
                        {row.note && <span className="cell-note">{row.note}</span>}
                      </th>
                      {PLAN_ORDER.map((id) => (
                        <td key={id} className={id === "pro" ? "us" : undefined}>
                          {row.values[id]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="pricing-note">
              Caps reset on the first of each month. Nothing you have already learned is metered:
              see the <Link href="/cloud">Cloud page</Link> for what an account adds.
            </p>
          </div>
        </section>

        <section id="regional">
          <div className="wrap">
            <div className="section-head">
              <h2>{pricingCopy.regionalHeading}</h2>
              <p>{pricingCopy.regionalSub}</p>
            </div>
            <div className="table-scroll pricing-regional">
              <table className="cmp">
                <thead>
                  <tr>
                    <th scope="col">Country</th>
                    <th scope="col" className="us">Pro</th>
                    <th scope="col">Max</th>
                  </tr>
                </thead>
                <tbody>
                  {regional.map((row) => (
                    <tr key={row.country}>
                      <th scope="row">{row.name}</th>
                      <td className="us">{row.pro}</td>
                      <td>{row.max}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="pricing-note">{pricingCopy.regionalNote}</p>
          </div>
        </section>

        <section id="costs">
          <div className="wrap">
            <div className="section-head">
              <h2>{pricingCopy.honestyHeading}</h2>
            </div>
            <p className="lede">{pricingCopy.honestyBody}</p>
            <p className="pricing-note">
              Cancel or update your card any time in the{" "}
              <a href={DODO_CUSTOMER_PORTAL_URL} rel="noopener noreferrer" target="_blank">
                customer portal
              </a>
              , or manage your plan from{" "}
              <Link href="/app#billing">your account</Link>.
            </p>
          </div>
        </section>

        <section id="faq" className="faq">
          <div className="wrap narrow">
            <div className="section-head">
              <h2>{pricingCopy.faqHeading}</h2>
            </div>
            {PRICING_FAQ.map((item) => (
              <details key={item.question}>
                <summary>{item.question}</summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="closing">
          <div className="wrap">
            <h2>{pricingCopy.closingHeading}</h2>
            <p className="lede" style={{ marginInline: "auto" }}>
              {pricingCopy.closingBody}
            </p>
            <div className="hero-cta" style={{ justifyContent: "center", marginTop: 24 }}>
              <a className="btn btn-accent" href={installUrl()} rel="noopener noreferrer">
                Add to Chrome, free
              </a>
              <Link className="btn btn-line" href="/learn-japanese-with-anime">
                Compare with other tools
              </Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
