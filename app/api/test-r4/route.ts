/**
 * app/api/test-r4/route.ts
 *
 * Endpoint de prueba manual para la integración con la pasarela R4 Conecta.
 * Uso: GET http://localhost:3000/api/test-r4
 *
 * ⚠️  SOLO PARA DESARROLLO — eliminar o proteger con auth antes de producción.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { emitirCobroR4 } from '@/src/services/r4-service'

// ---------------------------------------------------------------------------
// Datos de prueba — editar antes de cada ejecución manual
// ---------------------------------------------------------------------------
const TEST_PAYLOAD = {
  monto: 0.05,
  nombre: 'Robert Test',
  cedula: 'V28165253',
  telefono: '+584145220237',
  suscripcion_id: 'ce87da72-cefb-468d-8bc7-518b22141c70',
  usuario_id: '24fa1ad8-b792-4eb0-869b-e23fc66d81b7',
}

// ---------------------------------------------------------------------------
// Handler GET
// ---------------------------------------------------------------------------
export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // ── 1. Insertar orden PENDIENTE en ordenes_cobro ────────────────────────
  const { data: nuevaOrden, error: ordenErr } = await supabase
    .from('ordenes_cobro')
    .insert({
      usuario_id: TEST_PAYLOAD.usuario_id,
      suscripcion_id: TEST_PAYLOAD.suscripcion_id,
      monto: TEST_PAYLOAD.monto,
      moneda: 'USD',
      estado: 'PENDIENTE',
      metadata: { origin: 'test-r4-route', timestamp: new Date().toISOString() },
    })
    .select('id')
    .single()

  if (ordenErr || !nuevaOrden?.id) {
    return NextResponse.json(
      { ok: false, step: 'insert_orden', error: ordenErr?.message ?? 'No se pudo crear la orden' },
      { status: 500 }
    )
  }

  const orderId: string = nuevaOrden.id
  console.log('[test-r4] Orden creada:', orderId)

  // ── 2. Llamar al servicio R4 ────────────────────────────────────────────
  const { usuario_id, suscripcion_id, ...r4Payload } = TEST_PAYLOAD
  const r4Result = await emitirCobroR4({
    ...r4Payload,
    order_id: orderId,
  })

  console.log('[test-r4] Resultado R4:', r4Result)

  // ── 5a. Éxito: guardar instruction_id de R4 en la orden ────────────────
  if (r4Result.success) {
    const { error: updateErr } = await supabase
      .from('ordenes_cobro')
      .update({
        estado: 'ENVIADO',
        r4_transaction_id: r4Result.instruction_id ?? null,
        metadata: {
          origin: 'test-r4-route',
          r4_raw: r4Result.raw,
          timestamp: new Date().toISOString(),
        },
      })
      .eq('id', orderId)

    return NextResponse.json({
      ok: true,
      message: 'Instrucción de cobro emitida correctamente.',
      order_id: orderId,
      r4_instruction_id: r4Result.instruction_id,
      db_update_error: updateErr?.message ?? null,
      r4_raw: r4Result.raw,
    })
  }

  // ── 5b. Fallo: persistir error en metadata para auditoría ──────────────
  await supabase
    .from('ordenes_cobro')
    .update({
      estado: 'ERROR',
      metadata: {
        origin: 'test-r4-route',
        r4_error: r4Result.error,
        r4_raw: r4Result.raw,
        timestamp: new Date().toISOString(),
      },
    })
    .eq('id', orderId)

  return NextResponse.json(
    {
      ok: false,
      message: 'El servicio R4 retornó un error.',
      order_id: orderId,
      r4_error: r4Result.error,
      r4_raw: r4Result.raw,
    },
    { status: 502 }
  )
}
