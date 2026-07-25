import type { configType } from './validators/config.ts';
import { getStorageItem, setStorageItem } from './utils.ts';
import {
  checkExtensionConfig,
  clearExtensionConfig,
  getExtensionConfig,
  saveExtensionConfig,
} from './runtime/messages.ts';

const DEFAULTS: configType = {
  baseUrl: '',
  apiKey: '',
  defaultCollection: '',
  syncBookmarks: false,
};

const CONFIG_KEY = 'grabshark_config';

function canUseRuntime() {
  return typeof window !== 'undefined' && typeof chrome !== 'undefined' && !!chrome.runtime?.id;
}

export async function getConfig(): Promise<configType> {
  if (canUseRuntime()) {
    try {
      return await getExtensionConfig();
    } catch {
      return DEFAULTS;
    }
  }

  const config = await getStorageItem(CONFIG_KEY);
  return config ? JSON.parse(config) : DEFAULTS;
}

export async function saveConfig(config: configType) {
  if (canUseRuntime()) {
    return await saveExtensionConfig(config);
  }

  return await setStorageItem(CONFIG_KEY, JSON.stringify(config));
}

export async function isConfigured() {
  if (canUseRuntime()) {
    const result = await checkExtensionConfig();
    return !!result.configured;
  }

  const config = await getConfig();
  return !!config.baseUrl && !!config.apiKey;
}

export async function clearConfig() {
  if (canUseRuntime()) {
    await clearExtensionConfig();
    return;
  }

  return await setStorageItem(CONFIG_KEY, JSON.stringify(DEFAULTS));
}
