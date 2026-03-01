/**
 * Thin container that reads open state from the app store.
 * The store's isGlobalSearchOpen / setIsGlobalSearchOpen is managed in App.tsx.
 * This container is kept for compatibility but is not used in the current UI.
 */
export const GlobalSearchModalContainer: React.FC = () => {
    // Not wired via modal context — GlobalSearchModal is mounted directly in App.tsx
    return null;
};
