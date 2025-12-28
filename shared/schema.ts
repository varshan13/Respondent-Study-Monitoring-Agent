import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Studies found from Respondent.io
export const studies = pgTable("studies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  externalId: text("external_id").notNull().unique(),
  title: text("title").notNull(),
  payout: integer("payout").notNull(),
  duration: text("duration").notNull(),
  studyType: text("study_type").notNull(),
  studyFormat: text("study_format"),
  matchScore: integer("match_score"),
  postedAt: text("posted_at"),
  link: text("link"),
  description: text("description"),
  notified: boolean("notified").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertStudySchema = createInsertSchema(studies).omit({
  id: true,
  createdAt: true,
});

export type InsertStudy = z.infer<typeof insertStudySchema>;
export type Study = typeof studies.$inferSelect;

// Email notification recipients
export const emailRecipients = pgTable("email_recipients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertEmailRecipientSchema = createInsertSchema(emailRecipients).omit({
  id: true,
  createdAt: true,
});

export type InsertEmailRecipient = z.infer<typeof insertEmailRecipientSchema>;
export type EmailRecipient = typeof emailRecipients.$inferSelect;

// Agent settings
export const agentSettings = pgTable("agent_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  checkIntervalMinutes: integer("check_interval_minutes").default(10),
  isActive: boolean("is_active").default(true),
  lastCheckAt: timestamp("last_check_at"),
});

export type AgentSettings = typeof agentSettings.$inferSelect;

// Check logs
export const checkLogs = pgTable("check_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  message: text("message").notNull(),
  logType: text("log_type").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCheckLogSchema = createInsertSchema(checkLogs).omit({
  id: true,
  createdAt: true,
});

export type InsertCheckLog = z.infer<typeof insertCheckLogSchema>;
export type CheckLog = typeof checkLogs.$inferSelect;
