"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Sede {
  id: string;
  nombre: string;
}

interface TenantContextType {
  sedes: Sede[];
  activeSede: Sede | null;
  setActiveSede: (sede: Sede) => void;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

interface TenantProviderProps {
  children: React.ReactNode;
  initialSedes: Sede[];
  initialActiveSede: Sede | null;
}

export function TenantProvider({ children, initialSedes, initialActiveSede }: TenantProviderProps) {
  const router = useRouter();
  const [sedes] = useState<Sede[]>(initialSedes);
  
  // Si no hay sede activa inicial pero hay sedes disponibles, tomamos la primera por defecto
  const [activeSede, setActiveSedeState] = useState<Sede | null>(
    initialActiveSede || (initialSedes.length > 0 ? initialSedes[0] : null)
  );

  const setActiveSede = (sede: Sede) => {
    setActiveSedeState(sede);
    // Escribimos en cookie para que el Server Component la pueda leer en la próxima hidratación
    document.cookie = `active_sede=${sede.id}; path=/; max-age=31536000`; // Expira en 1 año
    
    // Forzamos un refresco de Next.js para re-ejecutar Server Components con la nueva cookie
    router.refresh();
  };

  return (
    <TenantContext.Provider value={{ sedes, activeSede, setActiveSede }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
}
