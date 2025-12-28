import { useState, useEffect, useRef } from "react";
import { 
  Activity, 
  Search, 
  Mail, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Terminal,
  Play,
  Pause,
  Settings,
  Database,
  ExternalLink
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

// Mock Data Types
interface Study {
  id: string;
  title: string;
  payout: number;
  time: string;
  type: "Remote" | "In-Person";
  matchScore: number;
  timestamp: Date;
}

interface LogEntry {
  id: string;
  timestamp: Date;
  message: string;
  type: "info" | "success" | "warning" | "error";
}

// Mock Studies Generator
const generateMockStudy = (): Study => {
  const topics = [
    "Software Developer Experience",
    "Cloud Infrastructure Usage",
    "Consumer Banking Habits",
    "AI Tool Adoption in Enterprise",
    "Remote Work Challenges",
    "E-commerce Shopping Preferences"
  ];
  
  return {
    id: Math.random().toString(36).substring(7),
    title: topics[Math.floor(Math.random() * topics.length)],
    payout: Math.floor(Math.random() * 200) + 50,
    time: `${Math.floor(Math.random() * 45) + 15} mins`,
    type: Math.random() > 0.7 ? "In-Person" : "Remote",
    matchScore: Math.floor(Math.random() * 20) + 80,
    timestamp: new Date()
  };
};

export default function Dashboard() {
  const [isActive, setIsActive] = useState(true);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [foundStudies, setFoundStudies] = useState<Study[]>([]);
  const [checkInterval, setCheckInterval] = useState(10); // in seconds for demo (simulating 10 mins)
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [emailAddress, setEmailAddress] = useState("user@example.com");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  // Simulation Logic
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isActive) {
      const addLog = (message: string, type: LogEntry["type"] = "info") => {
        setLogs(prev => [...prev, {
          id: Math.random().toString(36),
          timestamp: new Date(),
          message,
          type
        }].slice(-50)); // Keep last 50 logs
      };

      // Initial Start Log
      addLog("Agent process started (PID: 8492)", "info");
      addLog(`Monitoring target: https://app.respondent.io/respondents/v2/projects/browse`, "info");

      interval = setInterval(() => {
        // 1. Start Check
        addLog("Initiating scheduled check...", "info");
        
        setTimeout(() => {
          // 2. Simulate Request
          addLog("GET /v2/projects/browse - 200 OK", "success");
          
          // 3. Randomly find new study
          if (Math.random() > 0.6) {
            const newStudy = generateMockStudy();
            setFoundStudies(prev => [newStudy, ...prev]);
            addLog(`New study found: "${newStudy.title}" ($${newStudy.payout})`, "success");
            
            if (emailEnabled) {
              addLog(`Sending notification to ${emailAddress}...`, "warning");
              toast.success("New Study Alert", {
                description: `Email sent: Found "${newStudy.title}" paying $${newStudy.payout}`,
                duration: 4000,
              });
            }
          } else {
            addLog("No new matching studies found.", "info");
          }
          
          addLog(`Sleeping for ${checkInterval}m...`, "info");
        }, 1500); // Network delay simulation

      }, checkInterval * 1000);
    }

    return () => clearInterval(interval);
  }, [isActive, checkInterval, emailEnabled, emailAddress]);

  return (
    <div className="min-h-screen bg-background text-foreground p-6 md:p-8 font-sans selection:bg-primary/20 selection:text-primary">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
              <Database className="w-8 h-8 text-primary" />
              Respondent.io Agent
            </h1>
            <p className="text-muted-foreground font-mono text-sm">v2.1.0 • Automated Study Monitor</p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/50 border border-border">
              <div className={`w-2.5 h-2.5 rounded-full ${isActive ? 'bg-primary animate-pulse' : 'bg-red-500'}`} />
              <span className="text-xs font-mono font-medium uppercase tracking-wider">
                {isActive ? 'System Online' : 'System Offline'}
              </span>
            </div>
            <Button 
              variant={isActive ? "destructive" : "default"} 
              onClick={() => setIsActive(!isActive)}
              className="w-32"
            >
              {isActive ? (
                <><Pause className="w-4 h-4 mr-2" /> Stop</>
              ) : (
                <><Play className="w-4 h-4 mr-2" /> Start</>
              )}
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
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base">Email Notifications</Label>
                      <p className="text-xs text-muted-foreground">Receive alerts for new studies</p>
                    </div>
                    <Switch 
                      checked={emailEnabled}
                      onCheckedChange={setEmailEnabled}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Notification Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                      <Input 
                        value={emailAddress}
                        onChange={(e) => setEmailAddress(e.target.value)}
                        className="pl-9 font-mono text-sm"
                      />
                    </div>
                  </div>

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
                      onChange={(e) => setCheckInterval(parseInt(e.target.value))}
                      className="w-full h-2 bg-accent rounded-lg appearance-none cursor-pointer accent-primary"
                    />
                    <p className="text-xs text-muted-foreground text-right">Recommended: 10 mins</p>
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
                  ref={scrollRef}
                  className="absolute inset-0 overflow-y-auto p-4 font-mono text-xs space-y-1.5 scrollbar-hide"
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
                          {log.timestamp.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                        <span className={`${
                          log.type === 'success' ? 'text-emerald-400' : 
                          log.type === 'warning' ? 'text-amber-400' : 
                          log.type === 'error' ? 'text-red-400' : 
                          'text-slate-300'
                        }`}>
                          {log.type === 'success' && '✓ '}
                          {log.type === 'warning' && '→ '}
                          {log.type === 'error' && '✕ '}
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
                <Badge variant="outline" className="font-mono">
                  {foundStudies.length} Matches
                </Badge>
              </CardHeader>
              <CardContent className="flex-1 p-0 relative">
                <ScrollArea className="h-full absolute inset-0">
                  <div className="p-6 pt-0 space-y-4">
                    <AnimatePresence mode="popLayout">
                      {foundStudies.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-center space-y-4 opacity-50">
                          <Search className="w-12 h-12 text-muted-foreground" />
                          <p className="text-muted-foreground">Scanning for new projects...</p>
                        </div>
                      ) : (
                        foundStudies.map((study) => (
                          <motion.div
                            key={study.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            layout
                          >
                            <Card className="group border-border/40 hover:border-primary/50 transition-colors bg-accent/10">
                              <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                                      {study.title}
                                    </h3>
                                    {study.matchScore > 90 && (
                                      <Badge className="bg-primary/20 text-primary hover:bg-primary/30 border-0 text-[10px] px-1.5 py-0">
                                        High Match
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-4 text-xs text-muted-foreground font-mono">
                                    <span className="flex items-center gap-1.5">
                                      <Clock className="w-3 h-3" /> {study.time}
                                    </span>
                                    <span className="flex items-center gap-1.5">
                                      <Activity className="w-3 h-3" /> {study.type}
                                    </span>
                                    <span>
                                      Found: {study.timestamp.toLocaleTimeString()}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center justify-between sm:justify-end gap-4">
                                  <div className="text-right">
                                    <div className="text-xl font-bold text-emerald-400">
                                      ${study.payout}
                                    </div>
                                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Incentive</div>
                                  </div>
                                  <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                                    <ExternalLink className="w-4 h-4" />
                                  </Button>
                                </div>
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
