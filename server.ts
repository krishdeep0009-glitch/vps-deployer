/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express, { Request, Response } from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { INITIAL_VPS_LIST, INITIAL_NODE_STATS, DEFAULT_APP_CONFIG } from "./src/vpsData";
import { VPSInstance, NodeStats, AppConfig, DiscordMessage, DiscordEmbed } from "./src/types";

const app = express();
const PORT = 3000;

app.use(express.json());

// Path to persist DB
const DB_PATH = path.join(process.cwd(), "db_store.json");

// Core server states
let vpsList: VPSInstance[] = [];
let nodeStats: NodeStats = { ...INITIAL_NODE_STATS };
let appConfig: AppConfig = { ...DEFAULT_APP_CONFIG };
let logs: string[] = [
  "Docker daemon started successfully.",
  "Pterodactyl Wings connector initialized.",
  "Node connected to Pterodactyl Panel at " + DEFAULT_APP_CONFIG.pteroUrl,
  "Discord Bot engine online. Listening for interactions..."
];
let discordMessages: DiscordMessage[] = [
  {
    id: "m0",
    author: { username: "VPS Bot", avatar: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=80&h=80&fit=crop", isAdmin: false },
    content: "👋 Welcome to NodeSurge VPS Controller! Type `/commands` in the chat to see user and admin utilities.",
    timestamp: new Date(Date.now() - 3600000).toISOString()
  }
];

// Load Database from disk if exists
try {
  if (fs.existsSync(DB_PATH)) {
    const raw = fs.readFileSync(DB_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    vpsList = parsed.vpsList || [];
    appConfig = { ...DEFAULT_APP_CONFIG, ...(parsed.appConfig || {}) };
    nodeStats = parsed.nodeStats || { ...INITIAL_NODE_STATS };
    logs = parsed.logs || logs;
  } else {
    vpsList = [...INITIAL_VPS_LIST];
    saveDB();
  }
} catch (e) {
  vpsList = [...INITIAL_VPS_LIST];
  console.error("Error loading database, using memory-store.", e);
}

function saveDB() {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify({ vpsList, appConfig, nodeStats, logs }), "utf-8");
  } catch (e) {
    console.error("Failed to save DB to file.", e);
  }
}

// Generate logs helper
function addLog(message: string) {
  const timestamp = new Date().toLocaleTimeString();
  const logMsg = `[${timestamp}] ${message}`;
  logs.unshift(logMsg);
  if (logs.length > 200) logs.pop();
  saveDB();
}

// Recalculate Node stats based on current VPS states
function recalculateNodeStats() {
  const activeVPS = vpsList.filter(v => v.status === "active");
  const totalCores = activeVPS.reduce((sum, v) => sum + v.cpuLimit, 0);
  const totalMem = activeVPS.reduce((sum, v) => sum + v.memLimit, 0);
  const totalDisk = activeVPS.reduce((sum, v) => sum + v.diskLimit, 0);

  nodeStats.totalContainers = vpsList.length;
  nodeStats.activeAllocatedCpu = totalCores;
  nodeStats.activeAllocatedMem = totalMem;
  nodeStats.activeAllocatedDisk = totalDisk;

  // Add random realistic fluctuation to host usages
  nodeStats.hostCpuUsage = Math.min(95, Math.max(10, 15 + (totalCores * 8) + Math.floor(Math.random() * 10)));
  nodeStats.hostMemUsage = Math.min(nodeStats.hostMemTotal, 4096 + totalMem + Math.floor(Math.random() * 512));
  nodeStats.hostDiskUsage = Math.min(nodeStats.hostDiskTotal, 50 + totalDisk + 22);
  saveDB();
}

// REST API Endpoints

// 1. Configs
app.get("/api/config", (req, res) => {
  res.json(appConfig);
});

app.post("/api/config", (req, res) => {
  appConfig = { ...appConfig, ...req.body };
  addLog(`Configuration updated. Pterodactyl URL synced to ${appConfig.pteroUrl}`);
  saveDB();
  res.json({ success: true, config: appConfig });
});

// 2. Node Stats
app.get("/api/node-stats", (req, res) => {
  recalculateNodeStats();
  res.json(nodeStats);
});

// 3. System Logs
app.get("/api/logs", (req, res) => {
  res.json(logs);
});

// 4. VPS List
app.get("/api/vps", (req, res) => {
  res.json(vpsList);
});

