import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/src/utils/supabase/server';
import { getCaracasMidnightUTC } from '@/src/utils/timezone';
import { EstadoOrden, MetodoPago, MetadataOrden } from '@/src/types';
import { registrarEvento } from '@/src/services/logger';
import { emitirCobroR4 } from '@/src/services/r4-service';

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get('content-type') || '';
    let body: any = {};
    let fileBuffer: Buffer | null = null;
    let fileName = '';
    let fileType = '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      body = {
        suscripcion_id: formData.get('suscripcion_id'),
        usuario_id: formData.get('usuario_id'),
        plan_id: formData.get('plan_id'),
        monto: formData.get('monto'),
        metodo_pago: formData.get('metodo_pago'),
        referencia: formData.get('referencia'),
        responsable_id: formData.get('responsable_id'),
        responsable_nombre: formData.get('responsable_nombre'),
        origin: formData.get('origin'),
      };
      const pd = formData.get('pagos_desglosados');
      if (pd) body.pagos_desglosados = JSON.parse(pd as string);

      const file = formData.get('comprobante') as File | null;
      if (file && file.size > 0) {
        fileName = Date.now() + '-' + file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        fileType = file.type;
        const arrayBuffer = await file.arrayBuffer();
        fileBuffer = Buffer.from(arrayBuffer);
      }
    } else {
      body = await request.json();
    }

    const {
      suscripcion_id,
      usuario_id,
      plan_id,
      monto,
      metodo_pago,
      referencia,
      pagos_desglosados,
      responsable_id,
      responsable_nombre,
      origin
    } = body;

    // Validaciones básicas
    const isFlujoNueva = !suscripcion_id || suscripcion_id === 'undefined';
    
    if (isFlujoNueva && (!usuario_id || !plan_id)) {
      return NextResponse.json({ error: 'Faltan campos para crear nueva suscripción (usuario_id, plan_id)' }, { status: 400 });
    }

    if (!isFlujoNueva && !suscripcion_id) {
       return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 });
    }
    
    if (!monto || !metodo_pago || !responsable_id || !responsable_nombre) {
      return NextResponse.json({ error: 'Faltan campos obligatorios de pago' }, { status: 400 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Auditoría: Obtener identidad real
    const supabaseAuth = await createServerClient();
    const { data: { user } } = await supabaseAuth.auth.getUser();

    let realResponsableId = responsable_id;
    let realResponsableNombre = responsable_nombre;
    let realResponsableEmail = 'desconocido@sistema.local';

    if (user) {
      realResponsableId = user.id;
      realResponsableEmail = user.email || 'desconocido@sistema.local';
      
      const { data: adminProfile } = await supabaseAdmin
        .from('usuarios')
        .select('nombre_completo')
        .eq('id', user.id)
        .single();
        
      realResponsableNombre = adminProfile?.nombre_completo || user.email;
    }

    // Flujo Inteligente: Si no nos pasan suscripcion_id, intentamos buscar si el usuario ya tiene una
    let suscripcionDb = null;
    if (!isFlujoNueva) {
      const { data: subDb, error: subError } = await supabaseAdmin
        .from('suscripciones')
        .select('id, usuario_id, plan_id, fecha_corte, estado, sesiones_restantes, metadata, planes(tipo, sesiones_total, nombre, precio_usd)')
        .eq('id', suscripcion_id)
        .single();

      if (subError || !subDb) {
        console.error('[Cobro Manual] Error buscando suscripción por ID:', subError?.message);
        return NextResponse.json({ error: 'Suscripción no encontrada' }, { status: 404 });
      }
      suscripcionDb = subDb;
    } else {
      // Buscar si el usuario ya tiene una suscripcion (aunque sea inactiva)
      const { data: existingSub } = await supabaseAdmin
        .from('suscripciones')
        .select('id, usuario_id, plan_id, fecha_corte, estado, sesiones_restantes, metadata, planes(tipo, sesiones_total, nombre, precio_usd)')
        .eq('usuario_id', usuario_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingSub) {
        suscripcionDb = existingSub;
      }
    }

    let suscripcion: any = null;
    
    if (suscripcionDb) {
      suscripcion = suscripcionDb;
    } else {
      // Flujo A: Crear la suscripción de forma transparente si realmente no existe ninguna
      const { data: planData, error: planErr } = await supabaseAdmin
        .from('planes')
        .select('tipo, sesiones_total')
        .eq('id', plan_id)
        .single();
        
      if (planErr || !planData) {
        return NextResponse.json({ error: 'Plan no encontrado para la nueva suscripción' }, { status: 404 });
      }

      const { data: newSub, error: createSubErr } = await supabaseAdmin
        .from('suscripciones')
        .insert({
          usuario_id,
          plan_id,
          estado: 'INACTIVO',
          fecha_corte: getCaracasMidnightUTC(0).toISOString(),
          sesiones_restantes: planData.tipo === 'SESIONES' ? 0 : null
        })
        .select('id, usuario_id, plan_id, fecha_corte, estado, sesiones_restantes, metadata, planes(tipo, sesiones_total, nombre, precio_usd)')
        .single();
        
      if (createSubErr || !newSub) {
         console.error('[Cobro Manual] Error creando suscripción base:', createSubErr?.message);
         return NextResponse.json({ error: 'Fallo al crear la suscripción inicial' }, { status: 500 });
      }
      suscripcion = newSub;
    }

    const fechaCorteAnterior = suscripcion.fecha_corte 
      ? new Date(suscripcion.fecha_corte) 
      : getCaracasMidnightUTC(0);
      
    // Detectar si hay COBRO_MOVIL involucrado
    const isCobroMovilUnico = metodo_pago === 'COBRO_MOVIL';
    const cobroMovilDesglosado = pagos_desglosados?.find((p: any) => p.metodo === 'COBRO_MOVIL');
    const isCobroMovilMixto = metodo_pago === 'MIXTO' && !!cobroMovilDesglosado;
    const hasCobroMovil = isCobroMovilUnico || isCobroMovilMixto;
    
    // Obtener datos del usuario si se necesita R4
    let usuario: any = null;
    if (hasCobroMovil) {
      const { data: userData, error: userErr } = await supabaseAdmin
        .from('usuarios')
        .select('nombre_completo, cedula_rif, telefono')
        .eq('id', suscripcion.usuario_id)
        .single();
        
      if (userErr || !userData || !userData.telefono || !userData.cedula_rif) {
        return NextResponse.json({ error: 'El usuario no tiene teléfono o cédula registrados para el Cobro Móvil.' }, { status: 400 });
      }
      usuario = userData;
    }
    
    // Paso A (Búsqueda de Deuda)
    const hoy = getCaracasMidnightUTC(0);
    const hace7Dias = new Date(hoy.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    
    const { data: ordenFallida } = await supabaseAdmin
      .from('ordenes_cobro')
      .select('created_at')
      .eq('usuario_id', suscripcion.usuario_id)
      .in('estado', ['RECHAZADO', 'ANULADA', 'CANCELADO']) // Agregados posibles estados
      .gte('created_at', hace7Dias)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Paso B (Definición de fechaBase)
    let fechaBase = new Date(fechaCorteAnterior);

    // Detección de Clase de Prueba
    const planesAnterior = Array.isArray(suscripcion.planes) ? suscripcion.planes[0] : suscripcion.planes;
    const isPlanAnteriorPrueba = planesAnterior && (
      (planesAnterior as any).precio_usd === 0 || 
      (planesAnterior as any).nombre?.toLowerCase().includes('prueba')
    );

    if (ordenFallida && ordenFallida.created_at) {
      // Condición 1 (Viene de un pago fallido reciente)
      fechaBase = new Date(ordenFallida.created_at);
    } else if (isPlanAnteriorPrueba) {
      // Condición 2 (Transición de Clase de Prueba)
      fechaBase = new Date(hoy);
    } else if (fechaCorteAnterior < hoy) {
      // Condición 3 (Renovación normal vencida)
      fechaBase = new Date(hoy);
    }

    let nuevaFechaCorte = new Date(fechaBase);
    
    // Sumamos 1 mes
    nuevaFechaCorte.setUTCMonth(nuevaFechaCorte.getUTCMonth() + 1);

    // PRIMERO: Inserta un nuevo registro en ordenes_cobro
    const planesObj = Array.isArray(suscripcion.planes) ? suscripcion.planes[0] : suscripcion.planes;
    const isSesiones = (planesObj as any)?.tipo === 'SESIONES';
    
    const metadata: MetadataOrden = {
      origin: origin === 'self-service' ? 'self-service' : 'recepcion-manual',
      timestamp: new Date().toISOString(),
      responsable_id: realResponsableId,
      responsable_nombre: realResponsableNombre,
      responsable_email: realResponsableEmail,
      metodo_pago: metodo_pago as MetodoPago,
      referencia: referencia || undefined,
      pagos_desglosados: pagos_desglosados || undefined,
      fecha_corte_anterior: suscripcion.fecha_corte || undefined, // Guardar el string ISO original
      fecha_base_calculo: fechaBase.toISOString(), // Snapshot de la fecha de anclaje utilizada
      plan_id_anterior: suscripcion.plan_id || undefined,
      ...(isSesiones ? { sesiones_anteriores: suscripcion.sesiones_restantes || 0 } : {})
    };

    // Subida de imagen si existe comprobante
    if (fileBuffer) {
      try {
        const { error: uploadError } = await supabaseAdmin.storage
          .from('comprobantes')
          .upload(fileName, fileBuffer, { contentType: fileType });
          
        if (!uploadError) {
          const { data: { publicUrl } } = supabaseAdmin.storage
            .from('comprobantes')
            .getPublicUrl(fileName);
          metadata.comprobante_url = publicUrl;
        } else {
          console.error('[Cobro Manual] Error subiendo comprobante:', uploadError.message);
        }
      } catch (err) {
        console.error('[Cobro Manual] Error subiendo comprobante:', err);
      }
    }

    const estadoOrden: EstadoOrden = hasCobroMovil ? 'PENDIENTE' : 'POR_CONCILIAR';

    const { data: nuevaOrden, error: ordenError } = await supabaseAdmin
      .from('ordenes_cobro')
      .insert({
        suscripcion_id: suscripcion.id,
        usuario_id: suscripcion.usuario_id,
        monto: Number(monto),
        moneda: 'USD',
        estado: estadoOrden,
        metadata: { ...metadata, provider: hasCobroMovil ? (isCobroMovilMixto ? 'MIXTO_R4' : 'R4') : 'MANUAL' },
      })
      .select('id')
      .single();

    if (ordenError) {
      console.error('[Cobro Manual] Error creando orden:', ordenError.message);
      throw new Error('Error creando la orden de cobro: ' + ordenError.message);
    }

    // SEGUNDO: Actualización Optimista a la Suscripción
    const payloadSubUpdate: any = {
      plan_id: plan_id,
      estado: 'ACTIVO',
      fecha_corte: nuevaFechaCorte.toISOString(),
      metadata: suscripcion.metadata || {}
    };
    
    if (isSesiones) {
      const sesionesActuales = suscripcion.sesiones_restantes || 0;
      const sesionesDelPlan = (planesObj as any)?.sesiones_total || (planesObj as any)?.sesiones || 0;
      payloadSubUpdate.sesiones_restantes = sesionesActuales + sesionesDelPlan;
      
      // Sello Explícito: Si tiene clases de sobra, guardamos cuándo se las vamos a recortar (en su antigua fecha_corte)
      if (sesionesActuales > 0 && fechaCorteAnterior >= hoy) {
        payloadSubUpdate.metadata.recortar_sesiones_el = fechaCorteAnterior.toISOString();
      }
    } else {
      payloadSubUpdate.sesiones_restantes = null;
    }

    const performOptimisticUpdate = async () => {
      const { error: updateSubError } = await supabaseAdmin
        .from('suscripciones')
        .update(payloadSubUpdate)
        .eq('id', suscripcion.id);
      
      if (updateSubError) {
        console.error('[Cobro Manual] Error actualizando suscripción optimista:', updateSubError.message);
        throw new Error('Error actualizando la suscripción');
      }

    };

    if (hasCobroMovil) {
      // 1. Invocar a R4
      const montoR4 = isCobroMovilMixto ? cobroMovilDesglosado.monto : Number(monto);
      
      const r4Result = await emitirCobroR4({
        monto: Number(montoR4),
        nombre: usuario.nombre_completo,
        cedula: usuario.cedula_rif,
        telefono: usuario.telefono,
        order_id: nuevaOrden.id,
      });

      if (r4Result.success) {
        await supabaseAdmin
          .from('ordenes_cobro')
          .update({
            estado: 'ENVIADO',
            r4_transaction_id: r4Result.transaction_id ?? null,
            metadata: {
              ...metadata,
              provider: isCobroMovilMixto ? 'MIXTO_R4' : 'R4',
              r4_raw: r4Result.raw,
            },
          })
          .eq('id', nuevaOrden.id);

        await performOptimisticUpdate();

        await registrarEvento('ordenes_cobro', nuevaOrden.id, 'EMISION_COBRO', {
          nota: 'Cobro Móvil enviado a R4 (Tiempo Otorgado Optimistamente)',
          monto_r4: montoR4,
          transaction_id: r4Result.transaction_id
        });

        return NextResponse.json({
          message: 'Instrucción de Cobro Móvil enviada. Esperando confirmación.',
          orden_id: nuevaOrden.id,
        }, { status: 200 });
      } else {
        await supabaseAdmin
          .from('ordenes_cobro')
          .update({
            estado: 'ERROR',
            metadata: { ...metadata, r4_error: r4Result.error, r4_raw: r4Result.raw },
          })
          .eq('id', nuevaOrden.id);

        return NextResponse.json({ error: 'Error del servicio R4', details: r4Result.error }, { status: 502 });
      }
    } else {
      // SEGUNDO: Si no hay R4, actualiza la tabla suscripciones inmediatamente (Estado de Gracia puro)
      await performOptimisticUpdate();

      await registrarEvento('ordenes_cobro', nuevaOrden.id, 'PAGO_REGISTRADO' as any, {
        nota: 'Pago manual procesado por recepción (Tiempo Otorgado Optimistamente)',
        metodo_pago,
        responsable_nombre: realResponsableNombre
      });

      return NextResponse.json({
        message: 'Cobro manual registrado exitosamente (Estado de Gracia)',
        orden_id: nuevaOrden.id,
      }, { status: 200 });
    }

  } catch (error: any) {
    console.error('[Cobro Manual] Error interno:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
