import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { registrarEvento } from '@/src/services/logger';
import { getCaracasMidnightUTC } from '@/src/utils/timezone';

export async function GET(request: Request) {
  // 1. Proteger el endpoint
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // -------------------------------------------------------------------------
    // ACCIÓN A: Expirar órdenes antiguas (> 24h PENDIENTE o ENVIADO)
    // -------------------------------------------------------------------------
    const hace24Horas = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const { data: expiradas, error: expError } = await supabase
      .from('ordenes_cobro')
      .update({ estado: 'EXPIRADO' })
      .in('estado', ['PENDIENTE', 'ENVIADO'])
      .lt('created_at', hace24Horas.toISOString())
      .select('id');

    if (expError) {
      console.error('[CRON Verdugo] Error expirando órdenes:', expError.message);
    } else if (expiradas && expiradas.length > 0) {
      for (const ord of expiradas) {
        await registrarEvento('ordenes_cobro', ord.id, 'ORDEN_EXPIRADA', {
          motivo: 'Tiempo de gracia (24h) agotado'
        });
      }
    }

    // -------------------------------------------------------------------------
    // ACCIÓN B: Castigar suscripciones morosas (fecha_corte < HOY en Caracas)
    // -------------------------------------------------------------------------
    const hoy = getCaracasMidnightUTC(0);

    const { data: morosas, error: morError } = await supabase
      .from('suscripciones')
      .select('id, usuario_id')
      .eq('estado', 'ACTIVO')
      .lt('fecha_corte', hoy.toISOString());

    if (morError) {
      console.error('[CRON Verdugo] Error consultando morosos:', morError.message);
      return NextResponse.json({ error: 'Error BD en morosos' }, { status: 500 });
    }

    let inactivadasNormal = 0;
    let inactivadasIncidencia = 0;

    for (const sub of (morosas || [])) {
      try {
        // Buscar si existe alguna orden reciente con incidencia = true para esta suscripción
        const { data: ordenConIncidencia } = await supabase
          .from('ordenes_cobro')
          .select('id')
          .eq('suscripcion_id', sub.id)
          .eq('incidencia', true)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        // Pasamos a INACTIVO
        const { error: updateSubErr } = await supabase
          .from('suscripciones')
          .update({ estado: 'INACTIVO' })
          .eq('id', sub.id);

        if (updateSubErr) {
          console.error(`[CRON Verdugo] Error inactivando sub ${sub.id}:`, updateSubErr.message);
          continue;
        }

        if (ordenConIncidencia) {
          // Fallo Silencioso detectado
          await registrarEvento('suscripciones', sub.id, 'SUSCRIPCION_VENCIDA_CON_INCIDENCIA', {
            orden_id_asociada: ordenConIncidencia.id,
            motivo: 'Se inactiva pero requiere revisión manual de pagos incompletos'
          });
          inactivadasIncidencia++;
        } else {
          // Vencimiento normal por impago
          await registrarEvento('suscripciones', sub.id, 'SUSCRIPCION_VENCIDA', {
            motivo: 'Impago'
          });
          inactivadasNormal++;
        }
      } catch (err) {
        console.error(`[CRON Verdugo] Error fatal en iteración sub ${sub.id}:`, err);
      }
    }

    return NextResponse.json({
      message: 'CRON Verdugo ejecutado correctamente.',
      inactivadas_normales: inactivadasNormal,
      inactivadas_con_incidencia: inactivadasIncidencia
    }, { status: 200 });

  } catch (error: any) {
    console.error('[CRON Verdugo] Error interno:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
