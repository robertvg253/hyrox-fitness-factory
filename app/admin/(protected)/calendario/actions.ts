'use server'

import { createClient } from '@/src/utils/supabase/server'
import { revalidatePath } from 'next/cache'

import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export async function toggleAsistencia(reservaId: string, asistio: boolean) {
  const supabase = await createClient()

  try {
    // 1. Obtener la reserva actual
    const { data: reserva, error: errRes } = await supabase
      .from('reservas')
      .select('id, estado_reserva, asistio_fisicamente, usuario_id, usuarios(suscripciones(id, estado, sesiones_restantes, planes(tipo)))')
      .eq('id', reservaId)
      .single()

    if (errRes || !reserva) throw new Error('No se encontró la reserva.')
    
    // Si el estado de asistencia es el mismo, no hacer nada
    const currentlyAsistio = reserva.asistio_fisicamente === true
    if (currentlyAsistio === asistio) return { success: true }

    // 2. Lógica del motor de consumo de sesiones (Torniquete)
    const suscripcionActiva = Array.isArray((reserva.usuarios as any)?.suscripciones) 
      ? (reserva.usuarios as any)?.suscripciones.find((s: any) => s.estado === 'ACTIVO' || s.estado === 'INACTIVO') // Asumimos la primera que aplique
      : null;

    if (suscripcionActiva && suscripcionActiva.planes?.tipo === 'SESIONES') {
      let nuevasSesiones = suscripcionActiva.sesiones_restantes || 0
      let nuevoEstado = suscripcionActiva.estado

      if (asistio) {
        // Al marcar asistencia, descontar una sesión
        if (nuevasSesiones <= 0) {
           throw new Error('El usuario ya no tiene sesiones disponibles.')
        }
        nuevasSesiones -= 1
        if (nuevasSesiones === 0) nuevoEstado = 'INACTIVO'
      } else {
        // Al desmarcar asistencia (revertir error), devolver la sesión
        nuevasSesiones += 1
        if (nuevoEstado === 'INACTIVO' && nuevasSesiones > 0) nuevoEstado = 'ACTIVO'
      }

      // Actualizar la suscripción
      const { error: errSub } = await supabase
        .from('suscripciones')
        .update({ 
          sesiones_restantes: nuevasSesiones,
          estado: nuevoEstado 
        })
        .eq('id', suscripcionActiva.id)

      if (errSub) throw new Error('Error al actualizar las sesiones del plan.')
    }

    // 3. Actualizar la reserva (Asistencia)
    const { error: errUpdate } = await supabase
      .from('reservas')
      .update({ asistio_fisicamente: asistio })
      .eq('id', reservaId)

    if (errUpdate) throw new Error('Error al actualizar la asistencia.')

    revalidatePath('/admin/calendario')
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

export async function registrarWalkIn(claseId: string, usuarioId: string) {
  const supabase = await createClient()
  try {
    // Validar cupo
    const { data: clase } = await supabase
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

    const { error } = await supabase.from('reservas').insert({
      clase_id: claseId,
      usuario_id: usuarioId,
      estado_reserva: 'CONFIRMADA',
      asistio_fisicamente: true,
      es_clase_prueba: false
    })
    
    if (error) {
       if (error.code === '23505') throw new Error('El usuario ya está registrado en esta clase.')
       throw error
    }
    
    revalidatePath('/admin/calendario')
    return { success: true }
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
      .select('aforo_maximo, reservas(id)')
      .eq('id', claseId)
      .single()
      
    if (claseErr) throw new Error('Error al validar la clase: ' + claseErr.message)

    if (clase) {
       const reservasActuales = clase.reservas?.length || 0
       if (reservasActuales >= clase.aforo_maximo) {
         return { success: false, error: 'La clase ha alcanzado su aforo máximo. No se puede registrar.' }
       }
    }

    const dummyEmail = `${cedula}@lead.local`
    const dummyPassword = `${cedula}Factory2026!`

    // 2. Crear usuario en auth.users
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: dummyEmail,
      password: dummyPassword,
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
      nombre_completo: nombre,
      telefono: telefono,
      cedula_rif: cedula,
      fecha_nacimiento: fechaNacimiento || null,
      email: dummyEmail,
      rol: 'ATLETA',
      etiqueta_lead: 'PRUEBA_PENDIENTE',
      migracion_pendiente: false
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

    let planNombre = 'Sin plan'
    if (planData) {
      planNombre = planData.nombre
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 30)

      const { error: subErr } = await supabaseAdmin.from('suscripciones').insert({
        usuario_id: newUserId,
        plan_id: planData.id,
        estado: 'ACTIVO',
        sesiones_restantes: 1,
        fecha_corte: expiresAt.toISOString()
      })
      if (subErr) {
        console.error('[registrarLead] Error creando suscripción:', subErr)
        return { success: false, error: 'Error asignando plan: ' + subErr.message }
      }
    }

    // 5. Registrar el walk-in (Reserva de la clase)
    const { error: resError } = await supabaseAdmin.from('reservas').insert({
      clase_id: claseId,
      usuario_id: newUserId,
      estado_reserva: 'CONFIRMADA',
      asistio_fisicamente: true,
      es_clase_prueba: true
    })

    if (resError) {
      console.error('[registrarLead] Error creando reserva:', resError)
      return { success: false, error: 'Error al registrar la reserva del prospecto: ' + resError.message }
    }

    revalidatePath('/admin/calendario')
    
    // Devolver objeto de usuario generado para la UI
    return { 
      success: true, 
      usuarioGenerado: {
        id: newUserId,
        nombre_completo: nombre,
        cedula_rif: cedula,
        telefono: telefono,
        email: dummyEmail,
        suscripciones: [{ estado: 'ACTIVO', sesiones_restantes: 1, planes: { nombre: planNombre } }]
      }
    }
  } catch (err: any) {
    console.error('[registrarLead] Error catch:', err)
    return { success: false, error: err.message }
  }
}
