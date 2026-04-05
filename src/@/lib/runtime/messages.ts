import type { configType } from '../validators/config.ts';
import type { ExtensionPreferences, SiteOverrides } from '../settings.ts';
import type { ResponseCollections } from '../actions/collections.ts';
import type { ResponseTags } from '../actions/tags.ts';
import { sendRuntimeMessage } from './core.ts';
export type { RuntimeResponse } from './core.ts';

export interface DomainPreferencePayload {
  domain: string;
  enableSmartCapture?: boolean;
  enableSelectionMenu?: boolean;
}

export interface SuggestTagsPayload {
  url: string;
  title?: string;
  description?: string;
}

export interface CachedUserPrefs {
  archiveAsScreenshot: boolean;
  archiveAsMonolith: boolean;
  archiveAsPDF: boolean;
  archiveAsReadable: boolean;
  aiTag: boolean;
  theme?: 'light' | 'dark' | 'system' | 'website';
}

export interface BootstrapExtensionState {
  configured: boolean;
  baseUrl?: string;
  config?: {
    baseUrl: string;
    defaultCollection: string;
    syncBookmarks: boolean;
  };
  user?: any | null;
  collections?: ResponseCollections[];
  tags?: ResponseTags[];
  prefs?: CachedUserPrefs | null;
  domainPreference?: {
    domain?: string;
    enableSmartCapture: boolean;
    enableSelectionMenu: boolean;
    isModified?: boolean;
    globalDefaults?: {
      enableSmartCapture: boolean;
      enableSelectionMenu: boolean;
    } | null;
  } | null;
}

export interface LocaleSettings {
  locale: string;
  localeSetting: 'en' | 'tr' | 'system';
}

export const sendExtensionMessage = sendRuntimeMessage;

async function expectSuccess<T>(promise: Promise<import('./core.ts').RuntimeResponse<T>>, fallbackError: string) {
  const response = await promise;
  if (!response.success) {
    throw new Error(response.error || fallbackError);
  }
  return response.data as T;
}

export async function checkExtensionConfig() {
  return await expectSuccess(sendExtensionMessage<{ configured: boolean; baseUrl?: string }>('CHECK_CONFIG'), 'Failed to check extension config');
}

export async function getExtensionConfig() {
  return await expectSuccess<configType>(sendExtensionMessage('GET_EXTENSION_CONFIG'), 'Failed to load extension config');
}

export async function saveExtensionConfig(config: configType) {
  return await expectSuccess<configType>(sendExtensionMessage('SAVE_EXTENSION_CONFIG', config), 'Failed to save extension config');
}

export async function clearExtensionConfig() {
  await expectSuccess(sendExtensionMessage('CLEAR_EXTENSION_CONFIG'), 'Failed to clear extension config');
}

export async function getExtensionBootstrapState(domain?: string) {
  return await expectSuccess<BootstrapExtensionState>(sendExtensionMessage('BOOTSTRAP_EXTENSION_STATE', domain ? { domain } : {}), 'Failed to load extension bootstrap state');
}

export async function getCurrentUserProfile() {
  return await expectSuccess<any>(sendExtensionMessage('GET_USER'), 'Failed to load user profile');
}

export async function updateCurrentUserProfile(userId: number, data: Record<string, unknown>) {
  return await expectSuccess<any>(sendExtensionMessage('UPDATE_USER', { userId, data }), 'Failed to update user profile');
}

export async function syncUserLocale() {
  return await expectSuccess<{ locale: string; skipped?: boolean }>(sendExtensionMessage('SYNC_USER_LOCALE'), 'Failed to sync locale');
}

export async function getCollectionsData() {
  return await expectSuccess<{ response: ResponseCollections[] }>(sendExtensionMessage('GET_COLLECTIONS'), 'Failed to load collections');
}

export async function getTagsData() {
  return await expectSuccess<{ response: ResponseTags[] }>(sendExtensionMessage('GET_TAGS'), 'Failed to load tags');
}

export async function getRecentLinksData() {
  return await expectSuccess<any[]>(sendExtensionMessage('GET_RECENT_LINKS'), 'Failed to load recent links');
}

export async function getLinkWithHighlights(url: string) {
  return await expectSuccess<any>(sendExtensionMessage('GET_LINK_WITH_HIGHLIGHTS', { url }), 'Failed to load link details');
}

