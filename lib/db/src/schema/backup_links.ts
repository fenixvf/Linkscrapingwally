import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { videoLinksTable } from "./video_links";

export const backupLinksTable = pgTable("backup_links", {
  id: serial("id").primaryKey(),
  videoLinkId: integer("video_link_id")
    .notNull()
    .references(() => videoLinksTable.id, { onDelete: "cascade" }),
  label: text("label"),
  url: text("url").notNull(),
  priority: integer("priority").notNull().default(0),
  status: text("status").notNull().default("unknown"),
  lastChecked: timestamp("last_checked", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertBackupLinkSchema = createInsertSchema(backupLinksTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastChecked: true,
  status: true,
});
export type InsertBackupLink = z.infer<typeof insertBackupLinkSchema>;
export type BackupLink = typeof backupLinksTable.$inferSelect;
