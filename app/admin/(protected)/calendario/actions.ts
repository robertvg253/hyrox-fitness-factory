'use server'

import { createClient } from '@/src/utils/supabase/server'
import { revalidatePath } from 'next/cache'

import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { generarIdentidadFantasma } from '@/src/utils/authHelpers'

export async function marcarAsistencia(reservaId: string, nuevoEstado: 'ASISTIDA' | 'AUSENTE') {
  const supabase = await createClient()

  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("No autenticado")

    // 1. Obtener la reserva actual
    const { data: reserva, error: errRes } = await supabase
      .from('reservas')
      .select('id, estado_reserva, asistio_fisicamente, usuario_id, es_clase_prueba, atleta:usuarios!usuario_id(suscripciones(id, estado, sesiones_restantes, planes(tipo)))')
      .eq('id', reservaId)
      .single()

    if (errRes || !reserva) throw new Error('No se encontró la reserva.')
    
    // Si el estado es el mismo, no hacer nada
    if (reserva.estado_reserva === nuevoEstado) return { success: true }

    // 2. Lógica del motor de consumo de sesiones (Torniquete)
    const suscripcionActiva = Array.isArray((reserva.atleta as any)?.suscripciones) 
      ? (reserva.atleta as any)?.suscripciones.find((s: any) => s.estado === 'ACTIVO' || s.estado === 'INACTIVO')
      : null;

    // Las clases de prueba gratuitas no consumen sesiones del usuario
    if (!reserva.es_clase_prueba && suscripcionActiva && suscripcionActiva.planes?.tipo === 'SESIONES') {
      let nuevasSesiones = suscripcionActiva.sesiones_restantes || 0
      let nuevoEstadoSub = suscripcionActiva.estado

      // Si estaba en estado neutro (ej. CONFIRMADA) y ahora se marca ASISTIDA o AUSENTE, se descuenta 1.
      // Si cambia entre ASISTIDA y AUSENTE, no se descuentan más sesiones porque ya se descontó.
      const yaEstabaProcesada = reserva.estado_reserva === 'ASISTIDA' || reserva.estado_reserva === 'AUSENTE'
      const procesandoAhora = nuevoEstado === 'ASISTIDA' || nuevoEstado === 'AUSENTE'

      if (!yaEstabaProcesada && procesandoAhora) {
        if (nuevasSesiones <= 0) {
           throw new Error('El usuario ya no tiene sesiones disponibles.')
        }
        nuevasSesiones -= 1
        if (nuevasSesiones === 0) nuevoEstadoSub = 'INACTIVO'
      }

      // Actualizar la suscripción solo si cambió la cantidad
      if (!yaEstabaProcesada && procesandoAhora) {
        const { error: errSub } = await supabase
          .from('suscripciones')
          .update({ 
            sesiones_restantes: nuevasSesiones,
            estado: nuevoEstadoSub 
          })
          .eq('id', suscripcionActiva.id)

        if (errSub) throw new Error('Error al actualizar las sesiones del plan.')
      }
    }

    // 3. Actualizar la reserva (Asistencia y Auditoría)
    const asistioFisicamente = nuevoEstado === 'ASISTIDA';
    
    const { error: errUpdate } = await supabase
      .from('reservas')
      .update({ 
        asistio_fisicamente: asistioFisicamente,
        estado_reserva: nuevoEstado,
        modificado_por: user.id,
        fecha_modificacion: new Date().toISOString()
      })
      .eq('id', reservaId)

    if (errUpdate) throw new Error('Error al actualizar la asistencia.')

    revalidatePath('/admin/calendario')
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

export async function buscarAtletasParaWalkIn(q: string) {
  const cleanQ = q?.trim()
  if (!cleanQ || cleanQ.length < 2) {
    return { success: true, data: [] }
  }

  const supabaseAdmin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    const { data, error } = await supabaseAdmin
      .from('usuarios')
      .select('id, nombre_completo, cedula_rif, suscripciones(id, estado)')
      .eq('rol', 'ATLETA')
      .or(`nombre_completo.ilike.%${cleanQ}%,cedula_rif.ilike.%${cleanQ}%`)
      .limit(8)

    if (error) {
      console.error('[buscarAtletasParaWalkIn] Error en consulta:', error)
      return { success: false, data: [], error: error.message }
    }

    return { success: true, data: data || [] }
  } catch (err: any) {
    console.error('[buscarAtletasParaWalkIn] Error catch:', err)
    return { success: false, data: [], error: err.message }
  }
}

