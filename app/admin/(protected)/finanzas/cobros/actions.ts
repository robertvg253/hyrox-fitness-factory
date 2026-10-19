'use server'

import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/src/utils/supabase/server'

export async function getFinanzasData(sedeId: string, options?: any) {
  if (!sedeId) return { usuarios: [], ordenes: [], ordenesPorConciliar: [], totalPages: 0, currentPage: 1 }
  
  const {
    page = 1,
    pageSize = 25,
    searchNombre = '',
    searchReferencia = '',
    estado = 'TODOS',
    metodo = 'TODOS',
    minPrice = '',
    maxPrice = '',
    responsable = ''
  } = options || {}

  // Usamos el Service Role para bypassear RLS y obtener la data en el panel administrativo
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // 1. Obtener usuarios con sus suscripciones y planes
  const { data: usersData, error: usersErr } = await supabase
    .from('usuarios')
    .select('id, nombre_completo, cedula_rif, telefono, suscripciones(id, estado, planes(id, nombre, precio_usd, tipo, sesiones_total, sedes))')
    .order('nombre_completo')

  if (usersErr) {
    console.error('[Admin Finanzas] Error fetching usuarios:', usersErr)
  }

  // Mostrar usuarios filtrando por las sedes de su plan activo
  const usuariosList = (usersData || []).filter(u => {
    if (!u.suscripciones || (Array.isArray(u.suscripciones) ? u.suscripciones.length === 0 : false)) return true; // Show users without subscriptions so the modal can handle them with the "No subscription" error
    return u.suscripciones.some((sub: any) => {
      const sedes = sub.planes?.sedes;
      if (!sedes || sedes.length === 0) return true; // Asumimos globalidad si está vacío o null
      return sedes.includes(sedeId);
    });
  });

  // Límite histórico: 3 Meses
  const fechaHace3Meses = new Date()
  fechaHace3Meses.setMonth(fechaHace3Meses.getMonth() - 3)

  // 2. Obtener la bitácora evaluando sedes del plan y aplicando paginación y filtros
  let query = supabase
    .from('ordenes_cobro')
    .select('id, monto, moneda, estado, metadata, created_at, r4_transaction_id, r4_bank_reference, usuarios!inner(nombre_completo), suscripciones(planes(sedes))', { count: 'exact' })
    .gte('created_at', fechaHace3Meses.toISOString())
    .order('created_at', { ascending: false })

  if (estado !== 'TODOS') {
    if (estado === 'CONCILIADOS') query = query.in('estado', ['APROBADO', 'APROBADO AUTOMATICO'])
    else if (estado === 'POR_CONCILIAR') query = query.eq('estado', 'POR_CONCILIAR')
    else if (estado === 'RECHAZADO') query = query.in('estado', ['RECHAZADO', 'CANCELADO', 'EXPIRADO'])
  }

  if (metodo !== 'TODOS') {
    if (metodo === 'PAGO_MOVIL') query = query.or('metadata->>metodo_pago.ilike.PAGO_MOVIL,metadata->>provider.ilike.PAGO_MOVIL')
    else if (metodo === 'ZELLE') query = query.or('metadata->>metodo_pago.ilike.ZELLE,metadata->>provider.ilike.ZELLE')
    else if (metodo === 'EFECTIVO') query = query.eq('metadata->>metodo_pago', 'EFECTIVO')
    else if (metodo === 'POS') query = query.or('metadata->>metodo_pago.ilike.POS,metadata->>metodo_pago.ilike.PUNTO_VENTA')
    else if (metodo === 'COBRO_MOVIL') query = query.eq('metadata->>metodo_pago', 'COBRO_MOVIL')
    else if (metodo === 'MIXTO') query = query.eq('metadata->>metodo_pago', 'MIXTO')
  }

  if (minPrice !== '') {
    query = query.gte('monto', minPrice)
  }
  
  if (maxPrice !== '') {
    query = query.lte('monto', maxPrice)
  }

  if (responsable) {
    const term = `%${responsable.toLowerCase()}%`
    query = query.or(`metadata->>responsable_nombre.ilike.${term},metadata->>responsable_email.ilike.${term}`)
  }

  if (searchNombre) {
    const term = `%${searchNombre.toLowerCase()}%`
    query = query.ilike('usuarios.nombre_completo', term)
  }

  if (searchReferencia) {
    const ref = searchReferencia.trim();
    // PostgREST soporta ->> nativamente y * en lugar de % para evitar errores de parseo
    const orString = `r4_transaction_id.ilike.*${ref}*,r4_bank_reference.ilike.*${ref}*,metadata->>referencia.ilike.*${ref}*`;
    query = query.or(orString);
  }

  // Paginar
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  query = query.range(from, to)

  const { data: rawOrdersData, error: ordersErr, count } = await query

  if (ordersErr) {
    console.error('[Admin Finanzas] Error fetching ordenes_cobro:', ordersErr)
  }

  const ordersData = (rawOrdersData || []).filter((ord: any) => {
    const sedes = ord.suscripciones?.planes?.sedes;
    if (!sedes || sedes.length === 0) return true;
    return sedes.includes(sedeId);
  });

  const totalPages = Math.ceil((count || 0) / pageSize)

  // 3. Obtener pagos pendientes por conciliar
  const { data: rawConciliarData, error: conciliarErr } = await supabase
    .from('ordenes_cobro')
    .select('id, monto, moneda, estado, metadata, created_at, usuarios(nombre_completo, telefono), suscripciones(planes(sedes))')
    .eq('estado', 'POR_CONCILIAR')
    .gte('created_at', fechaHace3Meses.toISOString())
    .order('created_at', { ascending: false })

  if (conciliarErr) {
    console.error('[Admin Finanzas] Error fetching ordenes_por_conciliar:', conciliarErr)
  }

  const ordenesPorConciliar = (rawConciliarData || []).filter((ord: any) => {
    const sedes = ord.suscripciones?.planes?.sedes;
    if (!sedes || sedes.length === 0) return true;
    return sedes.includes(sedeId);
  });

  return {
    usuarios: usuariosList,
    ordenes: ordersData || [],
    ordenesPorConciliar,
    totalPages,
    currentPage: page
  }
}

