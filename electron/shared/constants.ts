export const SITE_ORIGIN = 'https://flingtrainer.com';
export const API_BASE = `${SITE_ORIGIN}/wp-json/wp/v2`;
export const TRAINER_CATEGORY_ID = 5;
export const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export const DEFAULT_HOTKEY = 'Control+Alt+F';
export const PAGE_SIZE = 100;
export const MAX_RETRY = 3;
export const REQUEST_TIMEOUT = 25000;

export const IPC = {
  stats: 'app:stats',
  appInfo: 'app:info',
  settingsGet: 'settings:get',
  settingsSet: 'settings:set',
  catalogSync: 'catalog:sync',
  catalogList: 'catalog:list',
  catalogDetail: 'catalog:detail',
  libraryList: 'library:list',
  downloadStart: 'download:start',
  downloadCancel: 'download:cancel',
  trainerLaunch: 'trainer:launch',
  trainerRemove: 'trainer:remove',
  trainerUpdate: 'trainer:update',
  trainerPatch: 'trainer:patch',
  updatesCheck: 'updates:check',
  panelToggle: 'panel:toggle',
  panelHide: 'panel:hide',
  shellReveal: 'shell:reveal',
  shellOpenSite: 'shell:open-site',
  pickFolder: 'dialog:pick-folder',
  eventDownload: 'event:download',
  eventSync: 'event:sync',
  eventLibrary: 'event:library',
  eventToast: 'event:toast',
  eventQuickToggle: 'event:quick-toggle',
} as const;