// Create/Deploy VPS API
app.post("/api/vps", (req, res) => {
  const { ownerName, ownerId, os, memLimit, cpuLimit, diskLimit, daysTotal } = req.body;
  
  if (!ownerName || !os || !memLimit || !cpuLimit || !diskLimit) {
    return res.status(400).json({ error: "Missing required VPS parameters." });
  }

  const id = `vps-${os}-${Math.floor(1000 + Math.random() * 9000)}`;
  const password = Math.random().toString(36).slice(-8) + "S!" + Math.floor(Math.random() * 10);
  const tmateSsh = `ssh ${Math.random().toString(36).slice(-8)}@sfo${Math.floor(1 + Math.random() * 3)}.tmate.io`;
  const expiryDate = new Date(Date.now() + (daysTotal || 30) * 24 * 60 * 60 * 1000).toISOString();

  const newVPS: VPSInstance = {
    id,
    ownerName,
    ownerId: ownerId || `user-${Math.floor(100000 + Math.random() * 900000)}`,
    os: os === "ubuntu" ? "ubuntu" : "debian",
    memLimit: parseInt(memLimit),
    cpuLimit: parseInt(cpuLimit),
    diskLimit: parseInt(diskLimit),
    status: "active",
    createdAt: new Date().toISOString(),
    expiryDate,
    daysTotal: daysTotal || 30,
    tmateSSH: tmateSsh,
    rootPassword: password,
    pteroSynced: true,
    pteroServerId: `pt-${Math.random().toString(36).slice(-5)}`
  };

  vpsList.unshift(newVPS);
  addLog(`[Docker Daemon] Successfully created container '${id}' based on jrei/systemd-${os}. limits: RAM=${memLimit}MB, CPU=${cpuLimit} Cores, Disk=${diskLimit}GB`);
  addLog(`[Pterodactyl Panel] Synced container '${id}' creation. Mapping server ID '${newVPS.pteroServerId}' to Wings Node.`);
  addLog(`[tmate Handler] Handshake established. Created active tunnel: ${tmateSsh}`);
  
  recalculateNodeStats();
  saveDB();

  res.status(201).json(newVPS);
});

// Update or Extend VPS
app.put("/api/vps/:id", (req, res) => {
  const { id } = req.params;
  const index = vpsList.findIndex(v => v.id === id);
  if (index === -1) return res.status(404).json({ error: "VPS not found" });

  const { daysToExtend, memLimit, cpuLimit, diskLimit, status } = req.body;
  const vps = vpsList[index];

  if (daysToExtend) {
    const currentExpiry = new Date(vps.expiryDate).getTime();
    vps.expiryDate = new Date(currentExpiry + parseInt(daysToExtend) * 24 * 60 * 60 * 1000).toISOString();
    addLog(`[Admin Action] Extended VPS ${id} validity by ${daysToExtend} days.`);
  }

  if (memLimit) vps.memLimit = parseInt(memLimit);
  if (cpuLimit) vps.cpuLimit = parseInt(cpuLimit);
  if (diskLimit) vps.diskLimit = parseInt(diskLimit);
  if (status) vps.status = status;

  addLog(`[Docker Daemon] Updated resources for ${id} (RAM: ${vps.memLimit}MB, CPU: ${vps.cpuLimit} cores).`);
  addLog(`[Pterodactyl Sync] Pushed updated resource limits for ${id} to Wings API.`);

  vpsList[index] = vps;
  recalculateNodeStats();
  saveDB();
  res.json(vps);
});

// Delete VPS
app.delete("/api/vps/:id", (req, res) => {
  const { id } = req.params;
  const vps = vpsList.find(v => v.id === id);
  if (!vps) return res.status(404).json({ error: "VPS not found" });

  vpsList = vpsList.filter(v => v.id !== id);
  addLog(`[Docker Daemon] Destroyed container '${id}' and cleaned up bind-mounted /proc files.`);
  addLog(`[Pterodactyl Panel] Synced deletions. Removed application instance ID ${vps.pteroServerId}.`);
  addLog(`[tmate Handler] Terminated SSH session for ${id}.`);

  recalculateNodeStats();
  saveDB();
  res.json({ success: true, message: `VPS ${id} successfully removed` });
});

// VPS Power and system control actions
app.post("/api/vps/:id/action", (req, res) => {
  const { id } = req.params;
  const { action } = req.body;
  const index = vpsList.findIndex(v => v.id === id);
  if (index === -1) return res.status(404).json({ error: "VPS not found" });

  const vps = vpsList[index];

  switch (action) {
    case "start":
      vps.status = "active";
      addLog(`[Docker Daemon] Started container ${id}. Running systemd core system init...`);
      addLog(`[tmate Handler] Initialized SSH tunnel for ${id}.`);
      break;
    case "stop":
      vps.status = "stopped";
      addLog(`[Docker Daemon] Stopped container ${id} via SIGTERM. Saved states.`);
      addLog(`[tmate Handler] Tunnel closed for ${id}.`);
      break;
    case "restart":
      vps.status = "active";
      addLog(`[Docker Daemon] Restarting container ${id}... Issuing systemd reboot command.`);
      addLog(`[tmate Handler] Regenerating tmate tunnel key for ${id}...`);
      vps.tmateSSH = `ssh ${Math.random().toString(36).slice(-8)}@sfo${Math.floor(1 + Math.random() * 3)}.tmate.io`;
      break;
    case "reinstall":
      vps.status = "active";
      vps.rootPassword = Math.random().toString(36).slice(-8) + "S!" + Math.floor(Math.random() * 10);
      vps.tmateSSH = `ssh ${Math.random().toString(36).slice(-8)}@sfo${Math.floor(1 + Math.random() * 3)}.tmate.io`;
      addLog(`[Docker Daemon] Wiping root filesystem of ${id}. Deploying pristine jrei/systemd-${vps.os} template.`);
      addLog(`[tmate Handler] Established new terminal tunnel: ${vps.tmateSSH}`);
      break;
    case "regen-ssh":
      vps.tmateSSH = `ssh ${Math.random().toString(36).slice(-8)}@sfo${Math.floor(1 + Math.random() * 3)}.tmate.io`;
      addLog(`[tmate Handler] Regenerating SSH tunnels for ${id} due to client reconnect request.`);
      break;
    case "suspend":
      vps.status = "suspended";
      addLog(`[Pterodactyl Panel] VPS ${id} auto-expired/suspended. Suspending container resource groups.`);
      break;
    case "unsuspend":
      vps.status = "active";
      addLog(`[Pterodactyl Panel] VPS ${id} unsuspended. Unpausing resource groups.`);
      break;
    default:
      return res.status(400).json({ error: "Invalid Action" });
  }

  vpsList[index] = vps;
  recalculateNodeStats();
  saveDB();
  res.json(vps);
});

