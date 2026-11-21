import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const entries = sqliteTable("editorial_entries", {
  id: text("id").primaryKey(),
  kind: text("kind").notNull(),
  status: text("status").notNull().default("draft"),
  title: text("title").notNull(),
  payload: text("payload").notNull(),
  referenceId: text("reference_id"),
  createdBy: text("created_by").notNull(),
  approvedBy: text("approved_by"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  publishedAt: text("published_at"),
  revision: integer("revision").notNull().default(1),
});

export const auditEvents = sqliteTable("editorial_audit", {
  id: text("id").primaryKey(),
  entryId: text("entry_id").notNull(),
  actor: text("actor").notNull(),
  action: text("action").notNull(),
  at: text("at").notNull(),
});
