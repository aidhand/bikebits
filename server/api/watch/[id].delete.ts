import { and, eq } from "drizzle-orm";
import { db, schema } from "../../utils/drizzle";
import { requireUser } from "../../utils/require-user";

export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const id = Number(getRouterParam(event, "id"));
  if (!Number.isInteger(id)) {
    throw createError({ statusCode: 400, statusMessage: "Invalid id" });
  }
  const deleted = await db
    .delete(schema.watchItems)
    .where(and(eq(schema.watchItems.id, id), eq(schema.watchItems.userId, user.id)))
    .returning();
  if (!deleted.length) {
    throw createError({ statusCode: 404, statusMessage: "Watch item not found" });
  }
  return { ok: true };
});
