import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface WPayDebugLog {
  id: string;
  timestamp: Date;
  type: 'request' | 'response' | 'error';
  method: string;
  endpoint: string;
  request?: {
    email?: string;
    payment_category?: string;
    payment_type?: string;
    order_id?: string;
    amount?: number;
    payment_method?: string;
    metadata?: Record<string, any>;
  };
  response?: {
    wpay_status?: string;
    message?: string;
    order_id?: string;
    transaction_id?: string;
    profile?: {
      email?: string;
      wbalance?: number;
      bonus?: number;
      stars?: number;
      tier_type?: string;
      tier_factor?: number;
      lifetime_topups?: number;
    };
    transaction_details?: {
      amount?: number;
      wbalance_used?: number;
      bonus_used?: number;
      stars_awarded?: number;
    };
    payment_url?: string;
    expected_bonus?: number;
  };
  error?: string;
  duration?: number;
}

interface WPayDebugContextType {
  logs: WPayDebugLog[];
  addLog: (log: Omit<WPayDebugLog, 'id' | 'timestamp'>) => void;
  clearLogs: () => void;
  isEnabled: boolean;
  setIsEnabled: (enabled: boolean) => void;
}

const WPayDebugContext = createContext<WPayDebugContextType | undefined>(undefined);

export const WPayDebugProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [logs, setLogs] = useState<WPayDebugLog[]>([]);
  const [isEnabled, setIsEnabled] = useState(() => {
    return localStorage.getItem('wpay_debug_enabled') === 'true' ||
           import.meta.env.DEV;
  });

  const addLog = (log: Omit<WPayDebugLog, 'id' | 'timestamp'>) => {
    if (!isEnabled) return;

    const newLog: WPayDebugLog = {
      ...log,
      id: `${Date.now()}-${Math.random()}`,
      timestamp: new Date(),
    };

    setLogs(prev => [newLog, ...prev].slice(0, 50));
  };

  const clearLogs = () => {
    setLogs([]);
  };

  const handleSetIsEnabled = (enabled: boolean) => {
    setIsEnabled(enabled);
    localStorage.setItem('wpay_debug_enabled', String(enabled));
    if (!enabled) {
      clearLogs();
    }
  };

  return (
    <WPayDebugContext.Provider
      value={{
        logs,
        addLog,
        clearLogs,
        isEnabled,
        setIsEnabled: handleSetIsEnabled,
      }}
    >
      {children}
    </WPayDebugContext.Provider>
  );
};

export const useWPayDebug = () => {
  const context = useContext(WPayDebugContext);
  if (!context) {
    throw new Error('useWPayDebug must be used within WPayDebugProvider');
  }
  return context;
};
