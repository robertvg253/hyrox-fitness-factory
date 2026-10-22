export type UserRole = 
  | 'ADMIN'
  | 'SUPERADMIN' 
  | 'GERENTE' 
  | 'GERENTE_SEDE' 
  | 'RECEPCIONISTA' 
  | 'RECEPCION' 
  | 'ATLETA';

export const isSuperAdmin = (role: string | null | undefined): boolean => {
  if (!role) return false;
  const normalized = role.toLowerCase().trim();
  return normalized === 'superadmin' || normalized === 'admin';
};

export const hasFinanceAccess = (role: string | null | undefined): boolean => {
  if (!role) return false;
  const normalized = role.toLowerCase().trim();
  return ['superadmin', 'admin', 'gerente'].includes(normalized);
};

export const canAccessAdminPanel = (role: string | null | undefined): boolean => {
  if (!role) return false;
  const normalized = role.toLowerCase().trim();
  return normalized === 'admin' || normalized === 'superadmin';
};
