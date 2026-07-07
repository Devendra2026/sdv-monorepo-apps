export const COMMAND_PALETTE_OPEN_EVENT = "sdv:open-command-palette"

export function openCommandPalette() {
  document.dispatchEvent(new CustomEvent(COMMAND_PALETTE_OPEN_EVENT))
}
