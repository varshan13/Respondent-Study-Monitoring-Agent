import { db } from "./db";
import { 
  studies, 
  emailRecipients, 
  agentSettings, 
  checkLogs,
  type Study, 
  type InsertStudy,
  type EmailRecipient,
  type InsertEmailRecipient,
  type AgentSettings,
  type CheckLog,
  type InsertCheckLog
} from "@shared/schema";
import { eq, desc, notInArray, asc } from "drizzle-orm";

export interface IStorage {
  // Studies
  getStudies(): Promise<Study[]>;
  getStudyByExternalId(externalId: string): Promise<Study | undefined>;
  createStudy(study: InsertStudy): Promise<Study>;
  updateStudy(externalId: string, study: Partial<InsertStudy>): Promise<Study | undefined>;
  markStudyNotified(id: string): Promise<void>;
  syncStudies(currentExternalIds: string[]): Promise<number>;
  
  // Email Recipients
  getEmailRecipients(): Promise<EmailRecipient[]>;
  getActiveEmailRecipients(): Promise<EmailRecipient[]>;
  addEmailRecipient(email: InsertEmailRecipient): Promise<EmailRecipient>;
  removeEmailRecipient(id: string): Promise<void>;
  toggleEmailRecipient(id: string, active: boolean): Promise<void>;
  
  // Agent Settings
  getAgentSettings(): Promise<AgentSettings | undefined>;
  updateAgentSettings(settings: Partial<AgentSettings>): Promise<AgentSettings>;
  
  // Check Logs
  getCheckLogs(limit?: number): Promise<CheckLog[]>;
  addCheckLog(log: InsertCheckLog): Promise<CheckLog>;
  clearCheckLogs(): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // Studies
  async getStudies(): Promise<Study[]> {
    return db.select().from(studies).orderBy(asc(studies.pageOrder));
  }

  async getStudyByExternalId(externalId: string): Promise<Study | undefined> {
    const result = await db.select().from(studies).where(eq(studies.externalId, externalId));
    return result[0];
  }

  async createStudy(study: InsertStudy): Promise<Study> {
    const result = await db.insert(studies).values(study).returning();
    return result[0];
  }

  async updateStudy(externalId: string, study: Partial<InsertStudy>): Promise<Study | undefined> {
    const result = await db.update(studies).set(study).where(eq(studies.externalId, externalId)).returning();
    return result[0];
  }

  async markStudyNotified(id: string): Promise<void> {
    await db.update(studies).set({ notified: true }).where(eq(studies.id, id));
  }

  async syncStudies(currentExternalIds: string[]): Promise<number> {
    if (currentExternalIds.length === 0) {
      return 0;
    }
    const result = await db.delete(studies).where(notInArray(studies.externalId, currentExternalIds)).returning();
    return result.length;
  }

  // Email Recipients
  async getEmailRecipients(): Promise<EmailRecipient[]> {
    return db.select().from(emailRecipients).orderBy(desc(emailRecipients.createdAt));
  }

  async getActiveEmailRecipients(): Promise<EmailRecipient[]> {
    return db.select().from(emailRecipients).where(eq(emailRecipients.active, true));
  }

  async addEmailRecipient(email: InsertEmailRecipient): Promise<EmailRecipient> {
    const result = await db.insert(emailRecipients).values(email).returning();
    return result[0];
  }

  async removeEmailRecipient(id: string): Promise<void> {
    await db.delete(emailRecipients).where(eq(emailRecipients.id, id));
  }

  async toggleEmailRecipient(id: string, active: boolean): Promise<void> {
    await db.update(emailRecipients).set({ active }).where(eq(emailRecipients.id, id));
  }

  // Agent Settings
  async getAgentSettings(): Promise<AgentSettings | undefined> {
    const result = await db.select().from(agentSettings);
    if (result.length === 0) {
      // Create default settings
      const defaultSettings = await db.insert(agentSettings).values({
        checkIntervalMinutes: 10,
        isActive: true,
      }).returning();
      return defaultSettings[0];
    }
    return result[0];
  }

  async updateAgentSettings(settings: Partial<AgentSettings>): Promise<AgentSettings> {
    const current = await this.getAgentSettings();
    if (!current) {
      throw new Error("Agent settings not found");
    }
    const result = await db.update(agentSettings)
      .set(settings)
      .where(eq(agentSettings.id, current.id))
      .returning();
    return result[0];
  }

  // Check Logs
  async getCheckLogs(limit = 100): Promise<CheckLog[]> {
    return db.select().from(checkLogs).orderBy(desc(checkLogs.createdAt)).limit(limit);
  }

  async addCheckLog(log: InsertCheckLog): Promise<CheckLog> {
    const result = await db.insert(checkLogs).values(log).returning();
    return result[0];
  }

  async clearCheckLogs(): Promise<void> {
    await db.delete(checkLogs);
  }
}

export const storage = new DatabaseStorage();
