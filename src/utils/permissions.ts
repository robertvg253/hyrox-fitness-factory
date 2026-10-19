export type UserRole = 
  | 'SUPERADMIN' 
  | 'GERENTE' 
  | 'GERENTE_SEDE' 
  | 'RECEPCIONISTA' 
  | 'RECEPCION' 
  | 'ATLETA';

export const isSuperAdmin = (role: string | null | undefined): boolean => {
  if (!role) return false;
  return role.toUpperCase() === 'SUPERADMIN';
};

export const hasFinanceAccess = (role: string | null | undefined): boolean => {
  if (!role) return false;
  const normalized = role.toUpperCase();
  // Únicamente SUPERADMIN y GERENTE tienen acceso a finanzas y métricas
  return ['SUPERADMIN', 'GERENTE', 'GERENTE_SEDE'].includes(normalized);
};

export const canAccessAdminPanel = (role: string | null | undefined): boolean => {
  if (!role) return false;
  const normalized = role.toUpperCase();
  // Personal autorizado para entrar a /admin (excluye estrictamente a ATLETA)
  return ['SUPERADMIN', 'GERENTE', 'GERENTE_SEDE', 'RECEPCIONISTA', 'RECEPCION'].includes(normalized);
};
