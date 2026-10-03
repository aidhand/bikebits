export interface ScrapedOffer {
  brandName: string;
  productName: string;
  categorySlug: string;
  colour?: string;
  size?: string;
  url: string;
  priceCents: number | null;
  inStock: boolean;
  imageUrl?: string;
  manufacturerUrl?: string;
}

export interface RetailerScraper {
  id: string;
  /** Default caps product-page fetches per run; override per run via the argument. */
  scrape(limit?: number): Promise<ScrapedOffer[]>;
}
