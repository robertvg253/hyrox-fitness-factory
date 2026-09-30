import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { registrarEvento } from '@/src/services/logger';

export async function GET(request: Request) {
  // Verificación de seguridad básica para Vercel Cron
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Calcular la fecha límite (hace 72 horas)
    const limitDate = new Date();
    limitDate.setHours(limitDate.getHours() - 72);

    // Buscar órdenes en estado POR_CONCILIAR que tengan más de 72 horas
    const { data: ordenes, error: ordenesErr } = await supabase
      .from('ordenes_cobro')
      .select('id, suscripcion_id, metadata, created_at')
      .eq('estado', 'POR_CONCILIAR')
      .lt('created_at', limitDate.toISOString());

    if (ordenesErr) {
      console.error('[Centinela] Error buscando órdenes:', ordenesErr.message);
      return NextResponse.json({ error: 'Error buscando órdenes' }, { status: 500 });
    }

    if (!ordenes || ordenes.length === 0) {
      return NextResponse.json({ message: 'No hay órdenes excedidas (Timeout 72h).' });
    }

    let procesadas = 0;
    let errores = 0;

    for (const orden of ordenes) {
      try {
        const metadataActual = orden.metadata || {};
        const fechaCorteAnterior = metadataActual.fecha_corte_anterior;

        // Fallback: si no hay fecha_corte_anterior, usamos el de hoy o evitamos romper.
        const nuevaFechaCorte = fechaCorteAnterior || new Date().toISOString();

        // 1. Revertir la suscripción (Estado INACTIVO y rollback de fecha de corte)
        const { error: subErr } = await supabase
          .from('suscripciones')
          .update({
            estado: 'INACTIVO',
            fecha_corte: nuevaFechaCorte
          })
          .eq('id', orden.suscripcion_id);

        if (subErr) {
          throw new Error(`Error revirtiendo suscripción ${orden.suscripcion_id}: ${subErr.message}`);
        }

        // 2. Rechazar la orden
        const nuevaMetadata = {
          ...metadataActual,
          rechazado_por_nombre: 'Sistema Automático (Centinela)',
          motivo: 'Timeout 72h excedido',
          rechazado_en: new Date().toISOString()
        };

        const { error: ordenUpdateErr } = await supabase
          .from('ordenes_cobro')
          .update({
            estado: 'RECHAZADO',
            metadata: nuevaMetadata
          })
          .eq('id', orden.id);

        if (ordenUpdateErr) {
          throw new Error(`Error actualizando orden ${orden.id}: ${ordenUpdateErr.message}`);
        }

        // 3. Registrar en bitácora de auditoría
        await registrarEvento('ordenes_cobro', orden.id, 'CONCILIACION_RECHAZADA', {
          admin_nombre: 'Centinela Automático',
          motivo: 'Timeout 72h excedido',
          fecha_restaurada: nuevaFechaCorte
        });

        procesadas++;
      } catch (innerErr: any) {
        console.error(`[Centinela] Error procesando orden ${orden.id}:`, innerErr);
        errores++;
      }
    }

    return NextResponse.json({
      message: 'El Centinela terminó su patrullaje.',
      resultados: { procesadas, errores }
    });

  } catch (error: any) {
    console.error('[Centinela] Error crítico:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
