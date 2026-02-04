import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as crypto from 'crypto';

export interface NexusSettings {
  // Appearance
  theme: 'light' | 'dark' | 'system';

  // Agent settings
  maxConcurrentAgents: number;
  defaultPermissionMode: 'explore' | 'ask' | 'auto';

  // LLM settings
  defaultModel: string;

  // Recent projects
  recentProjects: RecentProjectEntry[];

  // Checkpoints
  autoCheckpointEnabled: boolean;
  autoCheckpointInterval: number; // tool calls between checkpoints
  checkpointRetentionDays: number;
}

export interface RecentProjectEntry {
  id: string;
  name: string;
  path: string;
  lastOpenedAt: string;
}

export interface Credentials {
  anthropicApiKey?: string;
}

const DEFAULT_SETTINGS: NexusSettings = {
  theme: 'system',
  maxConcurrentAgents: 5,
  defaultPermissionMode: 'ask',
  defaultModel: 'claude-sonnet-4-20250514',
  recentProjects: [],
  autoCheckpointEnabled: true,
  autoCheckpointInterval: 10,
  checkpointRetentionDays: 7,
};

const NEXUS_HOME = path.join(os.homedir(), '.nexus');
const SETTINGS_FILE = 'settings.json';
const CREDENTIALS_FILE = 'credentials.enc';

// Simple encryption key derivation (in production, use a more secure method)
const ENCRYPTION_KEY = crypto.scryptSync(
  os.hostname() + os.userInfo().username,
  'nexus-salt',
  32
);

/**
 * Manages Nexus application settings
 */
export class SettingsManager {
  private settings: NexusSettings = { ...DEFAULT_SETTINGS };
  private credentials: Credentials = {};
  private initialized = false;

  /**
   * Initialize settings manager - load from disk
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    await this.ensureNexusHome();
    await this.loadSettings();
    await this.loadCredentials();
    this.initialized = true;
  }

  /**
   * Ensure ~/.nexus directory exists
   */
  private async ensureNexusHome(): Promise<void> {
    await fs.mkdir(NEXUS_HOME, { recursive: true });
  }

  /**
   * Load settings from disk
   */
  private async loadSettings(): Promise<void> {
    const settingsPath = path.join(NEXUS_HOME, SETTINGS_FILE);

    try {
      const content = await fs.readFile(settingsPath, 'utf-8');
      const loaded = JSON.parse(content);
      this.settings = { ...DEFAULT_SETTINGS, ...loaded };
    } catch {
      // Use defaults if file doesn't exist
      this.settings = { ...DEFAULT_SETTINGS };
    }
  }

  /**
   * Save settings to disk
   */
  private async saveSettings(): Promise<void> {
    const settingsPath = path.join(NEXUS_HOME, SETTINGS_FILE);
    await fs.writeFile(settingsPath, JSON.stringify(this.settings, null, 2));
  }

  /**
   * Load encrypted credentials
   */
  private async loadCredentials(): Promise<void> {
    const credentialsPath = path.join(NEXUS_HOME, CREDENTIALS_FILE);

    try {
      const encrypted = await fs.readFile(credentialsPath);
      const decrypted = this.decrypt(encrypted);
      this.credentials = JSON.parse(decrypted);
    } catch {
      this.credentials = {};
    }
  }

  /**
   * Save encrypted credentials
   */
  private async saveCredentials(): Promise<void> {
    const credentialsPath = path.join(NEXUS_HOME, CREDENTIALS_FILE);
    const encrypted = this.encrypt(JSON.stringify(this.credentials));
    await fs.writeFile(credentialsPath, encrypted);
  }

  /**
   * Encrypt data using AES-256-GCM
   */
  private encrypt(data: string): Buffer {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);

    const encrypted = Buffer.concat([
      cipher.update(data, 'utf8'),
      cipher.final(),
    ]);

    const authTag = cipher.getAuthTag();

    // Return: iv (16) + authTag (16) + encrypted data
    return Buffer.concat([iv, authTag, encrypted]);
  }

  /**
   * Decrypt data using AES-256-GCM
   */
  private decrypt(data: Buffer): string {
    const iv = data.subarray(0, 16);
    const authTag = data.subarray(16, 32);
    const encrypted = data.subarray(32);

    const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
    decipher.setAuthTag(authTag);

    return decipher.update(encrypted) + decipher.final('utf8');
  }

  /**
   * Get all settings
   */
  getSettings(): NexusSettings {
    return { ...this.settings };
  }

  /**
   * Get a specific setting
   */
  get<K extends keyof NexusSettings>(key: K): NexusSettings[K] {
    return this.settings[key];
  }

  /**
   * Set a specific setting
   */
  async set<K extends keyof NexusSettings>(
    key: K,
    value: NexusSettings[K]
  ): Promise<void> {
    this.settings[key] = value;
    await this.saveSettings();
  }

  /**
   * Update multiple settings at once
   */
  async update(updates: Partial<NexusSettings>): Promise<void> {
    this.settings = { ...this.settings, ...updates };
    await this.saveSettings();
  }

  /**
   * Get Anthropic API key
   */
  getAnthropicApiKey(): string | undefined {
    return this.credentials.anthropicApiKey;
  }

  /**
   * Set Anthropic API key
   */
  async setAnthropicApiKey(apiKey: string): Promise<void> {
    this.credentials.anthropicApiKey = apiKey;
    await this.saveCredentials();
  }

  /**
   * Check if API key is configured
   */
  hasApiKey(): boolean {
    return !!this.credentials.anthropicApiKey;
  }

  /**
   * Add a project to recent projects
   */
  async addRecentProject(project: RecentProjectEntry): Promise<void> {
    // Remove if already exists
    this.settings.recentProjects = this.settings.recentProjects.filter(
      (p) => p.path !== project.path
    );

    // Add to front
    this.settings.recentProjects.unshift(project);

    // Keep only last 10
    this.settings.recentProjects = this.settings.recentProjects.slice(0, 10);

    await this.saveSettings();
  }

  /**
   * Get recent projects
   */
  getRecentProjects(): RecentProjectEntry[] {
    return [...this.settings.recentProjects];
  }

  /**
   * Remove a project from recent projects
   */
  async removeRecentProject(projectPath: string): Promise<void> {
    this.settings.recentProjects = this.settings.recentProjects.filter(
      (p) => p.path !== projectPath
    );
    await this.saveSettings();
  }

  /**
   * Reset settings to defaults
   */
  async reset(): Promise<void> {
    this.settings = { ...DEFAULT_SETTINGS };
    await this.saveSettings();
  }
}

// Singleton instance
export const settingsManager = new SettingsManager();
