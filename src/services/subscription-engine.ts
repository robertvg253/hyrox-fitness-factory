import { createClient } from '@supabase/supabase-js'
import { registrarEvento } from './logger';

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
    .select('id, estado, fecha_corte')
    .eq('id', suscripcion_id)
    .single();

  if (subError || !suscripcion) {
    console.error(`[Subscription Engine] Suscripción ${suscripcion_id} no encontrada:`, subError?.message);
    return false;
  }

  const ahora = new Date();
  let nuevaFechaCorte = new Date();
  
  if (suscripcion.fecha_corte) {
    const fechaCorteActual = new Date(suscripcion.fecha_corte);
    // Si está ACTIVA y en el futuro, sumamos al corte actual (Renovación Anticipada)
    if (suscripcion.estado === 'ACTIVO' && fechaCorteActual > ahora) {
      nuevaFechaCorte = new Date(fechaCorteActual);
    }
  }

  // Time-Stacking: Sumar 1 mes exacto
  nuevaFechaCorte.setMonth(nuevaFechaCorte.getMonth() + 1);

  const { error: updateSubError } = await supabase
    .from('suscripciones')
    .update({
      estado: 'ACTIVO',
      fecha_corte: nuevaFechaCorte.toISOString(),
    })
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
