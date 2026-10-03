import { asc } from "drizzle-orm";
import { db, schema } from "../utils/drizzle";

export default defineEventHandler(() =>
  db.select().from(schema.categories).orderBy(asc(schema.categories.id)),
);