export async function registrarWalkIn(claseId: string, usuarioId: string) {
  const supabaseAdmin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  try {
    // 1. Validar que el atleta esté activo
    const { data: usuario, error: userErr } = await supabaseAdmin
      .from('usuarios')
      .select('id, nombre_completo, suscripciones(id, estado)')
      .eq('id', usuarioId)
      .single()

    if (userErr || !usuario) {
      throw new Error('Atleta no encontrado.')
    }

    const subActiva = Array.isArray(usuario.suscripciones)
      ? usuario.suscripciones.find((s: any) => s.estado === 'ACTIVO')
      : null

    if (!subActiva) {
      throw new Error('El atleta se encuentra inactivo.')
    }

    // 2. Validar cupo
    const { data: clase } = await supabaseAdmin
      .from('clases_programadas')
      .select('aforo_maximo, reservas(id)')
      .eq('id', claseId)
      .single()
      
    if (clase) {
       const reservasActuales = clase.reservas?.length || 0
       if (reservasActuales >= clase.aforo_maximo) {
         throw new Error('La clase ha alcanzado su aforo máximo.')
       }
    }

    const { data: resData, error } = await supabaseAdmin.from('reservas').insert({
      clase_id: claseId,
      usuario_id: usuarioId,
      estado_reserva: 'CONFIRMADA',
      asistio_fisicamente: true,
      es_clase_prueba: false
    }).select('id').single()
    
    if (error) {
       if (error.code === '23505') throw new Error('El usuario ya está registrado en esta clase.')
       throw error
    }
    
    revalidatePath('/admin/calendario')
    return { success: true, reserva_id: resData?.id, reservaId: resData?.id }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

export async function registrarLeadYWalkIn(claseId: string, nombre: string, telefono: string, cedula: string, fechaNacimiento?: string) {
  const supabaseAdmin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    // 1. Validar cupo en la clase antes de crear al usuario
    const { data: clase, error: claseErr } = await supabaseAdmin
      .from('clases_programadas')
      .select('aforo_maximo, sede_id, reservas(id)')
      .eq('id', claseId)
      .single()
      
    if (claseErr) throw new Error('Error al validar la clase: ' + claseErr.message)

    if (clase) {
       const reservasActuales = clase.reservas?.length || 0
       if (reservasActuales >= clase.aforo_maximo) {
         return { success: false, error: 'La clase ha alcanzado su aforo máximo. No se puede registrar.' }
       }
    }

    const { emailFicticio, claveFicticia } = generarIdentidadFantasma(cedula);

    // 2. Crear usuario en auth.users
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: emailFicticio,
      password: claveFicticia,
      email_confirm: true,
      user_metadata: {
        name: nombre,
        role: 'ATLETA'
      }
    })

    if (authError || !authData.user) {
      console.error('[registrarLead] Error en auth:', authError)
      return { success: false, error: 'Error creando credenciales para el prospecto: ' + authError?.message }
    }

    const newUserId = authData.user.id

    // 3. Actualizar el perfil en public.usuarios (creado por el Trigger)
    const { error: errLead } = await supabaseAdmin.from('usuarios').upsert({
      id: newUserId,
      sede_id: clase?.sede_id || null,
      nombre_completo: nombre,
      telefono: telefono,
      cedula_rif: cedula,
      fecha_nacimiento: fechaNacimiento || null,
      email: emailFicticio,
      rol: 'ATLETA',
      etiqueta_lead: 'PRUEBA_PENDIENTE',
      migracion_pendiente: false,
      acepto_terminos: false
    })
    
    if (errLead) {
       console.error('[registrarLead] Error en public.usuarios:', errLead)
       await supabaseAdmin.auth.admin.deleteUser(newUserId)
       return { success: false, error: 'Error al registrar el perfil: ' + errLead.message }
    }

    // 4. Asignar el Plan "Clase de Prueba" (1 sesión)
    const { data: planData, error: planErr } = await supabaseAdmin
      .from('planes')
      .select('id, nombre')
      .eq('nombre', 'Clase de Prueba')
      .single()

    if (planErr || !planData) {
      console.error('[registrarLead] Error buscando plan:', planErr)
      // Continuamos pero loggeamos
    }

    let planNombre = 'Clase de Prueba'
    let createdSubId: string | null = null

    if (planData) {
      planNombre = planData.nombre
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 30)

      const { data: subData, error: subErr } = await supabaseAdmin.from('suscripciones').insert({
        usuario_id: newUserId,
        plan_id: planData.id,
        estado: 'ACTIVO',
        sesiones_restantes: 1,
        fecha_corte: expiresAt.toISOString(),
        metadata: {
          origen: 'walk_in_recepcion',
          tipo_cortesia: 'clase_de_prueba'
        }
      }).select('id').single()

      if (subErr) {
        console.error('[registrarLead] Error creando suscripción:', subErr)
        return { success: false, error: 'Error asignando plan: ' + subErr.message }
      }
      createdSubId = subData?.id || null
    }

    // 5. Registrar el walk-in (Reserva de la clase con Auto-Asistencia)
    const { data: resData, error: resError } = await supabaseAdmin.from('reservas').insert({
      clase_id: claseId,
      usuario_id: newUserId,
      estado_reserva: 'ASISTIDA',
      asistio_fisicamente: true,
      es_clase_prueba: true
    }).select('id').single()

    if (resError) {
      console.error('[registrarLead] Error creando reserva:', resError)
      return { success: false, error: 'Error al registrar la reserva del prospecto: ' + resError.message }
    }

    // 6. Deducción Inmediata de la Sesión consumida (REGLA: NO cambiar el estado, solo descontar sesión)
    if (createdSubId) {
      const { error: updateSubErr } = await supabaseAdmin
        .from('suscripciones')
        .update({ sesiones_restantes: 0 })
        .eq('id', createdSubId)

      if (updateSubErr) {
        console.error('[registrarLead] Error descontando sesión en suscripción:', updateSubErr)
      }
    }

    // Actualizar etiqueta del lead a asistida
    await supabaseAdmin
      .from('usuarios')
      .update({ etiqueta_lead: 'PRUEBA_ASISTIDA' })
      .eq('id', newUserId)

    revalidatePath('/admin/calendario')
    
    // Objeto integral del atleta generado para la UI (previene bug "Desconocido")
    const usuarioMapeado = {
      id: newUserId,
      nombre_completo: nombre,
      nombre: nombre,
      cedula_rif: cedula,
      telefono: telefono,
      email: emailFicticio,
      suscripciones: [
        {
          id: createdSubId,
          estado: 'ACTIVO',
          sesiones_restantes: 0,
          planes: { tipo: 'SESIONES', nombre: planNombre }
        }
      ]
    }

    const nuevaReserva = {
      id: resData?.id,
      clase_id: claseId,
      usuario_id: newUserId,
      estado_reserva: 'ASISTIDA',
      asistio_fisicamente: true,
      es_clase_prueba: true,
      nombre_completo: nombre,
      atleta: usuarioMapeado,
      usuario: usuarioMapeado,
      usuarios: usuarioMapeado
    }

    return { 
      success: true, 
      reserva_id: resData?.id,
      reservaId: resData?.id,
      usuarioGenerado: usuarioMapeado,
      atleta: usuarioMapeado,
      usuario: usuarioMapeado,
      usuarios: usuarioMapeado,
      reserva: nuevaReserva
    }
  } catch (err: any) {
    console.error('[registrarLead] Error catch:', err)
    return { success: false, error: err.message }
  }
}
