import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { emitirCobroR4 } from '@/src/services/r4-service';
import { registrarEvento } from '@/src/services/logger';

export async function GET(request: Request) {
  // 1. Proteger el endpoint (Básico: Header secreto en producción)
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 2. Calcular fecha de corte (Mañana)
    const mañanaInicio = new Date();
    mañanaInicio.setDate(mañanaInicio.getDate() + 1);
    mañanaInicio.setHours(0, 0, 0, 0);

    const mañanaFin = new Date(mañanaInicio);
    mañanaFin.setHours(23, 59, 59, 999);

    // 3. Buscar suscripciones activas que vencen mañana
    const { data: suscripciones, error: subError } = await supabase
      .from('suscripciones')
      .select(`
        id, 
        usuario_id, 
        usuarios ( nombre_completo, cedula_rif, telefono )
      `)
      .eq('estado', 'ACTIVO')
      .gte('fecha_corte', mañanaInicio.toISOString())
      .lte('fecha_corte', mañanaFin.toISOString());

    if (subError) {
      console.error('[CRON Emisor] Error buscando suscripciones:', subError.message);
      return NextResponse.json({ error: 'Error BD' }, { status: 500 });
    }

    if (!suscripciones || suscripciones.length === 0) {
      return NextResponse.json({ message: 'No hay cobros pendientes para emitir hoy.' }, { status: 200 });
    }

    let emitidos = 0;
    const errores: any[] = [];

    // 4. Iterar y emitir cobros
    for (const sub of suscripciones) {
      const usuario = Array.isArray(sub.usuarios) ? sub.usuarios[0] : sub.usuarios;
      if (!usuario || !usuario.telefono || !usuario.cedula_rif) {
        console.warn(`[CRON Emisor] Suscripción ${sub.id}: Usuario incompleto, saltando.`);
        errores.push({ suscripcion: sub.id, error: 'Usuario incompleto' });
        continue;
      }

      // Buscar el monto de la última orden de esta suscripción
      const { data: lastOrder } = await supabase
        .from('ordenes_cobro')
        .select('monto')
        .eq('suscripcion_id', sub.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      const monto = lastOrder?.monto || 50; // Fallback

      // 4.1 Crear la orden PENDIENTE
      const { data: nuevaOrden, error: ordenErr } = await supabase
        .from('ordenes_cobro')
        .insert({
          usuario_id: sub.usuario_id,
          suscripcion_id: sub.id,
          monto: Number(monto),
          moneda: 'USD',
          estado: 'PENDIENTE',
          metadata: { origin: 'cron-emisor', timestamp: new Date().toISOString() },
        })
        .select('id')
        .single();

      if (ordenErr || !nuevaOrden?.id) {
        errores.push({ suscripcion: sub.id, error: 'Error creando orden' });
        continue;
      }

      const orderId = nuevaOrden.id;

      // 4.2 Emitir a R4
      const r4Result = await emitirCobroR4({
        monto: Number(monto),
        nombre: usuario.nombre_completo,
        cedula: usuario.cedula_rif,
        telefono: usuario.telefono,
        order_id: orderId,
      });

      if (r4Result.success) {
        await supabase
          .from('ordenes_cobro')
          .update({
            estado: 'ENVIADO',
            r4_transaction_id: r4Result.transaction_id ?? null,
            metadata: {
              origin: 'cron-emisor',
              r4_raw: r4Result.raw,
              timestamp: new Date().toISOString(),
            },
          })
          .eq('id', orderId);

        await registrarEvento('ordenes_cobro', orderId, 'EMISION_COBRO', {
          usuario_id: sub.usuario_id,
          suscripcion_id: sub.id,
          monto,
          metodo: 'CRON_AUTOMATICO'
        });

        emitidos++;
      } else {
        await supabase
          .from('ordenes_cobro')
          .update({
            estado: 'ERROR',
            metadata: {
              origin: 'cron-emisor',
              r4_error: r4Result.error,
              r4_raw: r4Result.raw,
              timestamp: new Date().toISOString(),
            },
          })
          .eq('id', orderId);

        errores.push({ suscripcion: sub.id, error: r4Result.error });
      }
    }

    return NextResponse.json({
      message: 'CRON Emisor ejecutado correctamente.',
      procesados: suscripciones.length,
      emitidos,
      errores
    }, { status: 200 });

  } catch (error: any) {
    console.error('[CRON Emisor] Error interno:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
