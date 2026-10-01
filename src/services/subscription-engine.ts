import { createClient } from '@supabase/supabase-js'
import { registrarEvento } from './logger';
import { getCaracasMidnightUTC } from '@/src/utils/timezone';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Procesa la lógica central de renovaciones (Time-Stacking) y dunning.
 * Valida matemáticamente el pago contra la tasa del día, maneja incidencias y renueva fechas.
 */
export async function procesarRenovacion(
  orden_id: string,
  suscripcion_id: string,
  monto_usd: number,
  tasa_r4: number,
  monto_pagado_ves: number
): Promise<boolean> {
  const montoEsperado = monto_usd * tasa_r4;
  const tolerancia = 100; // VES

  // 1. Validación de Monto
  if (monto_pagado_ves < (montoEsperado - tolerancia)) {
    console.error(`[Subscription Engine] Pago incompleto. Esperado: ~${montoEsperado} VES. Pagado: ${monto_pagado_ves} VES. Orden: ${orden_id}`);
    
    // Actualizar orden con incidencia
    await supabase
      .from('ordenes_cobro')
      .update({
        incidencia: true,
        detalles_incidencia: 'Pago incompleto'
      })
      .eq('id', orden_id);

    await registrarEvento('ordenes_cobro', orden_id, 'PAGO_INCOMPLETO', {
      monto_esperado_ves: montoEsperado,
      monto_pagado_ves,
      tasa_r4
    });

    return false; // Retornamos falso porque no se renovó
  }

  // 2. Ejecución del Time-Stacking (Caso Éxito)
  const { data: suscripcion, error: subError } = await supabase
    .from('suscripciones')
    .select('id, estado, fecha_corte, plan_id, planes (tipo, sesiones_total)')
    .eq('id', suscripcion_id)
    .single();

  if (subError || !suscripcion) {
    console.error(`[Subscription Engine] Suscripción ${suscripcion_id} no encontrada:`, subError?.message);
    return false;
  }

  let nuevaFechaCorte = getCaracasMidnightUTC(0);
  
  if (suscripcion.fecha_corte) {
    // Time-Stacking Preciso: NO usamos la fecha del servidor, sino la que está en la base de datos
    // para no regalar días por pagos tardíos (Pagos Zombie).
    nuevaFechaCorte = new Date(suscripcion.fecha_corte);
  }

  // Time-Stacking: Sumar 1 mes exacto de forma segura en UTC
  nuevaFechaCorte.setUTCMonth(nuevaFechaCorte.getUTCMonth() + 1);

  const planesObj = Array.isArray(suscripcion.planes) ? suscripcion.planes[0] : suscripcion.planes;
  const isSesiones = (planesObj as any)?.tipo === 'SESIONES';
  const payloadToUpdate: any = {
    estado: 'ACTIVO',
  };

  if (isSesiones) {
    payloadToUpdate.sesiones_restantes = (planesObj as any)?.sesiones_total || 0;
    // La fecha_corte puede mantenerse o no actualizarse en planes por sesiones, 
    // pero mantendremos la proyección en caso de plan mixto o reglas futuras.
    payloadToUpdate.fecha_corte = nuevaFechaCorte.toISOString();
  } else {
    payloadToUpdate.fecha_corte = nuevaFechaCorte.toISOString();
    payloadToUpdate.sesiones_restantes = null;
  }

  const { error: updateSubError } = await supabase
    .from('suscripciones')
    .update(payloadToUpdate)
    .eq('id', suscripcion.id);

  if (updateSubError) {
    console.error(`[Subscription Engine] Error renovando suscripción ${suscripcion.id}:`, updateSubError.message);
    return false;
  }

  console.log(`[Subscription Engine] Suscripción ${suscripcion.id} renovada hasta ${nuevaFechaCorte.toISOString()}.`);
  
  await registrarEvento('suscripciones', suscripcion.id, 'RENOVACION_ESTADO', {
    estado_anterior: suscripcion.estado,
    nuevo_estado: 'ACTIVO',
    nueva_fecha_corte: nuevaFechaCorte.toISOString()
  });

  return true;
}
