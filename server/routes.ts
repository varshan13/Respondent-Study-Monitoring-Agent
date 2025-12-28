import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { startAgent, stopAgent, runCheck, isAgentRunning, restartAgent } from "./agent";
import { z } from "zod";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Get all studies
  app.get("/api/studies", async (_req, res) => {
    try {
      const studies = await storage.getStudies();
      res.json(studies);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch studies" });
    }
  });

  // Get check logs
  app.get("/api/logs", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const logs = await storage.getCheckLogs(limit);
      res.json(logs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch logs" });
    }
  });

  // Clear logs
  app.delete("/api/logs", async (_req, res) => {
    try {
      await storage.clearCheckLogs();
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to clear logs" });
    }
  });

  // Get email recipients
  app.get("/api/emails", async (_req, res) => {
    try {
      const recipients = await storage.getEmailRecipients();
      res.json(recipients);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch email recipients" });
    }
  });

  // Add email recipient
  app.post("/api/emails", async (req, res) => {
    try {
      const schema = z.object({
        email: z.string().email(),
        active: z.boolean().optional().default(true),
      });
      
      const data = schema.parse(req.body);
      const recipient = await storage.addEmailRecipient(data);
      res.json(recipient);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid email address" });
      } else {
        res.status(500).json({ error: "Failed to add email recipient" });
      }
    }
  });

  // Remove email recipient
  app.delete("/api/emails/:id", async (req, res) => {
    try {
      await storage.removeEmailRecipient(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to remove email recipient" });
    }
  });

  // Toggle email recipient active status
  app.patch("/api/emails/:id", async (req, res) => {
    try {
      const schema = z.object({
        active: z.boolean(),
      });
      
      const data = schema.parse(req.body);
      await storage.toggleEmailRecipient(req.params.id, data.active);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to update email recipient" });
    }
  });

  // Get agent settings
  app.get("/api/settings", async (_req, res) => {
    try {
      const settings = await storage.getAgentSettings();
      res.json({
        ...settings,
        isRunning: isAgentRunning(),
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch settings" });
    }
  });

  // Update agent settings
  app.patch("/api/settings", async (req, res) => {
    try {
      const schema = z.object({
        checkIntervalMinutes: z.number().min(1).max(60).optional(),
        isActive: z.boolean().optional(),
      });
      
      const data = schema.parse(req.body);
      const settings = await storage.updateAgentSettings(data);
      
      // Restart agent if settings changed
      if (data.isActive !== undefined) {
        if (data.isActive) {
          await startAgent();
        } else {
          await stopAgent();
        }
      } else if (data.checkIntervalMinutes !== undefined) {
        await restartAgent();
      }
      
      res.json({
        ...settings,
        isRunning: isAgentRunning(),
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to update settings" });
    }
  });

  // Manual trigger check
  app.post("/api/check", async (_req, res) => {
    try {
      const newStudies = await runCheck();
      await storage.updateAgentSettings({ lastCheckAt: new Date() });
      res.json({ 
        success: true, 
        newStudiesCount: newStudies.length,
        studies: newStudies 
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to run check" });
    }
  });

  // Start agent
  app.post("/api/agent/start", async (_req, res) => {
    try {
      await storage.updateAgentSettings({ isActive: true });
      await startAgent();
      res.json({ success: true, isRunning: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to start agent" });
    }
  });

  // Stop agent
  app.post("/api/agent/stop", async (_req, res) => {
    try {
      await storage.updateAgentSettings({ isActive: false });
      await stopAgent();
      res.json({ success: true, isRunning: false });
    } catch (error) {
      res.status(500).json({ error: "Failed to stop agent" });
    }
  });

  // Start the agent on server startup
  setTimeout(() => {
    startAgent().catch(console.error);
  }, 2000);

  return httpServer;
}
