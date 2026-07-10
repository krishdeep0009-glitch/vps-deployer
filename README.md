# Discord VPS Deployer & Dashboard

A professional full-stack platform consisting of a high-performance Discord Bot and a web-based administration dashboard. The system simulates and provisions containerized virtual private servers (VPS) with Pterodactyl Panel and Wings synchronization, leveraging systemd-enabled Ubuntu/Debian templates to provide full `systemctl` support and secure cgroup limit enforcement.

---

## 📋 Features

- **Dynamic Hypervisor Monitoring**: Real-time Node performance stats, CPU core allocation, memory pooling, and virtual disk quotas.
- **Systemd Container Control**: Provision virtual private servers using custom-built base images with full system-level services (`systemctl`, `service`).
- **Pterodactyl Integration**: Automatic synchronization of instances, suspensions, and state updates with Pterodactyl Panel.
- **Interactive Discord Interface**: Feature-rich slash commands for users and administrators including multi-step visual button installers.
- **Embedded Web Console**: Administrative dashboard to inspect resource graphs, process real-time logs, and manually override server settings.

---

## 🛠️ Quick Start & Installation

### Prerequisite Checklist
- **Node.js**: v18.0.0 or higher
- **Python**: v3.8 or higher (for the standalone bot client)
- **Docker**: Operational daemon with `/var/run/docker.sock` access

### 1. Clone the Repository
Clone the codebase and navigate into the root directory:
```bash
git clone <your-repository-url>
cd discord-vps-deployer
```

### 2. Configure Environment Variables
Copy the template configuration file to create your local `.env`:
```bash
cp .env.example .env
```

Define the following parameters inside your `.env` file:
```env
# AI Integration
GEMINI_API_KEY="YOUR_GEMINI_API_KEY"

# Web Dashboard Configuration
APP_URL="http://localhost:3000"

# Discord Credentials
DISCORD_TOKEN="YOUR_DISCORD_BOT_TOKEN"

# Pterodactyl Panel API Settings
PTERO_URL="https://panel.yourdomain.com"
PTERO_API_KEY="ptlc_YOUR_PTERODACTYL_APPLICATION_KEY"

# Access Control
ADMIN_USER_ID="krishdeep"
```

---

## 🖥️ Web Dashboard & API Server

The web client is built with React, Vite, and Tailwind CSS, coupled with an Express backend proxy.

### Install Node.js Dependencies
```bash
npm install
```

### Start Development Server
```bash
npm run dev
```
The interface and full-stack API server will start on port `3000` at [http://localhost:3000](http://localhost:3000).

### Production Compilation
```bash
npm run build
npm start
```

---

## 🤖 Python Discord Bot Setup

The Discord Bot component controls cgroup parameters, manages systemd-enabled containers, generates secure tunnels, and relays container status.

### Install Python Dependencies
Ensure your Python environment has the necessary package hooks:
```bash
pip install discord.py docker aiohttp asyncio
```

### Execute the Daemon
```bash
python bot.py
```

---

## 🌳 Discord Command Directory

### User Command Set

| Command | Arguments | Description |
| :--- | :--- | :--- |
| `/my-vps` | None | Lists your active virtual servers and retrieves secure SSH connection links. |
| `/start` | `<vps_id>` | Powers on a stopped VPS instance. |
| `/stop` | `<vps_id>` | Halts the target container safely. |
| `/restart` | `<vps_id>` | Executes a graceful systemd system reboot. |
| `/reinstall` | `<vps_id>` | Wipes container state and reinstalls the base operating system template. |
| `/regen-ssh` | `<vps_id>` | Generates a fresh secure tunneling session. |
| `/vps-performance` | `<vps_id>` | Displays real-time CPU and Memory telemetry from cgroup statistics. |
| `/commands` | None | Outputs a directory of all available user commands. |

### Administrator Command Set (Restricted to `ADMIN_USER_ID`)

| Command | Arguments | Description |
| :--- | :--- | :--- |
| `/deploy` | `<user>` | Launches the interactive multi-step wizard (OS choice ➔ Specs ➔ Build). |
| `/create` | `<user> <mem> <cpu> <disk> <os> <days>` | Instantly provisions a custom VPS using manual parameters. |
| `/extend-vps` | `<vps_id> <days>` | Extends the expiration date and active duration of the server license. |
| `/suspend-vps` | `<vps_id>` | Temporarily suspends the container and disables login access. |
| `/unsuspend-vps`| `<vps_id>` | Restores active container operations. |
| `/remove-vps` | `<vps_id>` | Permanently terminates and purges the VPS container. |
| `/fix-vps` | `<vps_id>` | Forcefully cleans up zombie or unresponsive Docker containers. |
| `/node-stats` | None | Displays overall pool allocations, memory constraints, and core usage. |
| `/ptero-status` | None | Validates connection states for Pterodactyl Panel and Wings node endpoints. |
