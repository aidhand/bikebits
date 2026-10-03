import { eq } from "drizzle-orm";
import { scraperRegistry } from "../../scrapers/retailers";
import { ingestOffers } from "../../scrapers/ingest";
import { closeBrowser } from "../../scrapers/http";

export default defineTask({
  meta: { name: "prices:snapshot" },
  async run() {
    const retailers = await db.select().from(schema.retailers).where(eq(schema.retailers.isActive, true));
    const results: Record<string, string> = {};
    for (const retailer of retailers) {
      const scraper = scraperRegistry[retailer.adapterId];
      if (!scraper) {
        results[retailer.slug] = "no adapter registered";
        continue;
      }
      try {
        const limit = Number(process.env.SCRAPE_LIMIT) || undefined;
        const offers = await scraper.scrape(limit);
        const ingested = await ingestOffers(retailer.id, offers);
        results[retailer.slug] = `${offers.length} offers → products:${ingested.products} variants:${ingested.variants} listings:${ingested.listings} snapshots:${ingested.snapshots}`;
      } catch (err) {
        results[retailer.slug] = `failed: ${err instanceof Error ? err.message : err}`;
      }
    }
    await closeBrowser();
    console.log("[prices:snapshot]", JSON.stringify(results, null, 2));
    return { result: "done", retailers: results };
  },
});
