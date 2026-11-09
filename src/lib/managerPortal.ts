/** Keep dialogs in the modern theme scope. The original manager/app keep their existing body portals. */
export function managerPortalRoot(): HTMLElement {
  return document.querySelector?.<HTMLElement>('[data-manager-modern] [data-central-portals]') ?? document.body;
}
