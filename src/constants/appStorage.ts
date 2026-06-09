export const APP_STORAGE_KEYS = {
  theme: 'markknife-theme',
  zoom: 'markknife:zoom-level',
  viewMode: 'markknife-view-mode',
  tagColors: 'markknife:tag-color-overrides',
  statusColors: 'markknife:status-color-overrides',
  propertyModes: 'markknife:display-mode-overrides',
  configMigrationFlag: 'markknife:config-migrated-to-vault',
  legacyMigrationFlag: 'markknife:legacy-storage-migrated',
  sortPreferences: 'markknife-sort-preferences',
  sidebarCollapsed: 'markknife:sidebar-collapsed',
  layoutPanels: 'markknife:layout-panels',
  welcomeDismissed: 'markknife_welcome_dismissed',
} as const

export const LEGACY_APP_STORAGE_KEYS = {
  theme: 'laputa-theme',
  zoom: 'laputa:zoom-level',
  viewMode: 'laputa-view-mode',
  tagColors: 'laputa:tag-color-overrides',
  statusColors: 'laputa:status-color-overrides',
  propertyModes: 'laputa:display-mode-overrides',
  configMigrationFlag: 'laputa:config-migrated-to-vault',
  sortPreferences: 'laputa-sort-preferences',
  sidebarCollapsed: 'laputa:sidebar-collapsed',
  layoutPanels: 'laputa:layout-panels',
  welcomeDismissed: 'laputa_welcome_dismissed',
} as const

type MigratableStorageKey = keyof typeof LEGACY_APP_STORAGE_KEYS

export function getAppStorageItem(key: MigratableStorageKey): string | null {
  try {
    const storageKey = Reflect.get(APP_STORAGE_KEYS, key) as string
    const legacyStorageKey = Reflect.get(LEGACY_APP_STORAGE_KEYS, key) as string
    return localStorage.getItem(storageKey) ?? localStorage.getItem(legacyStorageKey)
  } catch {
    return null
  }
}
