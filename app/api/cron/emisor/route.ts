import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { emitirCobroR4 } from '@/src/services/r4-service';
import { registrarEvento } from '@/src/services/logger';
import { getCaracasMidnightUTC } from '@/src/utils/timezone';

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

    // 2. Calcular fecha de corte (HOY y MAÑANA en Caracas)
    const hoyInicio = getCaracasMidnightUTC(0);
    const pasadoMañanaInicio = getCaracasMidnightUTC(2);
    // Para <= pasadoMañanaInicio restamos un milisegundo o evaluamos estrictamente
    const finVentanaMs = new Date(pasadoMañanaInicio.getTime() - 1);

    // 3. Buscar suscripciones activas que vencen hoy o mañana
    const { data: suscripciones, error: subError } = await supabase
      .from('suscripciones')
      .select(`
        id, 
        usuario_id, 
        planes ( id, nombre, precio_usd, sedes ),
        usuarios ( nombre_completo, cedula_rif, telefono )
      `)
      .eq('estado', 'ACTIVO')
      .gte('fecha_corte', hoyInicio.toISOString())
      .lte('fecha_corte', finVentanaMs.toISOString());

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
      try {
        const usuario = Array.isArray(sub.usuarios) ? sub.usuarios[0] : sub.usuarios;
        if (!usuario || !usuario.telefono || !usuario.cedula_rif) {
          console.warn(`[CRON Emisor] Suscripción ${sub.id}: Usuario incompleto, saltando.`);
          errores.push({ suscripcion: sub.id, error: 'Usuario incompleto' });
          continue;
        }

        const planData = Array.isArray(sub.planes) ? sub.planes[0] : sub.planes;
        const monto = planData?.precio_usd || 0;
        
        if (monto <= 0) {
          console.warn(`[CRON Emisor] Suscripción ${sub.id}: Plan base USD es 0 o inválido, omitiendo.`);
          errores.push({ suscripcion: sub.id, error: 'Monto inválido o cero' });
          continue;
        }

        // Bloqueo de Idempotencia: Verificar el estado de la última orden absoluta
        const { data: ultimaOrden } = await supabase
          .from('ordenes_cobro')
          .select('id, estado')
          .eq('suscripcion_id', sub.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (ultimaOrden && (ultimaOrden.estado === 'PENDIENTE' || ultimaOrden.estado === 'ENVIADO')) {
          console.warn(`[CRON Emisor] Suscripción ${sub.id}: La última orden está en tránsito (${ultimaOrden.id}), omitiendo.`);
          errores.push({ suscripcion: sub.id, error: 'Orden ya en tránsito' });
          continue;
        }

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
      } catch (err) {
        console.error(`[CRON Emisor] Error fatal en iteración sub ${sub.id}:`, err);
        errores.push({ suscripcion: sub.id, error: 'Error interno en iteración' });
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
