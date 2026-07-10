/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface VPSInstance {
  id: string;
  ownerName: string;
  ownerId: string; // Discord ID
  os: "ubuntu" | "debian";
  memLimit: number; // in MB
  cpuLimit: number; // in cores
  diskLimit: number; // in GB
  status: "active" | "stopped" | "suspended";
  createdAt: string;
  expiryDate: string;
  daysTotal: number;
  tmateSSH: string;
  rootPassword: string;
  pteroSynced: boolean;
  pteroServerId: string;
}

export interface DiscordMessage {
  id: string;
  author: {
    username: string;
    avatar: string;
    isAdmin: boolean;
  };
  content: string;
  timestamp: string;
  embeds?: DiscordEmbed[];
  components?: DiscordComponent[];
  isDM?: boolean;
}

export interface DiscordEmbed {
  title?: string;
  description?: string;
  color?: string; // Hex color
  fields?: { name: string; value: string; inline?: boolean }[];
  footer?: { text: string };
  author?: { name: string; icon_url?: string };
}

export interface DiscordComponent {
  type: "action_row";
  components: (DiscordButton | DiscordSelect)[];
}

export interface DiscordButton {
  type: "button";
  style: "primary" | "secondary" | "success" | "danger" | "link";
  label: string;
  customId: string;
  disabled?: boolean;
  url?: string;
}

export interface DiscordSelect {
  type: "select";
  customId: string;
  placeholder: string;
  options: { label: string; value: string; description?: string }[];
}

export interface NodeStats {
  hostCpuUsage: number;
  hostMemUsage: number; // MB
  hostMemTotal: number; // MB
  hostDiskUsage: number; // GB
  hostDiskTotal: number; // GB
  totalContainers: number;
  wingsStatus: "connected" | "disconnected";
  pteroApiStatus: "online" | "offline";
  activeAllocatedCpu: number; // Cores
  activeAllocatedMem: number; // MB
  activeAllocatedDisk: number; // GB
}

export interface AppConfig {
  discordToken: string;
  clientId: string;
  guildId: string;
  pteroUrl: string;
  pteroApiKey: string;
  vpsDefaultDays: number;
  hostIpAddress: string;
  adminUserId?: string;
}
