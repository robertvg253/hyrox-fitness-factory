/**
 * Utilidades para manejar la zona horaria de Caracas (UTC-4)
 * sin depender de librerías externas voluminosas.
 */

// Caracas es estrictamente UTC-4 todo el año (no tiene DST).
const CARACAS_OFFSET_HOURS = -4;

/**
 * Devuelve un objeto Date que representa la medianoche (00:00:00 local)
 * de un día específico en Caracas, pero el objeto Date retornado estará
 * internamente en UTC (04:00:00 UTC del mismo día).
 * 
 * @param offsetDays 0 para HOY, 1 para MAÑANA, -1 para AYER, etc.
 */
export function getCaracasMidnightUTC(offsetDays: number = 0): Date {
  const nowUTC = new Date();
  
  // Saber qué día es HOY en Caracas (restando 4 horas al UTC actual)
  const caracasTime = new Date(nowUTC.getTime() + (CARACAS_OFFSET_HOURS * 60 * 60 * 1000));
  
  // Crear el Date en UTC que equivale a la medianoche de Caracas (04:00:00 UTC)
  return new Date(Date.UTC(
    caracasTime.getUTCFullYear(),
    caracasTime.getUTCMonth(),
    caracasTime.getUTCDate() + offsetDays,
    -CARACAS_OFFSET_HOURS, // 04:00 UTC = 00:00 Caracas
    0, 0, 0
  ));
}

/**
 * Formatea una fecha en formato amigable usando estrictamente la zona de Caracas.
 */
export function formatCaracasDate(dateString: string | Date | null | undefined): string {
  if (!dateString) return 'No disponible';
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  
  return new Intl.DateTimeFormat('es-VE', {
    timeZone: 'America/Caracas',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(date);
}

/**
 * Formatea una fecha y hora en formato amigable usando estrictamente la zona de Caracas.
 */
export function formatCaracasDateTime(dateString: string | Date | null | undefined): string {
  if (!dateString) return 'No disponible';
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  
  return new Intl.DateTimeFormat('es-VE', {
    timeZone: 'America/Caracas',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).format(date);
}

/**
 * Formatea una fecha para mostrar solo la hora usando estrictamente la zona de Caracas.
 */
export function formatCaracasTime(dateString: string | Date | null | undefined): string {
  if (!dateString) return 'No disponible';
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  
  return new Intl.DateTimeFormat('es-VE', {
    timeZone: 'America/Caracas',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).format(date);
}
