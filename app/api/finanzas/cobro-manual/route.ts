import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getCaracasMidnightUTC } from '@/src/utils/timezone';
import { EstadoOrden, MetodoPago, MetadataOrden } from '@/src/types';
import { registrarEvento } from '@/src/services/logger';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      suscripcion_id,
      monto,
      metodo_pago,
      referencia,
      pagos_desglosados,
      responsable_id,
      responsable_nombre
    } = body;

    // Validaciones básicas
    if (!suscripcion_id || !monto || !metodo_pago || !responsable_id || !responsable_nombre) {
      return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Paso A: Consulta la suscripción actual
    const { data: suscripcion, error: subError } = await supabase
      .from('suscripciones')
      .select('id, usuario_id, fecha_corte, estado')
      .eq('id', suscripcion_id)
      .single();

    if (subError || !suscripcion) {
      console.error('[Cobro Manual] Error buscando suscripción:', subError?.message);
      return NextResponse.json({ error: 'Suscripción no encontrada' }, { status: 404 });
    }

    const fechaCorteAnterior = suscripcion.fecha_corte 
      ? new Date(suscripcion.fecha_corte) 
      : getCaracasMidnightUTC(0);
    
    // Paso B (Time-Stacking): Calcula la nueva fecha de corte
    const hoy = getCaracasMidnightUTC(0);
    let nuevaFechaCorte = new Date(fechaCorteAnterior);

    // Si la fecha_corte_anterior ya pasó (está vencido), sumamos al día de hoy.
    // Si no ha pasado (renovación anticipada), sumamos a la fecha_corte_anterior.
    if (fechaCorteAnterior < hoy) {
      nuevaFechaCorte = new Date(hoy);
    }
    
    // Sumamos 1 mes
    nuevaFechaCorte.setUTCMonth(nuevaFechaCorte.getUTCMonth() + 1);

    // PRIMERO: Inserta un nuevo registro en ordenes_cobro
    const metadata: MetadataOrden = {
      origin: 'recepcion-manual',
      timestamp: new Date().toISOString(),
      responsable_id,
      responsable_nombre,
      metodo_pago: metodo_pago as MetodoPago,
      referencia: referencia || undefined,
      pagos_desglosados: pagos_desglosados || undefined,
      fecha_corte_anterior: suscripcion.fecha_corte || undefined, // Guardar el string ISO original
    };

    const estadoOrden: EstadoOrden = 'POR_CONCILIAR';

    const { data: nuevaOrden, error: ordenError } = await supabase
      .from('ordenes_cobro')
      .insert({
        suscripcion_id: suscripcion.id,
        usuario_id: suscripcion.usuario_id, // Asumiendo que la tabla tiene este campo
        monto: Number(monto),
        moneda: 'USD',
        estado: estadoOrden,
        metadata: { ...metadata, provider: 'MANUAL' },
      })
      .select('id')
      .single();

    if (ordenError) {
      console.error('[Cobro Manual] Error creando orden:', ordenError.message);
      // Detenemos el flujo lanzando el error. La suscripción NO se actualiza.
      throw new Error('Error creando la orden de cobro: ' + ordenError.message);
    }

    // SEGUNDO: Solo si el INSERT fue exitoso, actualiza la tabla suscripciones
    const { error: updateSubError } = await supabase
      .from('suscripciones')
      .update({
        estado: 'ACTIVO',
        fecha_corte: nuevaFechaCorte.toISOString(),
      })
      .eq('id', suscripcion.id);

    if (updateSubError) {
      console.error('[Cobro Manual] Error actualizando suscripción (Inconsistencia leve):', updateSubError.message);
      return NextResponse.json({ error: 'Error actualizando la suscripción tras crear orden' }, { status: 500 });
    }

    // Log opcional para auditoría de sistema
    await registrarEvento('ordenes_cobro', nuevaOrden.id, 'PAGO_APROBADO', {
      nota: 'Pago manual procesado por recepción',
      metodo_pago,
      responsable_nombre
    });

    return NextResponse.json({
      message: 'Cobro manual registrado exitosamente (Estado de Gracia)',
      orden_id: nuevaOrden.id,
      nueva_fecha_corte: nuevaFechaCorte.toISOString(),
    }, { status: 200 });

  } catch (error: any) {
    console.error('[Cobro Manual] Error interno:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
