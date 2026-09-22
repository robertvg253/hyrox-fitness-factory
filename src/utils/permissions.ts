export type UserRole = 'SUPERADMIN' | 'GERENTE_SEDE' | 'RECEPCION' | 'ATLETA';

export const hasFinanceAccess = (role: string | null | undefined) => {
  if (!role) return false;
  // SUPERADMIN y GERENTE_SEDE tienen acceso. Recepción y Atletas NO.
  return ['SUPERADMIN', 'GERENTE_SEDE'].includes(role);
};

export const canAccessAdminPanel = (role: string | null | undefined) => {
  if (!role) return false;
  return ['SUPERADMIN', 'GERENTE_SEDE', 'RECEPCION'].includes(role);
};
