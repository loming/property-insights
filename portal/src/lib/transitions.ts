/**
 * The React transition type that nav-bar links give their navigations (Link's transitionTypes). Only
 * these crossfade the page (layout.tsx). A streamed section's reveal or a filter change carries no type,
 * so it swaps in place: animating a reveal would hold back the content, and its hydration, until the
 * fade had run.
 */
export const PAGE_NAVIGATION = "page-navigation";
