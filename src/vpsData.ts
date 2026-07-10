import { VPSInstance, NodeStats, AppConfig } from "./types";

export interface OSTemplate {
  id: "ubuntu" | "debian";
  name: string;
  version: string;
  logo: string;
  color: string;
}

export interface SpecTier {
  id: string;
  name: string;
  cpu: number;
  ram: number; // MB
  disk: number; // GB
  price: string;
  badge: string;
}

export const SUPPORTED_OS: OSTemplate[] = [
  {
    id: "ubuntu",
    name: "Ubuntu",
    version: "22.04 LTS",
    logo: "https://assets.ubuntu.com/v1/82818828-logo-ubuntu-orange.svg",
    color: "from-orange-500 to-red-600",
  },
  {
    id: "debian",
    name: "Debian",
    version: "12 Bookworm",
    logo: "https://www.debian.org/logos/openlogo-100.png",
    color: "from-red-500 to-rose-600",
  },
];

export const SPEC_TIERS: SpecTier[] = [
  {
    id: "starter",
    name: "Micro VPS",
    cpu: 1,
    ram: 1024,
    disk: 15,
    price: "Free",
    badge: "Basic",
  },
  {
    id: "standard",
    name: "Standard VPS",
    cpu: 2,
    ram: 2048,
    disk: 30,
    price: "1000 CR",
    badge: "Popular",
  },
  {
    id: "pro",
    name: "Pro Developer",
    cpu: 4,
    ram: 4096,
    disk: 60,
    price: "2500 CR",
    badge: "High Performance",
  },
  {
    id: "beast",
    name: "Extreme Node",
    cpu: 8,
    ram: 8192,
    disk: 120,
    price: "5000 CR",
    badge: "Ultra Core",
  },
];

export const INITIAL_VPS_LIST: VPSInstance[] = [
  {
    id: "vps-ubuntu-92b1",
    ownerName: "krishdeep",
    ownerId: "246813579101",
    os: "ubuntu",
    memLimit: 2048,
    cpuLimit: 2,
    diskLimit: 30,
    status: "active",
    createdAt: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
    expiryDate: new Date(Date.now() + 27 * 24 * 3600 * 1000).toISOString(),
    daysTotal: 30,
    tmateSSH: "ssh tmate-user-xyz123@ssh.tmate.io",
    rootPassword: "UbuntuSecurePass92!",
    pteroSynced: true,
    pteroServerId: "pt-8bf21",
  },
  {
    id: "vps-debian-44c9",
    ownerName: "moderator_john",
    ownerId: "987654321098",
    os: "debian",
    memLimit: 4096,
    cpuLimit: 4,
    diskLimit: 60,
    status: "stopped",
    createdAt: new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString(),
    expiryDate: new Date(Date.now() + 20 * 24 * 3600 * 1000).toISOString(),
    daysTotal: 30,
    tmateSSH: "ssh tmate-user-deb44@ssh.tmate.io",
    rootPassword: "DebianSafePass44?",
    pteroSynced: true,
    pteroServerId: "pt-44c9a",
  },
];

export const INITIAL_NODE_STATS: NodeStats = {
  hostCpuUsage: 12,
  hostMemUsage: 2048,
  hostMemTotal: 16384,
  hostDiskUsage: 45,
  hostDiskTotal: 500,
  totalContainers: 2,
  wingsStatus: "connected",
  pteroApiStatus: "online",
  activeAllocatedCpu: 6,
  activeAllocatedMem: 6144,
  activeAllocatedDisk: 90,
};

export const DEFAULT_APP_CONFIG: AppConfig = {
  discordToken: "MTIzeW91cl9kaXNjb3JkX2JvdF90b2tlbl9nZW5lcmF0ZWRfaGVyZQ==",
  clientId: "123456789012345678",
  guildId: "987654321098765432",
  pteroUrl: "https://panel.nodesurge.com",
  pteroApiKey: "ptlc_Ym90X2RlcGxveWVyX2tleV9nZW5lcmljX3BzZXVkby1hcGk=",
  vpsDefaultDays: 30,
  hostIpAddress: "135.181.92.14",
  adminUserId: "1165638991668842500"
};

