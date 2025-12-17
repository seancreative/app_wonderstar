import { useEffect } from 'react';
import { useWPayDebug } from '../contexts/WPayDebugContext';
import { setWPayDebugLogger } from '../services/wpayService';

export const WPayDebugConnector: React.FC = () => {
  const { addLog } = useWPayDebug();

  useEffect(() => {
    setWPayDebugLogger(addLog);

    return () => {
      setWPayDebugLogger(() => {});
    };
  }, [addLog]);

  return null;
};
