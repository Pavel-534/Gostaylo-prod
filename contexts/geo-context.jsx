'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { readIsRussiaCookieClient } from '@/lib/geo';

const GeoContext = createContext({ isRussia: false });

/**
 * @param {{ children: React.ReactNode, initialIsRussia?: boolean }} props
 */
export function GeoProvider({ children, initialIsRussia = false }) {
  const [isRussia, setIsRussia] = useState(Boolean(initialIsRussia));

  useEffect(() => {
    const fromCookie = readIsRussiaCookieClient();
    if (fromCookie !== null) setIsRussia(fromCookie);
  }, []);

  return <GeoContext.Provider value={{ isRussia }}>{children}</GeoContext.Provider>;
}

export function useGeo() {
  const ctx = useContext(GeoContext);
  if (!ctx) {
    throw new Error('useGeo must be used within GeoProvider');
  }
  return ctx;
}

export default GeoContext;
