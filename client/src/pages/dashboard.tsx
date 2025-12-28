import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Activity, 
  Search, 
  Mail, 
  Clock, 
  Terminal,
  Play,
  Pause,
  Settings,
  Database,
  ExternalLink,
  Plus,
  X,
  Trash2,
  RefreshCw
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Study {
  id: string;
  externalId: string;
  title: string;
  payout: number;
  duration: string;
  studyType: string;
  studyFormat: string | null;
  matchScore: number | null;
  postedAt: string | null;
  link: string | null;
  description: string | null;
  notified: boolean | null;
  createdAt: string;
}

interface EmailRecipient {
  id: string;
  email: string;
  active: boolean | null;
  createdAt: string;
}

interface CheckLog {
  id: string;
  message: string;
  logType: string;
  createdAt: string;
}

interface AgentSettings {
  id: string;
  checkIntervalMinutes: number | null;
  isActive: boolean | null;
  lastCheckAt: string | null;
  isRunning: boolean;
}

async function apiRequest<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  if (!response.ok) {
    throw new Error(`API error: ${response.statusText}`);
  }
  return response.json();
}

export default function Dashboard() {
  const queryClient = useQueryClient();
  const [newEmail, setNewEmail] = useState("");

  // Fetch studies
  const { data: studies = [] } = useQuery<Study[]>({
    queryKey: ['/api/studies'],
    queryFn: () => apiRequest('/api/studies'),
    refetchInterval: 5000,
  });

  // Fetch logs
  const { data: logs = [] } = useQuery<CheckLog[]>({
    queryKey: ['/api/logs'],
    queryFn: () => apiRequest('/api/logs?limit=100'),
    refetchInterval: 3000,
  });

  // Fetch email recipients
  const { data: emails = [] } = useQuery<EmailRecipient[]>({
    queryKey: ['/api/emails'],
    queryFn: () => apiRequest('/api/emails'),
  });

  // Fetch agent settings
  const { data: settings } = useQuery<AgentSettings>({
    queryKey: ['/api/settings'],
    queryFn: () => apiRequest('/api/settings'),
    refetchInterval: 5000,
  });

  // Add email mutation
  const addEmailMutation = useMutation({
    mutationFn: (email: string) => apiRequest('/api/emails', {
      method: 'POST',
      body: JSON.stringify({ email, active: true }),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/emails'] });
      setNewEmail("");
      toast.success("Email added successfully");
    },
    onError: () => {
      toast.error("Failed to add email. Make sure it's a valid email address.");
    },
  });

  // Remove email mutation
  const removeEmailMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/emails/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/emails'] });
      toast.success("Email removed");
    },
  });

  // Toggle email mutation
  const toggleEmailMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => 
      apiRequest(`/api/emails/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/emails'] });
    },
  });

  // Update settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: (data: Partial<AgentSettings>) => 
      apiRequest('/api/settings', {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings'] });
    },
  });

  // Start agent mutation
  const startAgentMutation = useMutation({
    mutationFn: () => apiRequest('/api/agent/start', { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings'] });
      toast.success("Agent started");
    },
  });

  // Stop agent mutation
  const stopAgentMutation = useMutation({
    mutationFn: () => apiRequest('/api/agent/stop', { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings'] });
      toast.success("Agent stopped");
    },
  });

  // Manual check mutation
  const manualCheckMutation = useMutation({
    mutationFn: () => apiRequest('/api/check', { method: 'POST' }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/studies'] });
      queryClient.invalidateQueries({ queryKey: ['/api/logs'] });
      if (data.newStudiesCount > 0) {
        toast.success(`Found ${data.newStudiesCount} new study(ies)!`);
      } else {
        toast.info("No new studies found");
      }
    },
  });

  // Logs are already ordered newest first from API, no need to scroll to bottom

  const handleAddEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (newEmail.trim()) {
      addEmailMutation.mutate(newEmail.trim());
    }
  };

  const isActive = settings?.isRunning ?? false;
  const checkInterval = settings?.checkIntervalMinutes ?? 10;

  return (
    <div className="min-h-screen bg-background text-foreground p-6 md:p-8 font-sans selection:bg-primary/20 selection:text-primary">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3" data-testid="text-title">
              <Database className="w-8 h-8 text-primary" />
              Respondent.io Agent
            </h1>
            <p className="text-muted-foreground font-mono text-sm">v2.1.0 - Automated Study Monitor</p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/50 border border-border">
              <div className={`w-2.5 h-2.5 rounded-full ${isActive ? 'bg-primary animate-pulse' : 'bg-red-500'}`} data-testid="status-indicator" />
              <span className="text-xs font-mono font-medium uppercase tracking-wider" data-testid="text-status">
                {isActive ? 'System Online' : 'System Offline'}
              </span>
            </div>
            <Button 
              variant={isActive ? "destructive" : "default"} 
              onClick={() => isActive ? stopAgentMutation.mutate() : startAgentMutation.mutate()}
              className="w-32"
              data-testid="button-toggle-agent"
              disabled={startAgentMutation.isPending || stopAgentMutation.isPending}
            >
              {isActive ? (
                <><Pause className="w-4 h-4 mr-2" /> Stop</>
              ) : (
                <><Play className="w-4 h-4 mr-2" /> Start</>
              )}
            </Button>
            <Button 
              variant="outline" 
              onClick={() => manualCheckMutation.mutate()}
              disabled={manualCheckMutation.isPending}
              data-testid="button-manual-check"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${manualCheckMutation.isPending ? 'animate-spin' : ''}`} />
              Check Now
            </Button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-12rem)]">
          
          {/* Left Column: Configuration & Status */}
          <div className="space-y-6 flex flex-col">
            {/* Configuration Card */}
            <Card className="border-border/50 shadow-lg bg-card/50 backdrop-blur">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Settings className="w-5 h-5 text-primary" />
                  Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  {/* Check Interval */}
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <Label>Check Interval</Label>
                      <span className="text-xs font-mono text-primary">{checkInterval} mins</span>
                    </div>
                    <input 
                      type="range" 
                      min="1" 
                      max="60" 
                      value={checkInterval}
                      onChange={(e) => updateSettingsMutation.mutate({ checkIntervalMinutes: parseInt(e.target.value) })}
                      className="w-full h-2 bg-accent rounded-lg appearance-none cursor-pointer accent-primary"
                      data-testid="input-interval"
                    />
                    <p className="text-xs text-muted-foreground text-right">Recommended: 10 mins</p>
                  </div>

                  {/* Email Recipients */}
                  <div className="space-y-3 pt-4 border-t border-border/50">
                    <Label className="flex items-center gap-2">
                      <Mail className="w-4 h-4" />
                      Notification Emails
                    </Label>
                    
                    {/* Add new email form */}
                    <form onSubmit={handleAddEmail} className="flex gap-2">
                      <Input 
                        type="email"
                        placeholder="Add email address..."
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        className="flex-1 font-mono text-sm"
                        data-testid="input-new-email"
                      />
                      <Button 
                        type="submit" 
                        size="icon" 
                        variant="outline"
                        disabled={addEmailMutation.isPending}
                        data-testid="button-add-email"
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </form>

                    {/* Email list */}
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {emails.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">No email recipients configured</p>
                      ) : (
                        emails.map((recipient) => (
                          <div 
                            key={recipient.id} 
                            className="flex items-center justify-between gap-2 p-2 bg-accent/30 rounded-md"
                            data-testid={`email-recipient-${recipient.id}`}
                          >
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <Switch 
                                checked={recipient.active ?? true}
                                onCheckedChange={(checked) => toggleEmailMutation.mutate({ id: recipient.id, active: checked })}
                                data-testid={`switch-email-${recipient.id}`}
                              />
                              <span className={`text-xs font-mono truncate ${recipient.active ? '' : 'opacity-50 line-through'}`}>
                                {recipient.email}
                              </span>
                            </div>
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              className="h-6 w-6 text-muted-foreground hover:text-destructive"
                              onClick={() => removeEmailMutation.mutate(recipient.id)}
                              data-testid={`button-remove-email-${recipient.id}`}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Terminal Log */}
            <Card className="border-border/50 shadow-lg flex-1 flex flex-col bg-black/40 overflow-hidden">
              <CardHeader className="py-3 border-b border-border/50 bg-accent/20">
                <CardTitle className="flex items-center gap-2 text-sm font-mono text-muted-foreground">
                  <Terminal className="w-4 h-4" />
                  System Logs
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 p-0 relative">
                <div 
                  className="absolute inset-0 overflow-y-auto p-4 font-mono text-xs space-y-1.5 scrollbar-hide"
                  data-testid="container-logs"
                >
                  <AnimatePresence initial={false}>
                    {logs.map((log) => (
                      <motion.div 
                        key={log.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex gap-3"
                      >
                        <span className="text-muted-foreground opacity-50 shrink-0">
                          {new Date(log.createdAt).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                        <span className={`${
                          log.logType === 'success' ? 'text-emerald-400' : 
                          log.logType === 'warning' ? 'text-amber-400' : 
                          log.logType === 'error' ? 'text-red-400' : 
                          'text-slate-300'
                        }`}>
                          {log.logType === 'success' && '✓ '}
                          {log.logType === 'warning' && '→ '}
                          {log.logType === 'error' && '✕ '}
                          {log.message}
                        </span>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  {logs.length === 0 && (
                    <div className="text-muted-foreground italic opacity-50">Waiting for system start...</div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Results */}
          <div className="lg:col-span-2 flex flex-col h-full">
            <Card className="border-border/50 shadow-lg h-full flex flex-col bg-card/50 backdrop-blur">
              <CardHeader className="flex flex-row items-center justify-between pb-4">
                <div>
                  <CardTitle className="text-xl">Found Studies</CardTitle>
                  <CardDescription>Real-time feed of matching opportunities</CardDescription>
                </div>
                <Badge variant="outline" className="font-mono" data-testid="badge-study-count">
                  {studies.length} Matches
                </Badge>
              </CardHeader>
              <CardContent className="flex-1 p-0 relative">
                <ScrollArea className="h-full absolute inset-0">
                  <div className="p-6 pt-0 space-y-4">
                    <AnimatePresence mode="popLayout">
                      {studies.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-center space-y-4 opacity-50">
                          <Search className="w-12 h-12 text-muted-foreground" />
                          <p className="text-muted-foreground">Scanning for new projects...</p>
                        </div>
                      ) : (
                        studies.map((study) => (
                          <motion.div
                            key={study.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            layout
                            data-testid={`card-study-${study.id}`}
                          >
                            <Card className="group border-border/40 hover:border-primary/50 transition-colors bg-accent/10">
                              <CardContent className="p-4 space-y-2">
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <a 
                                        href={study.link || '#'} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="font-semibold text-primary hover:underline"
                                      >
                                        {study.title}
                                      </a>
                                      {study.notified && (
                                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                                          Notified
                                        </Badge>
                                      )}
                                    </div>
                                    <div className="flex items-center flex-wrap gap-1 text-xs text-muted-foreground mt-1">
                                      <span className="font-bold text-emerald-500">${study.payout.toFixed(2)}</span>
                                      {study.postedAt && (
                                        <>
                                          <span className="text-muted-foreground/50">·</span>
                                          <span>{study.postedAt}</span>
                                        </>
                                      )}
                                      <span className="text-muted-foreground/50">·</span>
                                      <span>{study.duration}</span>
                                      {study.studyFormat && (
                                        <>
                                          <span className="text-muted-foreground/50">·</span>
                                          <span>{study.studyFormat}</span>
                                        </>
                                      )}
                                      <span className="text-muted-foreground/50">·</span>
                                      <span>{study.studyType}</span>
                                    </div>
                                  </div>
                                  {study.link && (
                                    <a href={study.link} target="_blank" rel="noopener noreferrer" className="shrink-0">
                                      <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                                        <ExternalLink className="w-4 h-4" />
                                      </Button>
                                    </a>
                                  )}
                                </div>
                                {study.description && (
                                  <p className="text-xs text-muted-foreground line-clamp-2">
                                    {study.description}
                                  </p>
                                )}
                              </CardContent>
                            </Card>
                          </motion.div>
                        ))
                      )}
                    </AnimatePresence>
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

        </div>
      </div>
    </div>
  );
}