export async function anularCobro(ordenId: string, motivo: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const supabaseAuth = await createServerClient()
  const { data: { user } } = await supabaseAuth.auth.getUser()

  if (!user) {
    return { success: false, error: 'No estás autorizado para realizar esta acción.' }
  }

  const { data: adminProfile } = await supabase
    .from('usuarios')
    .select('nombre_completo')
    .eq('id', user.id)
    .single()
    
  const adminName = adminProfile?.nombre_completo || user.email;

  const { data: orden, error: fetchErr } = await supabase
    .from('ordenes_cobro')
    .select('metadata, usuario_id, suscripcion_id, estado')
    .eq('id', ordenId)
    .single()

  if (fetchErr || !orden) {
    return { success: false, error: 'No se pudo encontrar la orden.' }
  }

  if (orden.estado !== 'APROBADO' && orden.estado !== 'APROBADO AUTOMATICO') {
    return { success: false, error: 'Solo se pueden anular órdenes aprobadas.' }
  }

  const newMetadata = {
    ...(orden.metadata || {}),
    anulacion: {
      responsable_nombre: adminName,
      responsable_email: user.email,
      fecha: new Date().toISOString(),
      motivo: motivo
    }
  }

  // Paso A y B: Actualizar estado de la orden y añadir notas
  const { error: updateErr } = await supabase
    .from('ordenes_cobro')
    .update({ 
      estado: 'ANULADO',
      metadata: newMetadata
    })
    .eq('id', ordenId)

  if (updateErr) {
    return { success: false, error: 'Fallo al actualizar el estado de la orden.' }
  }

  let resumen = 'Orden anulada y auditada correctamente.';

  // Paso C: Revertir fecha_corte
  const suscripcionId = orden.suscripcion_id;

  if (suscripcionId) {
    let fechaRevertida: Date;
    
    // Obtener la fecha y sesiones actuales de la suscripción de la base de datos
    const { data: subActual } = await supabase
      .from('suscripciones')
      .select('fecha_corte, sesiones_restantes, planes(tipo, sesiones_total)')
      .eq('id', suscripcionId)
      .single();

    if (orden.metadata?.fecha_corte_anterior) {
      fechaRevertida = new Date(orden.metadata.fecha_corte_anterior);
    } else {
      // Fallback Legacy: restar 1 mes a la fecha_corte actual
      if (subActual?.fecha_corte) {
        fechaRevertida = new Date(subActual.fecha_corte);
        fechaRevertida.setUTCMonth(fechaRevertida.getUTCMonth() - 1);
      } else {
        fechaRevertida = new Date(); // Fallback extremo
      }
    }

    const now = new Date();
    let nuevoEstado = fechaRevertida > now ? 'ACTIVO' : 'INACTIVO';
    
    const planesObj = Array.isArray(subActual?.planes) ? subActual?.planes[0] : subActual?.planes;
    const isSesiones = (planesObj as any)?.tipo === 'SESIONES';
    let sesionesRevertidas: number | null = null;
    
    if (isSesiones) {
      if (orden.metadata?.sesiones_anteriores !== undefined && orden.metadata?.sesiones_anteriores !== null) {
        sesionesRevertidas = orden.metadata.sesiones_anteriores;
      } else {
        // Fallback legacy
        const sesionesActuales = subActual?.sesiones_restantes || 0;
        const sesionesPlan = (planesObj as any)?.sesiones_total || 0;
        sesionesRevertidas = Math.max(0, sesionesActuales - sesionesPlan);
      }
      
      if ((sesionesRevertidas ?? 0) <= 0) {
        nuevoEstado = 'INACTIVO';
      }
    }

    const updatePayload: any = { 
      fecha_corte: fechaRevertida.toISOString(),
      estado: nuevoEstado
    };
    
    if (orden.metadata?.plan_id_anterior) {
      updatePayload.plan_id = orden.metadata.plan_id_anterior;
    }
    
    if (isSesiones && sesionesRevertidas !== null) {
      updatePayload.sesiones_restantes = sesionesRevertidas;
    }

    const { error: subErr } = await supabase
      .from('suscripciones')
      .update(updatePayload)
      .eq('id', suscripcionId);

    if (subErr) {
      resumen += ' (Ocurrió un problema al revertir la suscripción).';
    } else {
      resumen += ` La fecha de corte fue revertida a ${fechaRevertida.toLocaleDateString('es-VE')}.`;
      resumen += ` La suscripción se actualizó al estado ${nuevoEstado}.`;
    }
  } else {
    resumen += ' (La orden no estaba vinculada a una suscripción).';
  }

  return { success: true, summary: resumen }
}