export async function saveLinkFromExtension(values: Record<string, unknown>, aiTagged = false) {
  return await expectSuccess<any>(sendExtensionMessage('SAVE_LINK_FROM_EXTENSION', { values, aiTagged }), 'Failed to save link');
}

export async function updateLinkMessage(id: number, payload: Record<string, unknown>) {
  return await expectSuccess<any>(sendExtensionMessage('UPDATE_LINK', { id, payload }), 'Failed to update link');
}

export async function deleteLinkMessage(id: number) {
  await expectSuccess(sendExtensionMessage('DELETE_LINK', { id }), 'Failed to delete link');
}

export async function archiveLinkMessage(id: number, action: 'archive' | 'unarchive') {
  await expectSuccess(sendExtensionMessage('ARCHIVE_LINK', { id, action }), 'Failed to archive link');
}

export async function checkLinkExistsMessage(url: string) {
  return await expectSuccess<boolean>(sendExtensionMessage('CHECK_LINK_EXISTS', { url }), 'Failed to check link existence');
}

export async function fetchImageBlobMessage(url: string) {
  return await expectSuccess<{ base64Data?: string }>(sendExtensionMessage('FETCH_IMAGE_BLOB', { url }), 'Failed to fetch image blob');
}

export async function openTabMessage(url: string) {
  await expectSuccess(sendExtensionMessage('OPEN_TAB', { url }), 'Failed to open tab');
}

export async function getDomainPreference(domain: string) {
  return await expectSuccess<any>(sendExtensionMessage('GET_DOMAIN_PREFERENCE', { domain }), 'Failed to load domain preference');
}

export async function saveDomainPreference(payload: DomainPreferencePayload) {
  return await expectSuccess<any>(sendExtensionMessage('SET_DOMAIN_PREFERENCE', payload), 'Failed to save domain preference');
}

export async function suggestTags(payload: SuggestTagsPayload) {
  return await expectSuccess<{ tags: string[] }>(sendExtensionMessage('SUGGEST_TAGS', payload), 'Failed to suggest tags');
}

export async function getExtensionPreferences() {
  return await expectSuccess<ExtensionPreferences>(sendExtensionMessage('GET_EXTENSION_PREFERENCES'), 'Failed to load extension preferences');
}

export async function saveExtensionPreferences(preferences: ExtensionPreferences) {
  return await expectSuccess<ExtensionPreferences>(sendExtensionMessage('SAVE_EXTENSION_PREFERENCES', preferences), 'Failed to save extension preferences');
}

export async function getSiteOverridesData() {
  return await expectSuccess<SiteOverrides>(sendExtensionMessage('GET_SITE_OVERRIDES'), 'Failed to load site overrides');
}

export async function saveSiteOverrideMessage(hostname: string, key: 'enableSmartCapture' | 'enableSelectionMenu', value: boolean) {
  await expectSuccess(sendExtensionMessage('SAVE_SITE_OVERRIDE', { hostname, key, value }), 'Failed to save site override');
}

export async function clearSiteOverrideMessage(hostname: string, key: 'enableSmartCapture' | 'enableSelectionMenu') {
  await expectSuccess(sendExtensionMessage('CLEAR_SITE_OVERRIDE', { hostname, key }), 'Failed to clear site override');
}

export async function getEffectivePreferencesData(hostname?: string) {
  return await expectSuccess<ExtensionPreferences>(sendExtensionMessage('GET_EFFECTIVE_PREFERENCES', hostname ? { hostname } : {}), 'Failed to resolve effective preferences');
}

export async function getLocaleSettings() {
  return await expectSuccess<LocaleSettings>(sendExtensionMessage('GET_LOCALE_SETTINGS'), 'Failed to load locale settings');
}

export async function saveLocaleSettings(settings: LocaleSettings) {
  await expectSuccess(sendExtensionMessage('SAVE_LOCALE_SETTINGS', settings), 'Failed to save locale settings');
}

export async function broadcastPreferencesUpdated(data: Record<string, unknown>) {
  await expectSuccess(sendExtensionMessage('BROADCAST_PREFERENCES_UPDATED', data), 'Failed to broadcast preference changes');
}

export async function syncLinkUrls() {
  await expectSuccess(sendExtensionMessage('SYNC_LINK_URLS'), 'Failed to sync link URLs');
}
