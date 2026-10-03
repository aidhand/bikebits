import type { RetailerScraper } from "../types";
import { mcasScraper } from "./mcas";
import { bikebizScraper } from "./bikebiz";

export const scraperRegistry: Record<string, RetailerScraper> = {
  mcas: mcasScraper,
  bikebiz: bikebizScraper,
};
