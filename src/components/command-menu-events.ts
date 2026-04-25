'use client';

export const COMMAND_MENU_INDEX_PATH = '/command-menu-index.json';
export const COMMAND_MENU_FULLTEXT_INDEX_PATH =
  '/command-menu-fulltext-index.json';
export const COMMAND_MENU_PRELOAD_EVENT = 'command-menu:preload';
export const COMMAND_MENU_TOGGLE_EVENT = 'command-menu:toggle';
export const COMMAND_MENU_IDLE_DELAY_MS = 400;
export const COMMAND_MENU_IDLE_TIMEOUT_MS = 900;

export function dispatchCommandMenuPreload() {
  window.dispatchEvent(new Event(COMMAND_MENU_PRELOAD_EVENT));
}

export function dispatchCommandMenuToggle() {
  window.dispatchEvent(new Event(COMMAND_MENU_TOGGLE_EVENT));
}
