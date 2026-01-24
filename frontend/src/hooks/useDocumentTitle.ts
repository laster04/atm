import { useEffect } from 'react';

const APP_NAME = 'ATM - amateur team management';

/**
 * Hook to set the document title dynamically.
 * Automatically appends the app name.
 *
 * @param parts - Array of title parts to join with " - " (e.g., ["League Name", "Season Name"])
 *                Pass empty array or undefined to show only app name
 *
 * @example
 * // Shows: "Premier League | Sport Season"
 * useDocumentTitle(['Premier League']);
 *
 * // Shows: "Premier League - Season 2024 | Sport Season"
 * useDocumentTitle(['Premier League', 'Season 2024']);
 *
 * // Shows: "Sport Season"
 * useDocumentTitle([]);
 */
export function useDocumentTitle(parts?: (string | undefined | null)[]) {
  useEffect(() => {
    const filteredParts = parts?.filter((part): part is string => !!part) || [];

    if (filteredParts.length > 0) {
      document.title = `${filteredParts.join(' - ')} | ${APP_NAME}`;
    } else {
      document.title = APP_NAME;
    }

    // Reset title on unmount
    return () => {
      document.title = APP_NAME;
    };
  }, [parts?.join('-')]);
}

export default useDocumentTitle;
