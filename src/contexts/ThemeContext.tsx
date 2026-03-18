import React, { createContext, useContext, useState, useEffect } from 'react';

type Theme = 'dark' | 'light';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'dark',
  toggleTheme: () => {},
});

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem('sind-theme') as Theme) || 'dark';
  });

  useEffect(() => {
    localStorage.setItem('sind-theme', theme);
    const root = document.documentElement;

    if (theme === 'dark') {
      root.style.setProperty('--bg-primary', '#0f0f13');
      root.style.setProperty('--bg-secondary', '#17171f');
      root.style.setProperty('--bg-card', '#1e1e2a');
      root.style.setProperty('--bg-card-hover', '#252535');
      root.style.setProperty('--bg-input', '#252535');
      root.style.setProperty('--border-subtle', 'rgba(255,255,255,0.06)');
      root.style.setProperty('--border-color', 'rgba(255,111,15,0.12)');
      root.style.setProperty('--text-primary', '#f0f0fa');
      root.style.setProperty('--text-secondary', '#8888aa');
      root.style.setProperty('--text-muted', '#555570');
    } else {
      root.style.setProperty('--bg-primary', '#f4f4f8');
      root.style.setProperty('--bg-secondary', '#ffffff');
      root.style.setProperty('--bg-card', '#ffffff');
      root.style.setProperty('--bg-card-hover', '#f8f8fc');
      root.style.setProperty('--bg-input', '#f4f4f8');
      root.style.setProperty('--border-subtle', 'rgba(0,0,0,0.08)');
      root.style.setProperty('--border-color', 'rgba(255,111,15,0.25)');
      root.style.setProperty('--text-primary', '#0f0f18');
      root.style.setProperty('--text-secondary', '#4a4a6a');
      root.style.setProperty('--text-muted', '#9090b0');
    }
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
