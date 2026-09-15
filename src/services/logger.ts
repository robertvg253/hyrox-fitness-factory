import { createClient } from '@supabase/supabase-js'

export type EntidadLog = 'ordenes_cobro' | 'suscripciones' | 'usuarios' | 'sistema';

export type AccionLog = 
  | 'EMISION_COBRO'
  | 'PAGO_APROBADO'
  | 'PAGO_INCOMPLETO'
  | 'RENOVACION_ESTADO'
  | 'ERROR_COBRO'
  | 'CREACION_USUARIO'
  | 'SISTEMA_INICIADO'
  | 'SUSCRIPCION_VENCIDA'
  | 'SUSCRIPCION_VENCIDA_CON_INCIDENCIA'
  | 'ORDEN_EXPIRADA';

/**
 * Registra un evento de auditoría en la tabla universal `bitacora_eventos`
 */
export async function registrarEvento(
  entidad: EntidadLog,
  entidad_id: string,
  accion: AccionLog,
  detalles: Record<string, any> = {}
) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { error } = await supabase
      .from('bitacora_eventos')
      .insert({
        entidad,
        entidad_id,
        accion,
        detalles
      });

    if (error) {
      console.error('[Logger] Error insertando en bitacora_eventos:', error.message);
    }
  } catch (err) {
    console.error('[Logger] Error crítico registrando evento:', err);
  }
}
