import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Server, 
  Cpu, 
  HardDrive, 
  Database, 
  Terminal as TerminalIcon, 
  Settings, 
  Plus, 
  Send, 
  RefreshCw, 
  Clock, 
  User, 
  Key, 
  Copy, 
  Check, 
  Play, 
  Square, 
  Power, 
  Trash2, 
  ShieldAlert, 
  ExternalLink, 
  CheckCircle, 
  Activity, 
  AlertTriangle,
  Code,
  Lock,
  ChevronRight,
  Sparkles
} from "lucide-react";
import { VPSInstance, NodeStats, DiscordMessage } from "./types";
import { SUPPORTED_OS, SPEC_TIERS, OSTemplate } from "./vpsData";

export default function App() {
  // Global States
  const [vpsList, setVpsList] = useState<VPSInstance[]>([]);
  const [nodeStats, setNodeStats] = useState<NodeStats | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [messages, setMessages] = useState<DiscordMessage[]>([]);
  
  // Interactive UI States
  const [activeTab, setActiveTab] = useState<"dashboard" | "deploy" | "logs" | "settings">("dashboard");
  const [chatSender, setChatSender] = useState<string>("1165638991668842500");
  const [chatInput, setChatInput] = useState<string>("");
  const [adminIdSetting, setAdminIdSetting] = useState<string>("1165638991668842500");
  const [configSuccess, setConfigSuccess] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [loadingActionId, setLoadingActionId] = useState<string | null>(null);

  // Deployer Wizard States (Dashboard & Creator Panel)
  const [deployOwner, setDeployOwner] = useState<string>("1165638991668842500");
  const [deployOwnerId, setDeployOwnerId] = useState<string>("246813579101");
  const [deployOS, setDeployOS] = useState<"ubuntu" | "debian">("ubuntu");
  const [deployCpu, setDeployCpu] = useState<number>(2);
  const [deployRam, setDeployRam] = useState<number>(2048);
  const [deployDisk, setDeployDisk] = useState<number>(30);
  const [deployDays, setDeployDays] = useState<number>(30);
  const [isDeploying, setIsDeploying] = useState<boolean>(false);

  // Terminal Simulator States
  const [selectedTerminalVpsId, setSelectedTerminalVpsId] = useState<string | null>(null);
  const [terminalInput, setTerminalInput] = useState<string>("");
  const [terminalOutputs, setTerminalOutputs] = useState<{ [vpsId: string]: string[] }>({});
  const terminalBottomRef = useRef<HTMLDivElement | null>(null);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);

  // Auto-scrolling Helpers
  useEffect(() => {
    if (terminalBottomRef.current) {
      terminalBottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [terminalOutputs, selectedTerminalVpsId]);

  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Fetch all core system data
  const fetchAllData = useCallback(async () => {
    try {
      const [vpsRes, statsRes, logsRes, msgRes, configRes] = await Promise.all([
        fetch("/api/vps"),
        fetch("/api/node-stats"),
        fetch("/api/logs"),
        fetch("/api/discord/messages"),
        fetch("/api/config")
      ]);

      if (vpsRes.ok) setVpsList(await vpsRes.json());
      if (statsRes.ok) setNodeStats(await statsRes.json());
      if (logsRes.ok) setLogs(await logsRes.json());
      if (msgRes.ok) setMessages(await msgRes.json());
      if (configRes.ok) {
        const conf = await configRes.json();
        setAdminIdSetting(conf.adminUserId || "1165638991668842500");
      }
    } catch (err) {
      console.error("Failed to synchronize with dashboard API daemon.", err);
    }
  }, []);

  // Poll server data periodically
  useEffect(() => {
    fetchAllData();
    const interval = setInterval(fetchAllData, 5000);
    return () => clearInterval(interval);
  }, [fetchAllData]);

  // Handle Clipboard copies
  const handleCopyText = (text: string, labelId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(labelId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // VPS Lifecycle Trigger Action
  const triggerVpsAction = async (vpsId: string, action: string) => {
    setLoadingActionId(`${vpsId}-${action}`);
    try {
      const response = await fetch(`/api/vps/${vpsId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action })
      });
      if (response.ok) {
        await fetchAllData();
      }
    } catch (err) {
      console.error(`Failed to invoke lifecycle action ${action} on container ${vpsId}`, err);
    } finally {
      setLoadingActionId(null);
    }
  };

  // Delete VPS Instance
  const deleteVpsInstance = async (vpsId: string) => {
    if (!window.confirm(`Are you sure you want to permanently destroy and delete VPS container '${vpsId}'? This action is irreversible.`)) {
      return;
    }
    setLoadingActionId(`${vpsId}-delete`);
    try {
      const response = await fetch(`/api/vps/${vpsId}`, {
        method: "DELETE"
      });
      if (response.ok) {
        await fetchAllData();
      }
    } catch (err) {
      console.error(`Failed to delete container ${vpsId}`, err);
    } finally {
      setLoadingActionId(null);
    }
  };

  // Extend VPS duration
  const extendVpsInstance = async (vpsId: string) => {
    const daysStr = window.prompt("Enter number of days to extend this license license allocation by:", "30");
    if (!daysStr || isNaN(parseInt(daysStr))) return;
    
    setLoadingActionId(`${vpsId}-extend`);
    try {
      const response = await fetch(`/api/vps/${vpsId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ daysToExtend: parseInt(daysStr) })
      });
      if (response.ok) {
        await fetchAllData();
      }
    } catch (err) {
      console.error(`Failed to extend validity of container ${vpsId}`, err);
    } finally {
      setLoadingActionId(null);
    }
  };

  // Create/Deploy Container Instance from form
  const handleCreateVps = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsDeploying(true);
    try {
      const response = await fetch("/api/vps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownerName: deployOwner,
          ownerId: deployOwnerId,
          os: deployOS,
          memLimit: deployRam,
          cpuLimit: deployCpu,
          diskLimit: deployDisk,
          daysTotal: deployDays
        })
      });
      if (response.ok) {
        // Reset states
        setDeployOwner("");
        setDeployOwnerId("");
        setActiveTab("dashboard");
        await fetchAllData();
      }
    } catch (err) {
      console.error("Failed to request core container allocation", err);
    } finally {
      setIsDeploying(false);
    }
  };

  // Save admin configuration
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminUserId: adminIdSetting })
      });
      if (response.ok) {
        setConfigSuccess(true);
        setTimeout(() => setConfigSuccess(false), 3000);
        await fetchAllData();
      }
    } catch (err) {
      console.error("Failed to update system config", err);
    }
  };

  // Send a simulated Discord Chat message
  const handleSendDiscordMsg = async (textToSend?: string) => {
    const text = textToSend !== undefined ? textToSend : chatInput;
    if (!text.trim()) return;

    if (textToSend === undefined) {
      setChatInput("");
    }

    try {
      const response = await fetch("/api/discord/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sender: chatSender,
          content: text,
          isAdmin: chatSender.toLowerCase() === adminIdSetting.toLowerCase()
        })
      });
      if (response.ok) {
        await fetchAllData();
      }
    } catch (err) {
      console.error("Failed to transmit simulation chat sequence", err);
    }
  };

  // Handle Simulated Discord Button/Select Interaction Click
  const handleDiscordInteraction = async (customId: string, value?: string) => {
    // Add logging that simulation triggered
    try {
      // Buttons often trigger a command or a state update in our simulated chat
      let content = "";
      if (customId === "btn-stats") content = "/node-stats";
      else if (customId === "btn-list") content = "/my-vps";
      else if (customId === "btn-ptero") content = "/ptero-status";
      else if (customId === "btn-deploy-start") content = "/deploy";
      else if (customId.startsWith("select-os-")) {
        content = `Selected OS: ${value}`;
      } else if (customId.startsWith("select-spec-")) {
        content = `Selected Spec Tier: ${value}`;
      } else if (customId === "btn-launch") {
        content = "Confirming Container Deployment";
      } else {
        content = `[Interaction Click: ${customId}${value ? ` with val: ${value}` : ""}]`;
      }

      await handleSendDiscordMsg(content);
    } catch (err) {
      console.error("Failed to send interaction message", err);
    }
  };

  // Handle Terminal execution inside simulated container drawer
  const executeTerminalCmd = async (vpsId: string) => {
    if (!terminalInput.trim()) return;
    const cmd = terminalInput.trim();
    setTerminalInput("");

    // Append to output
    const currentOutputs = terminalOutputs[vpsId] || [];
    const updatedWithInput = [...currentOutputs, `root@${vpsId}:~# ${cmd}`];
    setTerminalOutputs(prev => ({ ...prev, [vpsId]: updatedWithInput }));

    try {
      const res = await fetch(`/api/vps/${vpsId}/terminal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: cmd })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.output === "CLEAR") {
          setTerminalOutputs(prev => ({ ...prev, [vpsId]: [] }));
        } else {
          setTerminalOutputs(prev => ({
            ...prev,
            [vpsId]: [...updatedWithInput, data.output]
          }));
        }
      }
    } catch (err) {
      console.error("Failed to communicate with container cgroup socket", err);
    }
  };

  // Pre-fill terminal output with intro text when first opened
  const openTerminal = (vpsId: string) => {
    setSelectedTerminalVpsId(vpsId);
    if (!terminalOutputs[vpsId]) {
      setTerminalOutputs(prev => ({
        ...prev,
        [vpsId]: [
          `Connected to simulated SSH terminal console for VPS container: ${vpsId}`,
          `Systemd boot cgroups detected. Running bash shell.`,
          `Type 'help' to view simulated Unix diagnostics commands.`,
          ``
        ]
      }));
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-indigo-500/20">
      {/* Header Panel */}
      <header className="bg-slate-900 border-b border-slate-800/80 sticky top-0 z-40 backdrop-blur-md px-6 py-4 shadow-xl">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-tr from-indigo-500 to-violet-600 p-2.5 rounded-xl shadow-lg shadow-indigo-500/20">
              <Server className="h-6 w-6 text-white animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-sans font-bold text-xl tracking-tight text-white">NodeSurge</h1>
                <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-xs px-2 py-0.5 rounded-full font-mono font-semibold">
                  Hypervisor Panel
                </span>
              </div>
              <p className="text-xs text-slate-400">Pterodactyl Panel + Docker Wings Integration</p>
            </div>
          </div>

          {/* Connection Status Gauges */}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2 bg-emerald-500/5 px-3 py-1.5 rounded-lg border border-emerald-500/15">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-xs font-mono font-medium text-emerald-400">WINGS_CONNECTOR_ONLINE</span>
            </div>

            <div className="flex items-center gap-2 bg-cyan-500/5 px-3 py-1.5 rounded-lg border border-cyan-500/15">
              <span className="relative flex h-2 w-2">
                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-400"></span>
              </span>
              <span className="text-xs font-mono font-medium text-cyan-400">PTERO_API_SYNCHRONIZED</span>
            </div>

            <button 
              onClick={fetchAllData}
              className="bg-slate-800 hover:bg-slate-700 transition p-2 rounded-lg text-slate-300"
              title="Manual Telemetry Poll"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column (Main Panel) */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          
          {/* Navigation Bar */}
          <nav className="flex gap-2 bg-slate-900 p-1.5 rounded-xl border border-slate-800/80">
            <button
              onClick={() => setActiveTab("dashboard")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition duration-200 ${
                activeTab === "dashboard"
                  ? "bg-slate-800 text-white shadow-md border-b-2 border-indigo-500"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
            >
              <Activity className="h-4 w-4" />
              Infrastructure Dashboard
            </button>
            <button
              onClick={() => setActiveTab("deploy")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition duration-200 ${
                activeTab === "deploy"
                  ? "bg-slate-800 text-white shadow-md border-b-2 border-indigo-500"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
            >
              <Plus className="h-4 w-4" />
              Provision Container
            </button>
            <button
              onClick={() => setActiveTab("logs")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition duration-200 ${
                activeTab === "logs"
                  ? "bg-slate-800 text-white shadow-md border-b-2 border-indigo-500"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
            >
              <TerminalIcon className="h-4 w-4" />
              Daemon Hypervisor Logs
            </button>
            <button
              onClick={() => setActiveTab("settings")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition duration-200 ${
                activeTab === "settings"
                  ? "bg-slate-800 text-white shadow-md border-b-2 border-indigo-500"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
            >
              <Settings className="h-4 w-4" />
              Admin Credentials
            </button>
          </nav>

          {/* Tab Contents */}
          <div className="flex-1">
            <AnimatePresence mode="wait">
              
              {/* TAB 1: Dashboard */}
              {activeTab === "dashboard" && (
                <motion.div
                  key="tab-dashboard"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-6"
                >
                  {/* Telemetry Progress Bento Section */}
                  {nodeStats ? (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      {/* Stat 1: Core Allocation */}
                      <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 relative overflow-hidden">
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">CPU Core Allocation</span>
                          <Cpu className="h-5 w-5 text-indigo-400" />
                        </div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-2xl font-bold font-mono text-white">
                            {nodeStats.activeAllocatedCpu}
                          </span>
                          <span className="text-xs text-slate-400 font-mono">/ 16 Cores</span>
                        </div>
                        <div className="mt-3 w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div 
                            className="bg-indigo-500 h-full rounded-full transition-all duration-1000"
                            style={{ width: `${Math.min(100, (nodeStats.activeAllocatedCpu / 16) * 100)}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                          <span>Usage Spike: {nodeStats.hostCpuUsage}%</span>
                          <span>{Math.floor((nodeStats.activeAllocatedCpu / 16) * 100)}% Allocated</span>
                        </div>
                      </div>

                      {/* Stat 2: RAM Memory Allocation */}
                      <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 relative overflow-hidden">
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Memory Allocation</span>
                          <Database className="h-5 w-5 text-emerald-400" />
                        </div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-2xl font-bold font-mono text-white">
                            {(nodeStats.activeAllocatedMem / 1024).toFixed(1)}
                          </span>
                          <span className="text-xs text-slate-400 font-mono">/ 16.0 GB</span>
                        </div>
                        <div className="mt-3 w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div 
                            className="bg-emerald-500 h-full rounded-full transition-all duration-1000"
                            style={{ width: `${Math.min(100, (nodeStats.activeAllocatedMem / 16384) * 100)}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                          <span>Daemon Cache: {Math.floor(nodeStats.hostMemUsage)} MB</span>
                          <span>{Math.floor((nodeStats.activeAllocatedMem / 16384) * 100)}% Allocated</span>
                        </div>
                      </div>

                      {/* Stat 3: Storage Quotas */}
                      <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 relative overflow-hidden">
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Virtual Storage</span>
                          <HardDrive className="h-5 w-5 text-cyan-400" />
                        </div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-2xl font-bold font-mono text-white">
                            {nodeStats.activeAllocatedDisk}
                          </span>
                          <span className="text-xs text-slate-400 font-mono">/ 500 GB</span>
                        </div>
                        <div className="mt-3 w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div 
                            className="bg-cyan-500 h-full rounded-full transition-all duration-1000"
                            style={{ width: `${Math.min(100, (nodeStats.activeAllocatedDisk / 500) * 100)}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                          <span>Bind Mounts: {nodeStats.hostDiskUsage} GB</span>
                          <span>{Math.floor((nodeStats.activeAllocatedDisk / 500) * 100)}% Allocated</span>
                        </div>
                      </div>

                      {/* Stat 4: Containers Count */}
                      <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 relative overflow-hidden">
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Instances</span>
                          <Server className="h-5 w-5 text-violet-400" />
                        </div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-3xl font-black font-mono text-white">
                            {nodeStats.totalContainers}
                          </span>
                          <span className="text-xs text-slate-400">VM Containers</span>
                        </div>
                        <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-300">
                          <span className="inline-block h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
                          <span>Docker Cgroup-v2 Active</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 text-center text-slate-400 animate-pulse font-mono">
                      Establishing core node RPC tunnel...
                    </div>
                  )}

                  {/* Active Simulated VPS Environments */}
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h2 className="text-base font-bold text-white flex items-center gap-2">
                        <Server className="h-4.5 w-4.5 text-indigo-400" />
                        Simulated Ubuntu / Debian Containers
                      </h2>
                      <span className="text-xs text-slate-400 font-mono">
                        {vpsList.length} total environments provisioned
                      </span>
                    </div>

                    {vpsList.length === 0 ? (
                      <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center">
                        <div className="h-12 w-12 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
                          <Server className="h-6 w-6" />
                        </div>
                        <h3 className="text-white font-medium text-sm mb-1">No Active VPS Containers</h3>
                        <p className="text-xs text-slate-400 max-w-sm mx-auto mb-4">
                          All simulated container hypervisors have been deleted or suspended. Run `/deploy` in the Discord Simulator or click below to launch a new virtual systemd instance.
                        </p>
                        <button
                          onClick={() => setActiveTab("deploy")}
                          className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs px-4 py-2 rounded-lg shadow-lg hover:shadow-indigo-500/20 transition"
                        >
                          Provision First Container
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-4">
                        {vpsList.map((vps) => {
                          const isTerminalOpen = selectedTerminalVpsId === vps.id;
                          const osTemplate = SUPPORTED_OS.find(o => o.id === vps.os) || SUPPORTED_OS[0];
                          
                          // Expiry percentage bar
                          const nowMs = Date.now();
                          const createdMs = new Date(vps.createdAt).getTime();
                          const expiresMs = new Date(vps.expiryDate).getTime();
                          const totalDuration = expiresMs - createdMs;
                          const elapsed = nowMs - createdMs;
                          const daysLeft = Math.max(0, Math.ceil((expiresMs - nowMs) / (1000 * 60 * 60 * 24)));
                          const expiryPercentage = totalDuration > 0 ? Math.min(100, Math.max(0, 100 - (elapsed / totalDuration) * 100)) : 100;

                          return (
                            <div 
                              key={vps.id}
                              className={`bg-slate-900 border ${vps.status === "suspended" ? "border-amber-500/40" : "border-slate-800/80"} rounded-xl p-5 hover:border-slate-700/80 transition shadow-lg relative`}
                            >
                              {/* VPS Header / OS Badge / Status Indicator */}
                              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 border-b border-slate-800/80 pb-4 mb-4">
                                <div className="flex items-center gap-3">
                                  <div className="bg-slate-800/60 p-2 rounded-lg border border-slate-700">
                                    <img 
                                      src={osTemplate.logo} 
                                      alt={osTemplate.name} 
                                      className="h-8 w-8 object-contain"
                                      referrerPolicy="no-referrer"
                                    />
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <h3 className="font-mono font-bold text-white text-base">
                                        {vps.id}
                                      </h3>
                                      <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold font-mono uppercase ${
                                        vps.status === "active" 
                                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                          : vps.status === "stopped"
                                          ? "bg-slate-800 text-slate-400 border border-slate-700"
                                          : "bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse"
                                      }`}>
                                        <span className={`h-1.5 w-1.5 rounded-full ${
                                          vps.status === "active" ? "bg-emerald-400 animate-pulse" : vps.status === "stopped" ? "bg-slate-500" : "bg-amber-400"
                                        }`}></span>
                                        {vps.status}
                                      </div>
                                    </div>
                                    <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                                      <User className="h-3 w-3 text-slate-500" />
                                      Owner: <span className="text-slate-300 font-medium">{vps.ownerName}</span>
                                      <span className="text-slate-600 font-mono text-[10px]">({vps.ownerId})</span>
                                    </p>
                                  </div>
                                </div>

                                {/* Main Lifecycle Control Buttons */}
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {vps.status !== "suspended" ? (
                                    <>
                                      <button
                                        onClick={() => triggerVpsAction(vps.id, "start")}
                                        disabled={vps.status === "active" || loadingActionId === `${vps.id}-start`}
                                        className="bg-emerald-600/10 hover:bg-emerald-600 border border-emerald-500/20 hover:border-emerald-500 text-emerald-400 hover:text-white transition px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                        title="Systemctl Daemon Start"
                                      >
                                        <Play className="h-3 w-3" />
                                        Start
                                      </button>
                                      
                                      <button
                                        onClick={() => triggerVpsAction(vps.id, "stop")}
                                        disabled={vps.status === "stopped" || loadingActionId === `${vps.id}-stop`}
                                        className="bg-slate-800 hover:bg-red-950 border border-slate-700 hover:border-red-500/50 text-slate-400 hover:text-red-400 transition px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                        title="Graceful SIGTERM Stop"
                                      >
                                        <Square className="h-3 w-3" />
                                        Stop
                                      </button>

                                      <button
                                        onClick={() => triggerVpsAction(vps.id, "restart")}
                                        disabled={loadingActionId === `${vps.id}-restart`}
                                        className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition p-1.5 rounded-lg text-xs"
                                        title="Hard Systemd Reboot"
                                      >
                                        <Power className="h-3.5 w-3.5" />
                                      </button>

                                      <button
                                        onClick={() => triggerVpsAction(vps.id, "reinstall")}
                                        disabled={loadingActionId === `${vps.id}-reinstall`}
                                        className="bg-slate-800 hover:bg-indigo-950 border border-slate-700 hover:border-indigo-500/50 text-indigo-400 transition px-2.5 py-1.5 rounded-lg text-xs font-medium"
                                        title="Wipe Root FS & Re-deploy Template"
                                      >
                                        OS Rebuild
                                      </button>
                                    </>
                                  ) : (
                                    <span className="text-xs bg-amber-500/10 border border-amber-500/20 text-amber-400 px-3 py-1.5 rounded-lg font-mono font-bold flex items-center gap-1.5">
                                      <AlertTriangle className="h-3.5 w-3.5 text-amber-400 animate-pulse" />
                                      SUSPENDED_BY_ADMIN
                                    </span>
                                  )}

                                  {/* Administrative Suspension & Expiry */}
                                  <div className="h-6 w-px bg-slate-800 mx-1"></div>

                                  <button
                                    onClick={() => triggerVpsAction(vps.id, vps.status === "suspended" ? "unsuspend" : "suspend")}
                                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition ${
                                      vps.status === "suspended"
                                        ? "bg-amber-500 text-slate-950 border-amber-400 hover:bg-amber-400"
                                        : "bg-slate-800 text-amber-400 border-slate-700 hover:bg-amber-500/10 hover:border-amber-500/30"
                                    }`}
                                  >
                                    {vps.status === "suspended" ? "Unsuspend" : "Suspend"}
                                  </button>

                                  <button
                                    onClick={() => deleteVpsInstance(vps.id)}
                                    className="bg-red-500/10 hover:bg-red-600 border border-red-500/20 hover:border-red-500 text-red-400 hover:text-white transition p-1.5 rounded-lg"
                                    title="Wipe Server Cgroup Container"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>

                              {/* Container Core Specs Detail Rows */}
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 text-xs font-mono">
                                <div className="bg-slate-950/40 p-2.5 rounded-lg border border-slate-800">
                                  <span className="text-slate-500 block mb-0.5">CPU ALLOCATION</span>
                                  <span className="text-slate-200 font-bold text-sm flex items-center gap-1">
                                    <Cpu className="h-3.5 w-3.5 text-indigo-400" />
                                    {vps.cpuLimit} dedicated core{vps.cpuLimit > 1 ? "s" : ""}
                                  </span>
                                </div>

                                <div className="bg-slate-950/40 p-2.5 rounded-lg border border-slate-800">
                                  <span className="text-slate-500 block mb-0.5">RAM ALLOCATION</span>
                                  <span className="text-slate-200 font-bold text-sm flex items-center gap-1">
                                    <Database className="h-3.5 w-3.5 text-emerald-400" />
                                    {vps.memLimit} MB
                                  </span>
                                </div>

                                <div className="bg-slate-950/40 p-2.5 rounded-lg border border-slate-800">
                                  <span className="text-slate-500 block mb-0.5">VIRTUAL DISK SIZE</span>
                                  <span className="text-slate-200 font-bold text-sm flex items-center gap-1">
                                    <HardDrive className="h-3.5 w-3.5 text-cyan-400" />
                                    {vps.diskLimit} GB overlay
                                  </span>
                                </div>

                                <div className="bg-slate-950/40 p-2.5 rounded-lg border border-slate-800">
                                  <span className="text-slate-500 block mb-0.5">PTERO_SERVER_ID</span>
                                  <span className="text-indigo-400 font-bold text-sm flex items-center gap-1 uppercase">
                                    <Code className="h-3.5 w-3.5 text-indigo-400" />
                                    {vps.pteroServerId}
                                  </span>
                                </div>
                              </div>

                              {/* Credentials & Copy SSH handshakes */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4 text-xs font-mono">
                                <div className="flex items-center justify-between bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
                                  <div className="overflow-hidden mr-2">
                                    <span className="text-[10px] text-slate-500 uppercase block">Terminal Port (tmate SSH Host)</span>
                                    <span className="text-slate-200 truncate block text-xs">
                                      {vps.status === "active" ? vps.tmateSSH : "Offline. Power on container."}
                                    </span>
                                  </div>
                                  {vps.status === "active" && (
                                    <button
                                      onClick={() => handleCopyText(vps.tmateSSH, `${vps.id}-ssh`)}
                                      className="p-1.5 hover:bg-slate-800 transition rounded-md text-slate-400 hover:text-white shrink-0"
                                      title="Copy SSH Tunnel URI"
                                    >
                                      {copiedId === `${vps.id}-ssh` ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                                    </button>
                                  )}
                                </div>

                                <div className="flex items-center justify-between bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
                                  <div>
                                    <span className="text-[10px] text-slate-500 uppercase block">Root Password credential</span>
                                    <span className="text-slate-200 font-bold text-xs select-all">
                                      {vps.rootPassword}
                                    </span>
                                  </div>
                                  <button
                                    onClick={() => handleCopyText(vps.rootPassword, `${vps.id}-pass`)}
                                    className="p-1.5 hover:bg-slate-800 transition rounded-md text-slate-400 hover:text-white shrink-0"
                                    title="Copy Password"
                                  >
                                    {copiedId === `${vps.id}-pass` ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                                  </button>
                                </div>
                              </div>

                              {/* License Period Expiry Progress */}
                              <div className="flex items-center justify-between bg-slate-950/20 px-3 py-2 rounded-lg border border-slate-800/60 text-xs">
                                <div className="flex items-center gap-2 text-slate-400 font-mono">
                                  <Clock className="h-3.5 w-3.5 text-slate-500" />
                                  <span>Expires: <strong className="text-slate-300">{new Date(vps.expiryDate).toLocaleDateString()}</strong></span>
                                  <span className="text-slate-500">({daysLeft} days remaining)</span>
                                </div>

                                <div className="flex items-center gap-3">
                                  <div className="w-24 bg-slate-800 h-1 rounded-full overflow-hidden hidden md:block">
                                    <div 
                                      className={`h-full rounded-full ${daysLeft < 5 ? "bg-red-500" : daysLeft < 15 ? "bg-amber-500" : "bg-indigo-500"}`}
                                      style={{ width: `${expiryPercentage}%` }}
                                    />
                                  </div>
                                  <button
                                    onClick={() => extendVpsInstance(vps.id)}
                                    className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer underline underline-offset-2"
                                  >
                                    Extend Period
                                  </button>
                                </div>
                              </div>

                              {/* Embedded Terminal Trigger */}
                              <div className="mt-4 flex justify-end">
                                <button
                                  onClick={() => isTerminalOpen ? setSelectedTerminalVpsId(null) : openTerminal(vps.id)}
                                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition ${
                                    isTerminalOpen 
                                      ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/10" 
                                      : "bg-slate-950 hover:bg-slate-800 border border-slate-800 text-indigo-400 hover:text-indigo-300"
                                  }`}
                                >
                                  <TerminalIcon className="h-3.5 w-3.5" />
                                  {isTerminalOpen ? "Close Terminal drawer" : "Open Systemd Terminal"}
                                </button>
                              </div>

                              {/* Expandable Simulated Terminal Screen */}
                              <AnimatePresence>
                                {isTerminalOpen && (
                                  <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: "auto" }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="overflow-hidden mt-4 border-t border-slate-800 pt-4"
                                  >
                                    <div className="bg-black/90 rounded-xl border border-indigo-500/30 p-4 font-mono text-[11px] leading-relaxed shadow-inner shadow-indigo-500/5">
                                      {/* Header */}
                                      <div className="flex justify-between items-center border-b border-indigo-950 pb-2 mb-3 text-slate-500 text-[10px]">
                                        <span className="flex items-center gap-1.5">
                                          <span className="h-1.5 w-1.5 bg-green-400 rounded-full animate-ping"></span>
                                          CONTAINER TERMINAL SHELL (ACTIVE)
                                        </span>
                                        <span>tmate-v2.1 /bin/bash</span>
                                      </div>

                                      {/* Output buffer */}
                                      <div className="space-y-1.5 max-h-56 overflow-y-auto pr-2 mb-3 select-text select-all">
                                        {(terminalOutputs[vps.id] || []).map((line, i) => (
                                          <div key={i} className="whitespace-pre-wrap text-emerald-400">
                                            {line}
                                          </div>
                                        ))}
                                        <div ref={terminalBottomRef}></div>
                                      </div>

                                      {/* Command Input Row */}
                                      <div className="flex items-center gap-2 border-t border-slate-900 pt-2.5">
                                        <span className="text-indigo-400 shrink-0">root@{vps.id}:~#</span>
                                        <input
                                          type="text"
                                          value={terminalInput}
                                          onChange={(e) => setTerminalInput(e.target.value)}
                                          onKeyDown={(e) => e.key === "Enter" && executeTerminalCmd(vps.id)}
                                          placeholder="Type command (e.g. htop, neofetch, systemctl, clear) and press Enter..."
                                          disabled={vps.status !== "active"}
                                          className="flex-1 bg-transparent text-white outline-none border-none placeholder-slate-700 font-mono disabled:cursor-not-allowed text-[11px]"
                                        />
                                        <button
                                          onClick={() => executeTerminalCmd(vps.id)}
                                          disabled={vps.status !== "active"}
                                          className="bg-indigo-600/25 hover:bg-indigo-600 px-2 py-1 rounded text-indigo-400 hover:text-white transition cursor-pointer text-[10px]"
                                        >
                                          Run
                                        </button>
                                      </div>
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>

                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {/* TAB 2: Deploy Container Form */}
              {activeTab === "deploy" && (
                <motion.div
                  key="tab-deploy"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="bg-slate-900 border border-slate-800/80 rounded-xl p-6 shadow-xl"
                >
                  <div className="flex items-center gap-2 mb-4">
                    <Sparkles className="h-5 w-5 text-indigo-400" />
                    <h2 className="text-lg font-bold text-white">Provision Virtual Container Instance</h2>
                  </div>
                  <p className="text-xs text-slate-400 mb-6">
                    Launch a high-performance systemd virtual template inside the Docker node. Resource limits are configured at the cgroup level, and synced dynamically with Pterodactyl.
                  </p>

                  <form onSubmit={handleCreateVps} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Form Field 1: Owner */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                          Owner Discord Username / Sender
                        </label>
                        <div className="relative">
                          <User className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                          <input
                            type="text"
                            required
                            placeholder="e.g. 1165638991668842500"
                            value={deployOwner}
                            onChange={(e) => setDeployOwner(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-10 pr-4 py-2.5 text-sm outline-none text-white focus:border-indigo-500 transition font-mono"
                          />
                        </div>
                      </div>

                      {/* Form Field 2: Owner ID */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                          Owner Discord SnowFlake ID
                        </label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                          <input
                            type="text"
                            placeholder="e.g. 246813579101 (optional)"
                            value={deployOwnerId}
                            onChange={(e) => setDeployOwnerId(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-10 pr-4 py-2.5 text-sm outline-none text-white focus:border-indigo-500 transition font-mono"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Operating System Switcher cards */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                        Operating System Template Image
                      </label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {SUPPORTED_OS.map((os) => (
                          <div
                            key={os.id}
                            onClick={() => setDeployOS(os.id)}
                            className={`p-4 rounded-xl border-2 cursor-pointer transition flex items-center justify-between ${
                              deployOS === os.id
                                ? "bg-indigo-950/20 border-indigo-500 shadow-lg shadow-indigo-500/5"
                                : "bg-slate-950 border-slate-800 hover:border-slate-700"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <img src={os.logo} alt={os.name} className="h-10 w-10 object-contain" referrerPolicy="no-referrer" />
                              <div>
                                <h3 className="font-bold text-white text-sm">{os.name} Systemd</h3>
                                <p className="text-xs text-slate-400">{os.version}</p>
                              </div>
                            </div>
                            <div className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                              deployOS === os.id ? "border-indigo-500 bg-indigo-500" : "border-slate-700"
                            }`}>
                              {deployOS === os.id && <div className="h-1.5 w-1.5 rounded-full bg-white"></div>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* sliders for resource caps */}
                    <div className="space-y-4 bg-slate-950/60 p-5 rounded-xl border border-slate-800/80">
                      <h3 className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">Cgroup Limitation Specifications</h3>
                      
                      {/* RAM Slider */}
                      <div>
                        <div className="flex justify-between items-center text-xs text-slate-300 font-mono mb-2">
                          <span>Allocated Container RAM Memory</span>
                          <span className="font-bold text-indigo-400">{deployRam} MB</span>
                        </div>
                        <input
                          type="range"
                          min="512"
                          max="8192"
                          step="512"
                          value={deployRam}
                          onChange={(e) => setDeployRam(parseInt(e.target.value))}
                          className="w-full accent-indigo-500 bg-slate-800 h-1.5 rounded-full"
                        />
                        <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                          <span>512 MB (Basic)</span>
                          <span>4096 MB (Standard)</span>
                          <span>8192 MB (Enterprise Core)</span>
                        </div>
                      </div>

                      {/* CPU slider */}
                      <div>
                        <div className="flex justify-between items-center text-xs text-slate-300 font-mono mb-2">
                          <span>Virtual CPU Core limit (cgroups allocation)</span>
                          <span className="font-bold text-indigo-400">{deployCpu} Dedicated Core{deployCpu > 1 ? "s" : ""}</span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="8"
                          step="1"
                          value={deployCpu}
                          onChange={(e) => setDeployCpu(parseInt(e.target.value))}
                          className="w-full accent-indigo-500 bg-slate-800 h-1.5 rounded-full"
                        />
                        <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                          <span>1 Core</span>
                          <span>4 Cores</span>
                          <span>8 Cores</span>
                        </div>
                      </div>

                      {/* Storage slider */}
                      <div>
                        <div className="flex justify-between items-center text-xs text-slate-300 font-mono mb-2">
                          <span>Container Storage Quota limit</span>
                          <span className="font-bold text-indigo-400">{deployDisk} GB</span>
                        </div>
                        <input
                          type="range"
                          min="10"
                          max="150"
                          step="10"
                          value={deployDisk}
                          onChange={(e) => setDeployDisk(parseInt(e.target.value))}
                          className="w-full accent-indigo-500 bg-slate-800 h-1.5 rounded-full"
                        />
                        <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                          <span>10 GB Overlay</span>
                          <span>75 GB</span>
                          <span>150 GB Ultra RAID</span>
                        </div>
                      </div>

                      {/* Expiry Slider */}
                      <div>
                        <div className="flex justify-between items-center text-xs text-slate-300 font-mono mb-2">
                          <span>Initial License Allocation Validity</span>
                          <span className="font-bold text-indigo-400">{deployDays} Days</span>
                        </div>
                        <input
                          type="range"
                          min="5"
                          max="90"
                          step="5"
                          value={deployDays}
                          onChange={(e) => setDeployDays(parseInt(e.target.value))}
                          className="w-full accent-indigo-500 bg-slate-800 h-1.5 rounded-full"
                        />
                        <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                          <span>5 Days</span>
                          <span>30 Days (Recommended)</span>
                          <span>90 Days</span>
                        </div>
                      </div>
                    </div>

                    {/* submit button */}
                    <div className="flex justify-end gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => setActiveTab("dashboard")}
                        className="bg-slate-800 hover:bg-slate-700 text-slate-300 transition px-5 py-2.5 rounded-lg text-sm font-medium"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isDeploying}
                        className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white transition px-6 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2 shadow-lg hover:shadow-indigo-500/20 disabled:cursor-not-allowed"
                      >
                        {isDeploying ? (
                          <>
                            <RefreshCw className="h-4 w-4 animate-spin" />
                            Spinning Container up...
                          </>
                        ) : (
                          <>
                            <CheckCircle className="h-4.5 w-4.5" />
                            Deploy Container Node
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </motion.div>
              )}

              {/* TAB 3: Logs */}
              {activeTab === "logs" && (
                <motion.div
                  key="tab-logs"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="bg-slate-900 border border-slate-800/80 rounded-xl p-5 shadow-xl flex flex-col h-[520px]"
                >
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-2">
                      <TerminalIcon className="h-5 w-5 text-emerald-400" />
                      <h2 className="text-base font-bold text-white font-mono">Hypervisor system.log</h2>
                    </div>
                    <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-mono">
                      STREAMING_LIVE
                    </span>
                  </div>

                  <div className="flex-1 bg-black/95 rounded-xl border border-slate-800 p-4 font-mono text-xs overflow-y-auto space-y-2 select-text">
                    {logs.map((log, index) => {
                      let typeColor = "text-slate-400";
                      if (log.includes("[Docker Daemon]")) typeColor = "text-emerald-400";
                      else if (log.includes("[Pterodactyl")) typeColor = "text-cyan-400";
                      else if (log.includes("[tmate Handler]")) typeColor = "text-amber-400";
                      else if (log.includes("[Admin Action]")) typeColor = "text-indigo-400";

                      return (
                        <div key={index} className="flex gap-2 leading-relaxed">
                          <span className="text-slate-600 shrink-0 select-none">[{index + 1}]</span>
                          <span className={`${typeColor}`}>{log}</span>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}

              {/* TAB 4: settings */}
              {activeTab === "settings" && (
                <motion.div
                  key="tab-settings"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="bg-slate-900 border border-slate-800/80 rounded-xl p-6 shadow-xl"
                >
                  <div className="flex items-center gap-2 mb-4">
                    <Settings className="h-5 w-5 text-indigo-400" />
                    <h2 className="text-base font-bold text-white">Administrator Access Configuration</h2>
                  </div>
                  <p className="text-xs text-slate-400 mb-6">
                    Define the primary Discord Admin ID or username. In the simulated environment, messages sent under this user identity will automatically receive administrator privileges (allowing commands like `/create`, `/extend-vps`, `/node-stats`).
                  </p>

                  <form onSubmit={handleSaveConfig} className="space-y-4 max-w-md">
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                        Admin User ID / Username (from .env)
                      </label>
                      <input
                        type="text"
                        required
                        value={adminIdSetting}
                        onChange={(e) => setAdminIdSetting(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-sm outline-none text-white focus:border-indigo-500 transition font-mono"
                      />
                    </div>

                    <div className="flex items-center gap-3 pt-2">
                      <button
                        type="submit"
                        className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition flex items-center gap-1.5"
                      >
                        <CheckCircle className="h-4 w-4" />
                        Apply & Save .env Sync
                      </button>

                      {configSuccess && (
                        <span className="text-xs text-emerald-400 font-mono flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                          Config persisted!
                        </span>
                      )}
                    </div>
                  </form>
                </motion.div>
              )}

            </AnimatePresence>
          </div>

        </div>

        {/* Right Column (Live Discord simulator) */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          
          {/* Discord simulation view */}
          <div className="bg-[#313338] rounded-xl border border-slate-800/80 shadow-2xl overflow-hidden flex flex-col h-[650px]">
            {/* Guild Header */}
            <div className="bg-[#2b2d31] px-4 py-3.5 border-b border-[#1f2023] flex justify-between items-center select-none">
              <div className="flex items-center gap-2">
                <span className="text-slate-400 font-bold font-mono text-xl">#</span>
                <div className="leading-tight">
                  <h3 className="text-sm font-bold text-white font-sans">vps-deployer-logs</h3>
                  <p className="text-[10px] text-slate-400">Interactive Simulation Daemon channel</p>
                </div>
              </div>
              <div className="bg-slate-800 text-slate-300 text-[9px] font-mono px-2 py-0.5 rounded-md font-bold uppercase">
                Mock Bot
              </div>
            </div>

            {/* Message List */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 select-text">
              {messages.map((msg) => {
                const isAdmin = msg.author.isAdmin;
                return (
                  <div key={msg.id} className="flex gap-3 hover:bg-slate-800/10 -mx-4 px-4 py-1.5 rounded transition">
                    <img 
                      src={msg.author.avatar} 
                      alt="Avatar" 
                      className="h-10 w-10 rounded-full bg-slate-700 object-cover mt-0.5 shrink-0"
                      referrerPolicy="no-referrer"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className={`text-xs font-bold font-sans ${isAdmin ? "text-indigo-400" : "text-emerald-400"}`}>
                          {msg.author.username}
                        </span>
                        {isAdmin && (
                          <span className="bg-[#5865f2]/15 text-[#5865f2] text-[9px] px-1 py-0.1 rounded font-bold font-sans">
                            ADMIN
                          </span>
                        )}
                        {msg.author.username.includes("Bot") && (
                          <span className="bg-[#5865f2] text-white text-[9px] px-1 py-0.1 rounded font-bold font-sans">
                            BOT
                          </span>
                        )}
                        <span className="text-[10px] text-slate-500 font-mono">
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      {/* Content parsing */}
                      <p className="text-xs text-slate-200 mt-1 font-sans leading-relaxed whitespace-pre-wrap select-all">
                        {msg.content}
                      </p>

                      {/* Discord Embed Render */}
                      {msg.embeds && msg.embeds.map((embed, i) => (
                        <div 
                          key={i} 
                          className="mt-2.5 max-w-md bg-[#2b2d31] rounded border-l-4 p-3.5 flex flex-col gap-2 font-sans text-xs border-[#5865f2]"
                        >
                          {embed.title && (
                            <h4 className="font-bold text-slate-100 text-sm">
                              {embed.title}
                            </h4>
                          )}
                          {embed.description && (
                            <p className="text-slate-300 text-xs leading-relaxed whitespace-pre-wrap select-all">
                              {embed.description}
                            </p>
                          )}
                          
                          {/* Embed fields */}
                          {embed.fields && embed.fields.length > 0 && (
                            <div className="grid grid-cols-2 gap-3 mt-1 pt-2 border-t border-[#1f2023]/50">
                              {embed.fields.map((field, idx) => (
                                <div key={idx} className={field.inline ? "" : "col-span-2"}>
                                  <span className="text-[10px] text-slate-400 font-bold block select-all">
                                    {field.name}
                                  </span>
                                  <span className="text-slate-200 text-xs font-mono block select-all whitespace-pre-wrap">
                                    {field.value}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Embed footer */}
                          {embed.footer && (
                            <div className="text-[9px] text-slate-400 mt-1 pt-1.5 border-t border-[#1f2023]/30 font-mono select-none">
                              {embed.footer.text}
                            </div>
                          )}
                        </div>
                      ))}

                      {/* Components (buttons, select menus) */}
                      {msg.components && msg.components.map((compRow, rIdx) => (
                        <div key={rIdx} className="flex gap-2 flex-wrap mt-3 select-none">
                          {compRow.components.map((btnOrSel, cIdx) => {
                            if (btnOrSel.type === "button") {
                              let btnColorClass = "bg-[#4e5058] hover:bg-[#6d6f78] text-white";
                              if (btnOrSel.style === "primary") btnColorClass = "bg-[#5865f2] hover:bg-[#4752c4] text-white";
                              if (btnOrSel.style === "success") btnColorClass = "bg-[#248046] hover:bg-[#1a6535] text-white";
                              if (btnOrSel.style === "danger") btnColorClass = "bg-[#da373c] hover:bg-[#a92b2f] text-white";

                              return (
                                <button
                                  key={cIdx}
                                  onClick={() => handleDiscordInteraction(btnOrSel.customId)}
                                  className={`px-3 py-1.5 rounded text-xs font-medium cursor-pointer transition ${btnColorClass}`}
                                >
                                  {btnOrSel.label}
                                </button>
                              );
                            } else if (btnOrSel.type === "select") {
                              return (
                                <select
                                  key={cIdx}
                                  onChange={(e) => handleDiscordInteraction(btnOrSel.customId, e.target.value)}
                                  defaultValue=""
                                  className="bg-[#383a40] text-slate-200 border border-[#1f2023] px-3 py-1.5 rounded text-xs font-sans outline-none focus:border-[#5865f2] cursor-pointer"
                                >
                                  <option value="" disabled>{btnOrSel.placeholder}</option>
                                  {btnOrSel.options.map((opt, oIdx) => (
                                    <option key={oIdx} value={opt.value}>
                                      {opt.label} {opt.description ? `(${opt.description})` : ""}
                                    </option>
                                  ))}
                                </select>
                              );
                            }
                            return null;
                          })}
                        </div>
                      ))}

                    </div>
                  </div>
                );
              })}
              <div ref={chatBottomRef}></div>
            </div>

            {/* Input Bar & Identity Selector */}
            <div className="p-3 bg-[#2b2d31] border-t border-[#1f2023] flex flex-col gap-2">
              
              {/* Sender Select helper */}
              <div className="flex items-center justify-between text-[10px] text-slate-400 select-none">
                <div className="flex items-center gap-1">
                  <span>Talking as:</span>
                  <select 
                    value={chatSender}
                    onChange={(e) => setChatSender(e.target.value)}
                    className="bg-[#1e1f22] text-indigo-400 border border-slate-800/80 rounded px-1.5 py-0.5 outline-none font-bold"
                  >
                    <option value="1165638991668842500">1165638991668842500 (Admin)</option>
                    <option value="krishdeep">krishdeep (Admin)</option>
                    <option value="john_developer">john_developer (User)</option>
                    <option value="guest_guest">guest_guest (User)</option>
                  </select>
                </div>
                <span>Supports markdown & Slash Commands</span>
              </div>

              {/* Chat Text Input bar */}
              <div className="relative">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendDiscordMsg()}
                  placeholder={`Send message to #vps-deployer-logs or type slash commands...`}
                  className="w-full bg-[#383a40] text-white text-xs rounded-lg pl-3 pr-10 py-3 outline-none border border-transparent focus:border-[#5865f2] font-sans"
                />
                <button
                  onClick={() => handleSendDiscordMsg()}
                  className="absolute right-2.5 top-2.5 p-1 text-slate-400 hover:text-white transition cursor-pointer"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>

              {/* Slash Command Quick Helpers */}
              <div className="flex gap-1 overflow-x-auto py-1 text-[10px] select-none no-scrollbar">
                <span className="text-slate-500 shrink-0 self-center">Commands:</span>
                <button 
                  onClick={() => handleSendDiscordMsg("/commands")}
                  className="bg-[#1e1f22] hover:bg-[#383a40] text-slate-300 px-2 py-1 rounded transition text-[9px] shrink-0 font-mono"
                >
                  /commands
                </button>
                <button 
                  onClick={() => handleSendDiscordMsg("/deploy")}
                  className="bg-[#1e1f22] hover:bg-[#383a40] text-slate-300 px-2 py-1 rounded transition text-[9px] shrink-0 font-mono"
                >
                  /deploy
                </button>
                <button 
                  onClick={() => handleSendDiscordMsg("/my-vps")}
                  className="bg-[#1e1f22] hover:bg-[#383a40] text-slate-300 px-2 py-1 rounded transition text-[9px] shrink-0 font-mono"
                >
                  /my-vps
                </button>
                <button 
                  onClick={() => handleSendDiscordMsg("/node-stats")}
                  className="bg-[#1e1f22] hover:bg-[#383a40] text-slate-300 px-2 py-1 rounded transition text-[9px] shrink-0 font-mono"
                >
                  /node-stats
                </button>
                <button 
                  onClick={() => handleSendDiscordMsg("/ptero-status")}
                  className="bg-[#1e1f22] hover:bg-[#383a40] text-slate-300 px-2 py-1 rounded transition text-[9px] shrink-0 font-mono"
                >
                  /ptero-status
                </button>
              </div>

            </div>
          </div>

        </div>

      </main>

      {/* Footer credits info */}
      <footer className="border-t border-slate-900 bg-slate-950 px-6 py-4 text-center text-slate-500 text-xs select-none mt-auto">
        <p>© 2026 NodeSurge cgroups Hypervisor Emulator. Connected to local UNIX docker.sock daemon.</p>
      </footer>
    </div>
  );
}
