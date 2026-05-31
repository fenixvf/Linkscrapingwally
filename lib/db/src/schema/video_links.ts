import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { foldersTable } from "./folders";

export const videoLinksTable = pgTable("video_links", {
  id: serial("id").primaryKey(),
  folderId: integer("folder_id").references(() => foldersTable.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  url: text("url").notNull(),
  refreshedUrl: text("refreshed_url"),
  status: text("status").notNull().default("unknown"),
  notes: text("notes"),
  lastChecked: timestamp("last_checked", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertVideoLinkSchema = createInsertSchema(videoLinksTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastChecked: true,
  refreshedUrl: true,
  status: true,
});
export type InsertVideoLink = z.infer<typeof insertVideoLinkSchema>;
export type VideoLink = typeof videoLinksTable.$inferSelect;
