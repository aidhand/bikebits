import { listProducts } from "../utils/price-queries";

export default defineEventHandler(async (event) => {
  const q = getQuery(event);
  return listProducts({
    category: typeof q.category === "string" ? q.category : undefined,
    brand: typeof q.brand === "string" ? q.brand : undefined,
    q: typeof q.q === "string" ? q.q : undefined,
    sort: typeof q.sort === "string" ? q.sort : undefined,
  });
});