// Simulated shell console executions for standard interactive commands
app.post("/api/vps/:id/terminal", (req, res) => {
  const { id } = req.params;
  const { command } = req.body;
  const vps = vpsList.find(v => v.id === id);

  if (!vps) return res.status(404).json({ error: "VPS not found" });
  if (vps.status !== "active") {
    return res.json({ output: `\r\n\x1b[31mError: VPS is powered off or suspended. systemctl is offline.\x1b[0m\r\n` });
  }

  const cleanCmd = command.trim();
  let output = "";

  if (cleanCmd === "neofetch") {
    const osCapitalized = vps.os === "ubuntu" ? "Ubuntu 22.04 LTS" : "Debian GNU/Linux 11";
    const osColor = vps.os === "ubuntu" ? "\x1b[33m" : "\x1b[31m";
    const logo = vps.os === "ubuntu" ? 
`   ${osColor}.-/++++-.\x1b[0m            root@${vps.id}
 ${osColor} \`+++++++++++++:\x1b[0m          -------------
 ${osColor} /+++/\`     \`-++++/\x1b[0m         OS: ${osCapitalized} x86_64
 ${osColor}++++/         .+++++\x1b[0m        Kernel: 5.15.0-88-generic
 ${osColor}+++++          +++++\x1b[0m        Uptime: 2 hours, 14 mins
 ${osColor}++++/         .+++++\x1b[0m        Packages: 492 (dpkg)
 ${osColor} /+++/\`     \`-++++/\x1b[0m         Shell: bash 5.1.16
 ${osColor} \`+++++++++++++:\x1b[0m          Terminal: /dev/pts/0 (tmate)
   ${osColor}\`-/++++-.\x1b[0m            CPU: Intel Core i9 VPS Dedicated vCPU (Cgroups Core)
\x1b[0m                             Memory: \x1b[32m128MiB / ${vps.memLimit}MiB (Enforced)\x1b[0m
                             Disk: \x1b[32m2.4GiB / ${vps.diskLimit}GiB\x1b[0m` 
:
`   ${osColor}  _,---._\x1b[0m             root@${vps.id}
 ${osColor}  /  _   _  \\\x1b[0m            -------------
 ${osColor}  | ( \`\`) \`\`) |\x1b[0m           OS: ${osCapitalized} x86_64
 ${osColor}  |  \`--\'--\'  |\x1b[0m           Kernel: 5.15.0-88-generic
 ${osColor}  \\_         _/\x1b[0m           Uptime: 45 mins
 ${osColor}    \`-------'\x1b[0m             Packages: 412 (dpkg)
                             Shell: bash 5.1.16
                             Terminal: /dev/pts/1 (tmate)
                             CPU: Intel Core i9 VPS Dedicated vCPU (Cgroups Core)
                             Memory: \x1b[32m94MiB / ${vps.memLimit}MiB (Enforced)\x1b[0m
                             Disk: \x1b[32m1.8GiB / ${vps.diskLimit}GiB\x1b[0m`;
    output = `\r\n${logo}\r\n`;
  } else if (cleanCmd === "free -h" || cleanCmd === "free") {
    const memTotalStr = (vps.memLimit / 1024).toFixed(1) + "Gi";
    const memUsedStr = "124Mi";
    const memFreeStr = ((vps.memLimit - 124) / 1024).toFixed(1) + "Gi";
    output = `\r\n              total        used        free      shared  buff/cache   available
Mem:          ${memTotalStr}       ${memUsedStr}       ${memFreeStr}        0.0B       112Mi       ${memFreeStr}
Swap:          0.0B        0.0B        0.0B\r\n`;
  } else if (cleanCmd === "htop") {
    // Elegant simulation of htop header reflecting only allocated cores
    const coreBars = Array.from({ length: vps.cpuLimit }).map((_, i) => {
      const idx = i + 1;
      const usageVal = Math.floor(5 + Math.random() * 15);
      const barFilled = Math.floor(usageVal / 4);
      const barStr = "|" + "#".repeat(barFilled) + "-".repeat(25 - barFilled) + "|";
      return `  ${idx} [${barStr} ${usageVal}.0%]`;
    });

    const memPercent = Math.floor((124 / vps.memLimit) * 100);
    const memBarFilled = Math.floor(memPercent / 4);
    const memBar = "[" + "#".repeat(memBarFilled) + "-".repeat(25 - memBarFilled) + "]";

    output = `\r\n\x1b[32m${coreBars.slice(0, 2).join("    ")}\x1b[0m
\x1b[32m${coreBars.slice(2, 4).join("    ")}\x1b[0m
  Mem[${memBar} ${124}M/${vps.memLimit}M]
  Swp[------------------------- 0K/0K]

\x1b[34m  PID USER      PRI  NI  VIRT   RES   SHR S CPU% MEM%   TIME+  Command\x1b[0m
    1 root       20   0 15984  9212  4232 S  0.0  0.4  0:02.14 /lib/systemd/systemd
  122 root       20   0  3240  1024   492 S  0.0  0.0  0:00.05 /usr/sbin/sshd -D
  145 root       20   0  2100   940   212 S  0.3  0.0  0:04.10 tmate -F
  180 root       20   0 12500  4210  1200 R  1.2  0.2  0:00.12 htop
\x1b[33m[Use Ctrl+C to exit htop simulation]\x1b[0m\r\n`;
  } else if (cleanCmd === "systemctl status" || cleanCmd.startsWith("systemctl status")) {
    const service = cleanCmd.split(" ")[2] || "all";
    if (service === "all" || service === "") {
      output = `\r\n● ${vps.id}
    State: \x1b[32mrunning\x1b[0m
    Jobs: 0 queued
    Failed: 0 units
    Since: Fri 2026-07-10 04:12:00 UTC; 45min ago\r\n`;
    } else {
      output = `\r\n● ${service}.service - System Service Daemon
   Loaded: loaded (/lib/systemd/system/${service}.service; enabled; vendor preset: enabled)
   Active: \x1b[32mactive (running)\x1b[0m since Fri 2026-07-10 04:12:05 UTC; 45min ago
 Main PID: ${Math.floor(100 + Math.random() * 200)} (${service})
    Tasks: 2 (limit: 4915)
   CGroup: /docker/containers/${vps.id}/${service}.service\r\n`;
    }
  } else if (cleanCmd === "df -h") {
    output = `\r\nFilesystem      Size  Used Avail Use% Mounted on
overlay          ${vps.diskLimit}G  1.4G  ${vps.diskLimit - 2}G   5% /
tmpfs            64M     0   64M   0% /dev
shm              64M     0   64M   0% /dev/shm
tmpfs           2.0G     0  2.0G   0% /sys/fs/cgroup\r\n`;
  } else if (cleanCmd === "clear") {
    output = "CLEAR";
  } else if (cleanCmd === "") {
    output = "";
  } else if (cleanCmd === "help") {
    output = `\r\nAvailable VPS Simulated commands:
 - \x1b[36mneofetch\x1b[0m    : View system configuration, kernel, and specs
 - \x1b[36mfree -h\x1b[0m     : Displays RAM cgroup resource usage
 - \x1b[36mhtop\x1b[0m        : Interactive system resource monitor
 - \x1b[36mdf -h\x1b[0m       : View disk space limitations
 - \x1b[36msystemctl\x1b[0m   : Inspect Ubuntu/Debian systemctl unit statuses
 - \x1b[36mclear\x1b[0m       : Clear terminal viewport\r\n`;
  } else {
    output = `\r\nroot@${vps.id}:~# ${cleanCmd}: command not found. Type 'help' for a list of simulated commands.\r\n`;
  }

  res.json({ output });
});


