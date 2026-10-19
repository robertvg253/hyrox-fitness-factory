'use server'

import { createClient } from '@/src/utils/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

export async function activarPasePrueba({ fechaNacimiento, genero, password }: { fechaNacimiento: string, genero: string, password?: string }) {
  const supabase = await createClient()

  const supabaseAdmin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) throw new Error('No autorizado')

    // 1. Actualizar public.usuarios (via admin para evitar bloqueos de RLS)
    // etiqueta_lead = null indica onboarding completado (sale del flujo PRUEBA_PENDIENTE)
    const { error: updateError } = await supabaseAdmin
      .from('usuarios')
      .update({
        fecha_nacimiento: fechaNacimiento,
        genero: genero,
        acepto_terminos: true,
        etiqueta_lead: 'PRUEBA_PENDIENTE'
      })
      .eq('id', user.id)

    if (updateError) {
      console.error('[activarPasePrueba] Error al actualizar usuarios:', updateError)
      throw new Error('Error al actualizar el perfil: ' + updateError.message)
    }

    // 2. Actualizar la contraseña en auth.users
    if (password) {
      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(user.id, { password })
      if (authError) throw new Error('Error al asignar la contraseña de seguridad.')
    }

    // 3. Obtener el Plan "Clase de Prueba"
    const { data: planData, error: planError } = await supabase
      .from('planes')
      .select('id')
      .eq('nombre', 'Clase de Prueba')
      .single()
      
    if (planError || !planData) throw new Error('El plan "Clase de Prueba" no se encuentra configurado en el sistema.')
    
    const planId = planData.id

    // 4. Crear suscripción (pase de 30 días)
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 30)

    const payloadSuscripcion: any = {
      usuario_id: user.id,
      plan_id: planId,
      estado: 'ACTIVO',
      sesiones_restantes: 1,
      fecha_corte: expiresAt.toISOString()
    }

    const { error: subError } = await supabaseAdmin
      .from('suscripciones')
      .insert(payloadSuscripcion)

    if (subError) {
      console.error("ERROR REAL DE SUPABASE:", subError)
      throw new Error(subError.message || JSON.stringify(subError))
    }

    // 5. Re-autenticar al usuario para refrescar la cookie tras el cambio de clave
    if (password && user.email) {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: password
      })
      if (signInError) {
        console.error("ERROR AL RE-AUTENTICAR:", signInError)
      }
    }

    revalidatePath('/dashboard', 'layout')
    return { success: true }
  } catch (err: any) {
    console.error('[activarPasePrueba] Excepción capturada:', err)
    return { success: false, error: err.message || JSON.stringify(err) }
  }
}

export async function reservarClase(claseId: string, usuarioId: string) {
  const supabase = await createClient()

  try {
    // Validar aforo
    const { data: clase } = await supabase
      .from('clases_programadas')
      .select('aforo_maximo, reservas(id, estado_reserva)')
      .eq('id', claseId)
      .single()

    if (clase) {
      const reservasActivas = clase.reservas?.filter((r: any) => r.estado_reserva !== 'CANCELADA') || []
      if (reservasActivas.length >= clase.aforo_maximo) {
        throw new Error('Lo sentimos, esta clase ya no tiene cupos disponibles.')
      }
    }

    let isPrueba = false
    let subActivaId = null
    let currentSesiones = 0

    let isPlanIlimitado = false

    const { data: subActiva } = await supabase
      .from('suscripciones')
      .select('id, estado, sesiones_restantes, planes(nombre, tipo)')
      .eq('usuario_id', usuarioId)
      .in('estado', ['ACTIVO', 'INACTIVO'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (subActiva) {
       subActivaId = subActiva.id
       currentSesiones = subActiva.sesiones_restantes || 0
       const planesObj = Array.isArray(subActiva.planes) ? subActiva.planes[0] : subActiva.planes;
       isPlanIlimitado = (planesObj as any)?.tipo === 'TIEMPO'
       
       if (subActiva.estado !== 'ACTIVO') {
         throw new Error('Tu plan está inactivo. Renueva tu plan para seguir entrenando.')
       }

       if (!isPlanIlimitado && currentSesiones <= 0) {
         throw new Error('Has agotado tus sesiones. Renueva tu plan para seguir entrenando.')
       }

       if ((planesObj as any)?.nombre === 'Clase de Prueba') {
         isPrueba = true
       }
    } else {
       throw new Error('No tienes una suscripción vigente.')
    }

    const payload = {
      clase_id: claseId,
      usuario_id: usuarioId,
      estado_reserva: 'CONFIRMADA',
      es_clase_prueba: isPrueba
    }

    const { error } = await supabase.from('reservas').insert(payload)

    if (error) {
      if (error.code === '23505') throw new Error('Ya tienes una reserva para esta clase.')
      throw new Error(error.message)
    }

    if (subActivaId && !isPlanIlimitado) {
       const supabaseAdmin = createSupabaseClient(
         process.env.NEXT_PUBLIC_SUPABASE_URL!,
         process.env.SUPABASE_SERVICE_ROLE_KEY!
       )
       const { error: errSub } = await supabaseAdmin
         .from('suscripciones')
         .update({ sesiones_restantes: Math.max(0, currentSesiones - 1) })
         .eq('id', subActivaId)

       if (errSub) {
         console.error('Error descontando sesión:', errSub)
         // Opcional: Revertir reserva si esto falla, o simplemente registrarlo.
       }
    }

    // Backend Trigger A (Al Agendar):
    const { data: usuarioData } = await supabase
      .from('usuarios')
      .select('etiqueta_lead')
      .eq('id', usuarioId)
      .single()

    if (usuarioData?.etiqueta_lead === 'PRUEBA_PENDIENTE') {
      const supabaseAdmin = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )
      await supabaseAdmin
        .from('usuarios')
        .update({ etiqueta_lead: 'PRUEBA_RESERVADA' })
        .eq('id', usuarioId)
    }

    revalidatePath('/dashboard', 'layout')
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

export async function obtenerClasesSede(sedeId: string, dateStart: string, dateEnd: string) {
  try {
    const supabaseAdmin = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    
    const { data, error } = await supabaseAdmin
      .from('clases_programadas')
      .select('*, disciplinas(nombre, color_hex), instructores(nombre), reservas(id, usuario_id, estado_reserva)')
      .gte('fecha_hora_inicio', dateStart)
      .lte('fecha_hora_inicio', dateEnd)
      .eq('sede_id', sedeId)
      .order('fecha_hora_inicio', { ascending: true })

    if (error) throw error
    return { success: true, data }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

export async function obtenerPlanesSede(sedeId: string) {
  try {
    const supabaseAdmin = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: planes, error } = await supabaseAdmin
      .from('planes')
      .select('*')
      .gt('precio_usd', 0)
      .eq('estado', 'ACTIVO')
      .order('precio_usd', { ascending: true })

    if (error) throw error

    const planesDisponibles = planes.filter((plan: any) => {
      return plan.sedes && Array.isArray(plan.sedes) && plan.sedes.includes(sedeId)
    })

    return { success: true, data: planesDisponibles }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}
