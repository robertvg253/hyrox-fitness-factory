import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/src/utils/supabase/server';
import { EstadoOrden, EstadoSuscripcion } from '@/src/types';
import { registrarEvento } from '@/src/services/logger';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { orden_id, accion } = body;

    // 1. Validaciones básicas
    if (!orden_id || !accion) {
      return NextResponse.json({ error: 'Faltan campos obligatorios (orden_id, accion)' }, { status: 400 });
    }

    if (accion !== 'APROBAR' && accion !== 'RECHAZAR') {
      return NextResponse.json({ error: 'Acción inválida. Debe ser APROBAR o RECHAZAR' }, { status: 400 });
    }

    // Obtener sesión del usuario (Admin)
    const serverSupabase = await createServerClient();
    const { data: { session } } = await serverSupabase.auth.getSession();
    
    const adminIdReal = session?.user?.id || 'sin-id';
    const adminNombreReal = session?.user?.user_metadata?.name || session?.user?.email || 'Administrador Desconocido';

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Paso A: Consulta la orden_cobro
    const { data: orden, error: ordenErr } = await supabase
      .from('ordenes_cobro')
      .select('id, estado, suscripcion_id, metadata, usuario_id')
      .eq('id', orden_id)
      .single();

    if (ordenErr || !orden) {
      console.error('[Conciliar] Error buscando orden:', ordenErr?.message);
      return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 });
    }

    if (orden.estado !== 'POR_CONCILIAR') {
      return NextResponse.json({ error: `La orden no está en estado POR_CONCILIAR (Actual: ${orden.estado})` }, { status: 400 });
    }

    const timestamp = new Date().toISOString();
    const metadataActual = orden.metadata || {};

    if (accion === 'APROBAR') {
      // Paso B: Aprobar la orden
      const nuevaMetadata = {
        ...metadataActual,
        conciliado_por: adminIdReal,
        conciliado_por_nombre: adminNombreReal,
        conciliado_en: timestamp
      };

      const { error: updateOrdenErr } = await supabase
        .from('ordenes_cobro')
        .update({
          estado: 'APROBADO' as EstadoOrden,
          metadata: nuevaMetadata
        })
        .eq('id', orden_id);

      if (updateOrdenErr) {
        throw new Error('Error al actualizar estado de la orden a APROBADO: ' + updateOrdenErr.message);
      }

      await registrarEvento('ordenes_cobro', orden_id, 'CONCILIACION_APROBADA', { 
        admin_id: adminIdReal, 
        admin_nombre: adminNombreReal 
      });

      return NextResponse.json({ message: 'Orden conciliada y APROBADA exitosamente' }, { status: 200 });

    } else if (accion === 'RECHAZAR') {
      // Paso C: Rechazar la orden y hacer Rollback a la suscripción
      const fechaCorteAnterior = metadataActual.fecha_corte_anterior;

      if (!fechaCorteAnterior) {
        throw new Error('No se puede hacer rollback: fecha_corte_anterior no encontrada en metadata de la orden.');
      }

      // 1. Rollback a la suscripción
      const { error: subRollbackErr } = await supabase
        .from('suscripciones')
        .update({
          estado: 'INACTIVO' as EstadoSuscripcion,
          fecha_corte: fechaCorteAnterior
        })
        .eq('id', orden.suscripcion_id);

      if (subRollbackErr) {
        throw new Error('Error al hacer rollback de la suscripción: ' + subRollbackErr.message);
      }

      // 2. Actualizar estado de la orden a RECHAZADO
      const nuevaMetadata = {
        ...metadataActual,
        rechazado_por: adminIdReal,
        rechazado_por_nombre: adminNombreReal,
        rechazado_en: timestamp
      };

      const { error: updateOrdenErr } = await supabase
        .from('ordenes_cobro')
        .update({
          estado: 'RECHAZADO' as EstadoOrden,
          metadata: nuevaMetadata
        })
        .eq('id', orden_id);

      if (updateOrdenErr) {
        // En este punto, hubo inconsistencia porque se revirtió la sub, pero falló la orden.
        console.error(`[CRÍTICO] Inconsistencia en Rechazo. Orden: ${orden_id}`);
        throw new Error('Error actualizando la orden tras hacer rollback de la suscripción: ' + updateOrdenErr.message);
      }

      await registrarEvento('ordenes_cobro', orden_id, 'CONCILIACION_RECHAZADA', { 
        admin_id: adminIdReal, 
        admin_nombre: adminNombreReal, 
        fecha_restaurada: fechaCorteAnterior 
      });

      return NextResponse.json({ message: 'Orden RECHAZADA y suscripción revertida exitosamente' }, { status: 200 });
    }

  } catch (error: any) {
    console.error('[Conciliar] Error interno:', error);
    return NextResponse.json({ error: error.message || 'Error interno del servidor' }, { status: 500 });
  }
}
