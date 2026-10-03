import { getProductBySlug } from "../../utils/price-queries";

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, "slug")!;
  const product = await getProductBySlug(slug);
  if (!product) {
    throw createError({ statusCode: 404, statusMessage: "Product not found" });
  }
  return product;
});