// 5. Discord Chat Simulator API
app.get("/api/discord/messages", (req, res) => {
  res.json(discordMessages);
});

// Process a Discord Slash Command interactively
app.post("/api/discord/messages", (req, res) => {
  const { sender, content, isAdmin } = req.body;
  if (!sender || !content) return res.status(400).json({ error: "Missing parameters" });

  const adminId = process.env.ADMIN_USER_ID || "1165638991668842500";
  const userIsAdmin = !!isAdmin || sender.toLowerCase() === adminId.toLowerCase() || sender.toLowerCase() === "krishdeep" || sender === "1165638991668842500";

  const isCommand = content.startsWith("/");
  const userMsgId = `m-${Math.random().toString(36).slice(-5)}`;
  
  // User command message
  const userMsg: DiscordMessage = {
    id: userMsgId,
    author: {
      username: sender,
      avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&h=80&fit=crop",
      isAdmin: userIsAdmin
    },
    content,
    timestamp: new Date().toISOString()
  };

  discordMessages.push(userMsg);

  // Generate bot response
  setTimeout(() => {
    const responseEmbeds: DiscordEmbed[] = [];
    let responseContent = "";
    let actionButtons: any = null;

    if (isCommand) {
      const parts = content.split(" ");
      const cmdName = parts[0];

      if (cmdName === "/commands") {
        responseEmbeds.push({
          title: "🤖 Discord VPS Deployer Command Index",
          description: "Full guide on deploying VPS instances via Discord with exact RAM, CPU, and Disk allocations.",
          color: "#3b82f6",
          fields: [
            {
              name: "👤 User Utilities",
              value: "`/my-vps` - View your active servers & SSH keys\n`/start <id>` - Boot container\n`/stop <id>` - Halt container\n`/restart <id>` - Hard reboot systemd\n`/reinstall <id>` - Full OS rebuild\n`/regen-ssh <id>` - Refresh tmate tunneling SSH link\n`/vps-performance <id>` - Query CPU, RAM, Disk allocation"
            },
            {
              name: "🛡️ Administrative Controls",
              value: "`/deploy <user>` - Interactive OS buttons panel deploy\n`/create <user> <mem> <cpu> <disk> <os> <days>` - Immediate VPS provisioning\n`/extend-vps <id> <days>` - Add time to VPS expiry\n`/suspend-vps <id>` - Suspend container & sync Pterodactyl\n`/unsuspend-vps <id>` - Reactivate suspension\n`/remove-vps <id>` - Wipes container & sync Panel\n`/fix-vps <id>` - Force destroys zombies\n`/node-stats` - Query hypervisor statistics\n`/ptero-status` - Query Pterodactyl wings status"
            }
          ],
          footer: { text: "VPS Deployer Engine v1.2" }
        });
      }
      
      else if (cmdName === "/deploy") {
        // Multi-step buttons deploy sequence
        const targetUser = parts[1] || (adminId.startsWith("@") ? adminId : `@${adminId}`);
        responseContent = `🛡️ **Admin VPS Deployer Panel** initiated for **${targetUser}**.\n*Please select the target Operating System below:*`;
        
        actionButtons = {
          type: "action_row",
          components: [
            { type: "button", style: "primary", label: "Ubuntu 22.04 LTS (systemd)", customId: `os_ubuntu_${targetUser}` },
            { type: "button", style: "secondary", label: "Debian 11 (systemd)", customId: `os_debian_${targetUser}` }
          ]
        };
      }
      
      else if (cmdName === "/my-vps") {
        const owned = vpsList.filter(v => v.ownerName.toLowerCase() === sender.toLowerCase() || v.ownerName.toLowerCase() === adminId.toLowerCase() || v.ownerName.toLowerCase() === "krishdeep");
        if (owned.length === 0) {
          responseContent = "❌ **You do not currently own any active VPS instances.** Admin users can deploy one using `/deploy`.";
        } else {
          responseEmbeds.push({
            title: `💻 Active VPS Servers for ${sender}`,
            description: "Here are your running containers. Full credentials have been sent via Secure DM.",
            color: "#10b981",
            fields: owned.map(v => ({
              name: `🖥️ ${v.id.toUpperCase()} (${v.os === "ubuntu" ? "Ubuntu" : "Debian"})`,
              value: `• **Status:** \`${v.status.toUpperCase()}\`\n• **Limits:** \`${v.cpuLimit} Core, ${v.memLimit}MB RAM, ${v.diskLimit}GB Disk\`\n• **Valid:** \`${Math.max(0, Math.ceil((new Date(v.expiryDate).getTime() - Date.now()) / (1000*60*60*24)))} Days remaining\`\n• **SSH (tmate):** \`${v.tmateSSH}\``,
              inline: false
            }))
          });
        }
      }
      
      else if (cmdName === "/create") {
        if (!userIsAdmin) {
          responseContent = "❌ **Access Denied:** Administrator privilege is required to execute `/create`.";
        } else {
          // Parse: /create <user> <mem> <cpu> <disk> <os> <days>
          const userParam = parts[1] || "@user";
          const memParam = parseInt(parts[2]) || 2048;
          const cpuParam = parseInt(parts[3]) || 2;
          const diskParam = parseInt(parts[4]) || 20;
          const osParam = (parts[5] || "ubuntu").toLowerCase();
          const daysParam = parseInt(parts[6]) || 30;

          const id = `vps-${osParam}-${Math.floor(1000 + Math.random() * 9000)}`;
          const password = Math.random().toString(36).slice(-8) + "S!";
          const tmateSsh = `ssh ${Math.random().toString(36).slice(-8)}@sfo2.tmate.io`;
          const expiryDate = new Date(Date.now() + daysParam * 24 * 60 * 60 * 1000).toISOString();

          const newVPS: VPSInstance = {
            id,
            ownerName: userParam.replace("@", ""),
            ownerId: `discord-${Math.floor(100000 + Math.random() * 900000)}`,
            os: osParam === "debian" ? "debian" : "ubuntu",
            memLimit: memParam,
            cpuLimit: cpuParam,
            diskLimit: diskParam,
            status: "active",
            createdAt: new Date().toISOString(),
            expiryDate,
            daysTotal: daysParam,
            tmateSSH: tmateSsh,
            rootPassword: password,
            pteroSynced: true,
            pteroServerId: `pt-${Math.random().toString(36).slice(-5)}`
          };

          vpsList.unshift(newVPS);
          addLog(`[Discord Bot] Executed /create for ${userParam}. Container ${id} deployed.`);
          recalculateNodeStats();
          saveDB();

          responseEmbeds.push({
            title: `🚀 VPS Deploy Success!`,
            description: `The VPS Container has been successfully created for **${userParam}** and synced with Pterodactyl.`,
            color: "#10b981",
            fields: [
              { name: "VPS ID", value: `\`${id}\``, inline: true },
              { name: "OS Type", value: `\`${osParam.toUpperCase()}\``, inline: true },
              { name: "Resource limits", value: `\`${cpuParam} CPU Cores, ${memParam}MB RAM, ${diskParam}GB Disk\``, inline: false },
              { name: "Auto Expiry", value: `\`${daysParam} Days (${new Date(expiryDate).toLocaleDateString()})\``, inline: true },
              { name: "Pterodactyl Status", value: `\`ACTIVE (Server: ${newVPS.pteroServerId})\``, inline: true }
            ],
            footer: { text: "🔑 Full credentials and SSH keys sent directly via DM." }
          });

          // DM simulation message
          setTimeout(() => {
            discordMessages.push({
              id: `dm-${Date.now()}`,
              author: { username: "VPS Bot [DM]", avatar: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=80&h=80&fit=crop", isAdmin: false },
              content: `🔑 **Private Server Credentials for ${id}**\n\n• **OS:** \`${osParam.toUpperCase()} systemd (Cgroups Enforced)\`\n• **SSH Terminal:** \`${tmateSsh}\`\n• **User:** \`root\`\n• **Password:** \`${password}\`\n• **Limits:** CPU quota: \`${cpuParam} Cores\`, Memory: \`${memParam} MB\`, Disk: \`${diskParam} GB\`\n\n*Use tmate command client to connect. systemctl works fully in Ubuntu/Debian containers!*`,
              timestamp: new Date().toISOString(),
              isDM: true
            });
          }, 1000);
        }
      }
      
      else if (cmdName === "/start" || cmdName === "/stop" || cmdName === "/restart" || cmdName === "/regen-ssh" || cmdName === "/vps-performance") {
        const targetId = parts[1];
        if (!targetId) {
          responseContent = `❌ Please provide a VPS ID. Usage: \`${cmdName} <vps_id>\``;
        } else {
          const index = vpsList.findIndex(v => v.id === targetId);
          if (index === -1) {
            responseContent = `❌ VPS ID \`${targetId}\` not found in registry.`;
          } else {
            const vps = vpsList[index];
            if (cmdName === "/start") {
              vps.status = "active";
              responseContent = `✅ **VPS ${targetId}** container has been started. systemd initialized.`;
              addLog(`[Discord Bot] Handled /start for VPS ${targetId}.`);
            } else if (cmdName === "/stop") {
              vps.status = "stopped";
              responseContent = `🔌 **VPS ${targetId}** container stopped safely.`;
              addLog(`[Discord Bot] Handled /stop for VPS ${targetId}.`);
            } else if (cmdName === "/restart") {
              vps.status = "active";
              vps.tmateSSH = `ssh ${Math.random().toString(36).slice(-8)}@sfo2.tmate.io`;
              responseContent = `🔄 **VPS ${targetId}** hard reboot issued. Fresh tmate SSH key established.`;
              addLog(`[Discord Bot] Handled /restart for VPS ${targetId}.`);
            } else if (cmdName === "/regen-ssh") {
              vps.tmateSSH = `ssh ${Math.random().toString(36).slice(-8)}@sfo3.tmate.io`;
              responseContent = `🔑 Fresh SSH key generated for **VPS ${targetId}**:\n\`${vps.tmateSSH}\``;
              addLog(`[Discord Bot] Handled /regen-ssh for VPS ${targetId}.`);
            } else if (cmdName === "/vps-performance") {
              const cpuUsage = vps.status === "active" ? Math.floor(10 + Math.random() * 40) : 0;
              const memUsage = vps.status === "active" ? Math.floor(64 + Math.random() * 128) : 0;
              responseEmbeds.push({
                title: `📈 Performance Query for ${vps.id}`,
                color: "#10b981",
                fields: [
                  { name: "CPU Utilization", value: `\`${cpuUsage}% / 100% of ${vps.cpuLimit} Core(s)\``, inline: true },
                  { name: "Memory Allocated", value: `\`${memUsage}MB / ${vps.memLimit}MB\``, inline: true },
                  { name: "Storage Allocation", value: `\`1.4GB / ${vps.diskLimit}GB (Overlay)\``, inline: false },
                  { name: "Hypervisor Cgroups Node", value: "`Docker Engine - Wings-01`" },
                  { name: "Pterodactyl Status", value: "`HEALTHY / SYNCED`" }
                ],
                footer: { text: "Data refreshed instantly via bind-mounted proc limits." }
              });
            }
            recalculateNodeStats();
            saveDB();
          }
        }
      }
      
      else if (cmdName === "/node-stats") {
        if (!userIsAdmin) {
          responseContent = "❌ **Access Denied:** Admin only command.";
        } else {
          recalculateNodeStats();
          responseEmbeds.push({
            title: "📊 Hypervisor Node Status & Resource Pool",
            description: "Overall real-time cgroup allocation and memory mapping.",
            color: "#6366f1",
            fields: [
              { name: "Wings Host IP", value: `\`${appConfig.hostIpAddress}\``, inline: true },
              { name: "Wings Connector Status", value: `\`🟢 CONNECTED (Wings daemon v1.11.3)\``, inline: true },
              { name: "CPU Load (Allocated)", value: `\`${nodeStats.hostCpuUsage}% (${nodeStats.activeAllocatedCpu} Cores assigned)\``, inline: false },
              { name: "RAM Utilization (Allocated)", value: `\`${nodeStats.hostMemUsage}MB / ${nodeStats.hostMemTotal}MB (${nodeStats.activeAllocatedMem}MB assigned)\``, inline: false },
              { name: "Disk Space (Allocated)", value: `\`${nodeStats.hostDiskUsage}GB / ${nodeStats.hostDiskTotal}GB (${nodeStats.activeAllocatedDisk}GB assigned)\``, inline: false },
              { name: "Active Docker VPS Count", value: `\`${nodeStats.totalContainers} Systemd Containers running\``, inline: true }
            ],
            footer: { text: "Wings telemetry reports every 5s" }
          });
        }
      }

      else if (cmdName === "/ptero-status") {
        responseEmbeds.push({
          title: "🎮 Pterodactyl Panel Sync Report",
          description: "Sync integrity checks across application and client API routes.",
          color: "#9333ea",
          fields: [
            { name: "Pterodactyl Panel Link", value: `\`${appConfig.pteroUrl}\`` },
            { name: "API Authentication Status", value: "`🟢 authenticated (Bearer tokens checked)`" },
            { name: "Wings WebSocket Stream", value: "`🟢 connected`" },
            { name: "Database Desynchronization Failures", value: "`0 server mismatches detected`" }
          ],
          footer: { text: "Panel sync loop running normally" }
        });
      }

      else {
        responseContent = `❌ Unknown slash command \`${cmdName}\`. Type \`/commands\` to see list of valid endpoints.`;
      }
    } else {
      // Natural chat simulation helper replies
      const text = content.toLowerCase();
      if (text.includes("hello") || text.includes("hi")) {
        responseContent = `Hello ${sender}! How can I assist with your systemd containers today? Type \`/commands\` to get started.`;
      } else {
        responseContent = `I received your note: "${content}". Type a slash command (like \`/commands\`) to control the VPS nodes.`;
      }
    }

    const botReply: DiscordMessage = {
      id: `bot-${Math.random().toString(36).slice(-5)}`,
      author: {
        username: "VPS Bot",
        avatar: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=80&h=80&fit=crop",
        isAdmin: false
      },
      content: responseContent,
      timestamp: new Date().toISOString(),
      embeds: responseEmbeds.length > 0 ? responseEmbeds : undefined,
      components: actionButtons ? [actionButtons] : undefined
    };

    discordMessages.push(botReply);
    saveDB();
  }, 800);

  res.json(userMsg);
});

// Post action buttons triggers
app.post("/api/discord/button-click", (req, res) => {
  const { customId, sender } = req.body;
  if (!customId) return res.status(400).json({ error: "Missing button action ID." });

  const msgId = `m-${Math.random().toString(36).slice(-5)}`;
  
  // OS select buttons trigger
  if (customId.startsWith("os_")) {
    const parts = customId.split("_");
    const osSelected = parts[1]; // ubuntu or debian
    const targetUser = parts[2] || "@krishdeep";

    // Simulate next step: CPU buttons
    const botReply: DiscordMessage = {
      id: `bot-${Math.random().toString(36).slice(-5)}`,
      author: { username: "VPS Bot", avatar: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=80&h=80&fit=crop", isAdmin: false },
      content: `📦 **Selected Operating System:** \`${osSelected.toUpperCase()} (systemd)\` for **${targetUser}**.\n*Step 2 of 3: Please select CPU/RAM limits for the VPS cgroups:*`,
      timestamp: new Date().toISOString(),
      components: [
        {
          type: "action_row",
          components: [
            { type: "button", style: "primary", label: "Bronze (1 CPU / 1GB RAM / 15GB Disk)", customId: `spec_bronze_${osSelected}_${targetUser}` },
            { type: "button", style: "success", label: "Silver (2 CPU / 2GB RAM / 25GB Disk)", customId: `spec_silver_${osSelected}_${targetUser}` },
            { type: "button", style: "danger", label: "Gold (4 CPU / 4GB RAM / 50GB Disk)", customId: `spec_gold_${osSelected}_${targetUser}` }
          ]
        }
      ]
    };

    discordMessages.push(botReply);
    saveDB();
    return res.json({ success: true });
  }

  // Spec select buttons trigger -> launches modal simulated prompt
  if (customId.startsWith("spec_")) {
    const parts = customId.split("_");
    const plan = parts[1]; // bronze, silver, gold
    const os = parts[2];
    const targetUser = parts[3];

    let ram = 1024, cpu = 1, disk = 15;
    if (plan === "silver") { ram = 2048; cpu = 2; disk = 25; }
    if (plan === "gold") { ram = 4096; cpu = 4; disk = 50; }

    const botReply: DiscordMessage = {
      id: `bot-${Math.random().toString(36).slice(-5)}`,
      author: { username: "VPS Bot", avatar: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=80&h=80&fit=crop", isAdmin: false },
      content: `⚙️ **Finalizing VPS specs...**\n- **OS:** \`${os.toUpperCase()}\`\n- **RAM:** \`${ram}MB\`\n- **CPU:** \`${cpu} Core(s)\`\n- **Disk:** \`${disk}GB\`\n- **Target User:** \`${targetUser}\`\n\n*Click "Deploy Now" below to provision the cgroup containers instantly and sync with Pterodactyl Wings:*`,
      timestamp: new Date().toISOString(),
      components: [
        {
          type: "action_row",
          components: [
            { type: "button", style: "success", label: "🚀 Deploy Now!", customId: `confirm_deploy_${os}_${ram}_${cpu}_${disk}_${targetUser}` }
          ]
        }
      ]
    };

    discordMessages.push(botReply);
    saveDB();
    return res.json({ success: true });
  }

  // Confirm deploy button trigger
  if (customId.startsWith("confirm_deploy_")) {
    const parts = customId.split("_");
    const os = parts[2];
    const ram = parseInt(parts[3]);
    const cpu = parseInt(parts[4]);
    const disk = parseInt(parts[5]);
    const targetUser = parts[6];

    const id = `vps-${os}-${Math.floor(1000 + Math.random() * 9000)}`;
    const password = Math.random().toString(36).slice(-8) + "S!7";
    const tmateSsh = `ssh ${Math.random().toString(36).slice(-8)}@sgp1.tmate.io`;
    const expiryDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const newVPS: VPSInstance = {
      id,
      ownerName: targetUser.replace("@", ""),
      ownerId: `discord-${Math.floor(100000 + Math.random() * 900000)}`,
      os: os === "debian" ? "debian" : "ubuntu",
      memLimit: ram,
      cpuLimit: cpu,
      diskLimit: disk,
      status: "active",
      createdAt: new Date().toISOString(),
      expiryDate,
      daysTotal: 30,
      tmateSSH: tmateSsh,
      rootPassword: password,
      pteroSynced: true,
      pteroServerId: `pt-${Math.random().toString(36).slice(-5)}`
    };

    vpsList.unshift(newVPS);
    addLog(`[Discord Bot] Handled OS selection deploy for ${targetUser}. VPS ${id} successfully loaded.`);
    recalculateNodeStats();
    saveDB();

    const botReply: DiscordMessage = {
      id: `bot-${Math.random().toString(36).slice(-5)}`,
      author: { username: "VPS Bot", avatar: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=80&h=80&fit=crop", isAdmin: false },
      content: `🎉 **Successfully provisioned Container!**\nVPS \`${id}\` is now online and synced. SSH login has been sent to **${targetUser}**'s Discord DM inbox!`,
      timestamp: new Date().toISOString(),
      embeds: [
        {
          title: "💻 VPS Container Online",
          description: `Resource allocated safely on Node: \`Wings-01\``,
          color: "#10b981",
          fields: [
            { name: "OS Template", value: `\`jrei/systemd-${os}:latest\``, inline: true },
            { name: "Memory Limit", value: `\`${ram}MB\``, inline: true },
            { name: "CPU Limit", value: `\`${cpu} Dedicated cores (Cgroups quota)\``, inline: false },
            { name: "Storage Size", value: `\`${disk}GB Overlayfs\``, inline: true },
            { name: "Expiry Period", value: "`30 Days (Renewable)`", inline: true }
          ]
        }
      ]
    };

    discordMessages.push(botReply);

    // Private DM message simulation
    setTimeout(() => {
      discordMessages.push({
        id: `dm-${Date.now()}`,
        author: { username: "VPS Bot [DM]", avatar: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=80&h=80&fit=crop", isAdmin: false },
        content: `🔑 **Private Server Credentials for ${id}**\n\n• **OS:** \`${os.toUpperCase()} systemd (Cgroups Enforced)\`\n• **SSH Terminal:** \`${tmateSsh}\`\n• **User:** \`root\`\n• **Password:** \`${password}\`\n• **Limits:** CPU quota: \`${cpu} Cores\`, Memory: \`${ram} MB\`, Disk: \`${disk} GB\`\n\n*Use tmate command client to connect. systemctl works fully in Ubuntu/Debian containers!*`,
        timestamp: new Date().toISOString(),
        isDM: true
      });
    }, 1000);

    saveDB();
    return res.json({ success: true });
  }

  res.status(400).json({ error: "Invalid button click" });
});


// Serve static Vite build or start Vite Server

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
