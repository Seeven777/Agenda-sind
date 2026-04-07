import React, { createContext, useContext, useState } from 'react';

interface AppContextType {
  showReportModal: boolean;
  setShowReportModal: (show: boolean) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [showReportModal, setShowReportModal] = useState(false);

  return (
    <AppContext.Provider value={{ showReportModal, setShowReportModal }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
}