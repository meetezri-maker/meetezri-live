const APP_MAIN_SCROLL_SELECTOR = "main.solace-scroll";

/** Scroll container for member app pages (AppLayout `<main>`). */
export function getAppMainScrollElement(): HTMLElement | null {
  const main = document.querySelector(APP_MAIN_SCROLL_SELECTOR);
  return main instanceof HTMLElement ? main : null;
}

/** Scroll a field into view inside the app main pane (not the window). */
export function scrollElementInAppMain(
  element: HTMLElement,
  options?: { offset?: number; behavior?: ScrollBehavior }
) {
  const main = getAppMainScrollElement();
  const offset = options?.offset ?? 96;
  const behavior = options?.behavior ?? "auto";

  if (main) {
    const elTop = element.getBoundingClientRect().top;
    const mainTop = main.getBoundingClientRect().top;
    const targetTop = main.scrollTop + (elTop - mainTop) - offset;
    main.scrollTo({ top: Math.max(0, targetTop), behavior });
    return;
  }

  element.scrollIntoView({ behavior, block: "nearest" });
}

export function scrollAppMainToTop(behavior: ScrollBehavior = "auto") {
  const main = getAppMainScrollElement();
  if (main) {
    main.scrollTo({ top: 0, behavior });
  }
}

/** Clamp scroll after layout height changes (e.g. leaving edit mode). */
export function clampAppMainScroll() {
  const main = getAppMainScrollElement();
  if (!main) return;
  const maxScroll = Math.max(0, main.scrollHeight - main.clientHeight);
  if (main.scrollTop > maxScroll) {
    main.scrollTop = maxScroll;
  }
}

/** Reset scroll when profile edit mode closes so the hero/header stay visible. */
export function resetAppMainScrollAfterProfileEdit() {
  clampAppMainScroll();
  scrollAppMainToTop("auto");
}
