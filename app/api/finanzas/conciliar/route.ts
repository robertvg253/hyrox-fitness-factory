import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/src/utils/supabase/server';
import { EstadoOrden, EstadoSuscripcion } from '@/src/types';
import { registrarEvento } from '@/src/services/logger';
import { getCaracasMidnightUTC } from '@/src/utils/timezone';

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
      .select('id, estado, suscripcion_id, metadata, usuario_id, suscripciones(plan_id, fecha_corte, sesiones_restantes, planes(tipo, sesiones_total))')
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
        admin_nombre: adminNombreReal,
        nota: 'Conciliación aprobada (el tiempo fue otorgado en la emisión)'
      });

      // Backend Trigger B (Al Aprobar Pago / Convertir)
      if (orden.usuario_id) {
        await supabase
          .from('usuarios')
          .update({ etiqueta_lead: 'CONVERTIDO' })
          .eq('id', orden.usuario_id);
      }

      return NextResponse.json({ message: 'Orden conciliada y APROBADA exitosamente.' }, { status: 200 });

    } else if (accion === 'RECHAZAR') {
      // Paso C: Rechazar la orden y hacer Rollback a la suscripción
      let fechaRevertida: Date;

      if (metadataActual.fecha_corte_anterior) {
        fechaRevertida = new Date(metadataActual.fecha_corte_anterior);
      } else {
        // Fallback Legacy
        const { data: subActual } = await supabase
          .from('suscripciones')
          .select('fecha_corte')
          .eq('id', orden.suscripcion_id)
          .single();
          
        if (subActual?.fecha_corte) {
          fechaRevertida = new Date(subActual.fecha_corte);
          fechaRevertida.setUTCMonth(fechaRevertida.getUTCMonth() - 1);
        } else {
          fechaRevertida = new Date();
        }
      }

      const now = new Date();
      let nuevoEstado = fechaRevertida > now ? 'ACTIVO' : 'INACTIVO';

      const subsObj = Array.isArray(orden.suscripciones) ? orden.suscripciones[0] : orden.suscripciones;
      const planesObj = Array.isArray((subsObj as any)?.planes) ? (subsObj as any)?.planes[0] : (subsObj as any)?.planes;
      const isSesiones = (planesObj as any)?.tipo === 'SESIONES';
      let sesionesRevertidas: number | null = null;
      
      if (isSesiones) {
        if (metadataActual.sesiones_anteriores !== undefined && metadataActual.sesiones_anteriores !== null) {
          sesionesRevertidas = metadataActual.sesiones_anteriores;
        } else {
          // Fallback legacy sesiones
          const sesionesActuales = (subsObj as any)?.sesiones_restantes || 0;
          const sesionesPlan = (planesObj as any)?.sesiones_total || 0;
          sesionesRevertidas = Math.max(0, sesionesActuales - sesionesPlan);
        }
        
        if ((sesionesRevertidas ?? 0) <= 0) {
          nuevoEstado = 'INACTIVO';
        }
      }

      const payloadRollback: any = {
        estado: nuevoEstado as EstadoSuscripcion,
        fecha_corte: fechaRevertida.toISOString()
      };
      
      if (metadataActual.plan_id_anterior) {
        payloadRollback.plan_id = metadataActual.plan_id_anterior;
      }
      
      if (isSesiones && sesionesRevertidas !== null) {
        payloadRollback.sesiones_restantes = sesionesRevertidas;
      }

      // 1. Rollback a la suscripción
      const { error: subRollbackErr } = await supabase
        .from('suscripciones')
        .update(payloadRollback)
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
        fecha_restaurada: fechaRevertida.toISOString() 
      });

      return NextResponse.json({ message: 'Orden RECHAZADA y suscripción revertida exitosamente' }, { status: 200 });
    }

  } catch (error: any) {
    console.error('[Conciliar] Error interno:', error);
    return NextResponse.json({ error: error.message || 'Error interno del servidor' }, { status: 500 });
  }
}
