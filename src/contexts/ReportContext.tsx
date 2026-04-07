import React, { createContext, useContext, useState, useCallback } from 'react';

interface ReportContextType {
  showReportModal: boolean;
  setShowReportModal: (show: boolean) => void;
  openReport: () => void;
}

const ReportContext = createContext<ReportContextType | undefined>(undefined);

export function ReportProvider({ children }: { children: React.ReactNode }) {
  const [showReportModal, setShowReportModal] = useState(false);
  
  const openReport = useCallback(() => {
    setShowReportModal(true);
  }, []);

  return (
    <ReportContext.Provider value={{ showReportModal, setShowReportModal, openReport }}>
      {children}
    </ReportContext.Provider>
  );
}

export function useReport() {
  const context = useContext(ReportContext);
  if (!context) {
    throw new Error('useReport must be used within ReportProvider');
  }
  return context;
}