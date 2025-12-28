import { useEffect } from 'react';

export function useDarkMode(darkMode?: boolean) {
  useEffect(() => {
    if (darkMode === undefined) {
      // If no preference set, check localStorage or default to false
      const saved = localStorage.getItem('darkMode');
      if (saved === 'true') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } else {
      // Apply dark mode preference
      if (darkMode) {
        document.documentElement.classList.add('dark');
        localStorage.setItem('darkMode', 'true');
      } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('darkMode', 'false');
      }
    }
  }, [darkMode]);
}

