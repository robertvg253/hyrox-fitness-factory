'use server'

import { createClient as createAdminClient } from '@supabase/supabase-js'
import { Categoria, Preinscripcion, Simulacion } from '@/src/types'

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

/**
 * Paso 1 de Activación: Verifica si existe una preinscripción activa (no reclamada) para el email
 */
export async function verificarPreinscripcion(email: string): Promise<{
  success: boolean
  error?: string
  preinscripcion?: Preinscripcion
  categoria?: Categoria | null
  simulacion?: Simulacion | null
}> {
  const supabaseAdmin = getAdminClient()
  const emailLimpio = email.trim().toLowerCase()

  if (!emailLimpio || !emailLimpio.includes('@')) {
    return { success: false, error: 'Por favor ingresa un correo electrónico válido.' }
  }

  try {
    // 1. Consultar estrictamente en public.preinscripciones con email = inputEmail AND reclamado = false
    const { data: preList, error: preErr } = await supabaseAdmin
      .from('preinscripciones')
      .select('id, email, nombres, categoria_id, partner_email, partner_nombres, reclamado, creado_en')
      .ilike('email', emailLimpio)
      .eq('reclamado', false)
      .order('creado_en', { ascending: false })
      .limit(1)

    if (preErr) {
      console.error('[verificarPreinscripcion] Error DB:', preErr)
      return { success: false, error: 'Error consultando la lista de preinscripciones.' }
    }

    if (!preList || preList.length === 0) {
      return {
        success: false,
        error: 'Tu correo no figura en la lista de preinscritos o ya fue reclamado.'
      }
    }

    const pre = preList[0] as Preinscripcion

    // 2. Obtener datos de la categoría asignada
    let categoria: Categoria | null = null
    if (pre.categoria_id) {
      const { data: catData } = await supabaseAdmin
        .from('categorias')
        .select('id, nombre, tipo, genero')
        .eq('id', pre.categoria_id)
        .maybeSingle()
      if (catData) {
        categoria = catData as Categoria
      }
    }

    // 3. Obtener datos de la simulación activa
    const { data: simData } = await supabaseAdmin
      .from('simulaciones')
      .select('id, nombre, estado, tabla_liberada, heats_liberados, fecha_creacion')
      .order('fecha_creacion', { ascending: false })
      .limit(1)
      .maybeSingle()

    return {
      success: true,
      preinscripcion: pre,
      categoria,
      simulacion: simData as Simulacion | null
    }
  } catch (err: any) {
    console.error('[verificarPreinscripcion] Excepción:', err)
    return { success: false, error: err.message || 'Error inesperado verificando tu invitación.' }
  }
}

export interface CompletarActivacionPayload {
  preinscripcionId: string
  email: string
  nombres: string
  cedula: string
  telefono: string
  fechaNacimiento: string
  tallaFranela: string
  password: string
}

/**
 * Server Action de Activación:
 * Registra en Auth, inserta en usuarios, genera/vincula equipo_id,
 * inscribe en participantes_simulacion y marca reclamado = true.
 */
export async function completarActivacion(payload: CompletarActivacionPayload): Promise<{
  success: boolean
  error?: string
  email?: string
  password?: string
}> {
  const supabaseAdmin = getAdminClient()
  const cedulaNormalizada = payload.cedula.replace(/[\s\-\.]/g, '').toUpperCase()
  const emailNormalizado = payload.email.trim().toLowerCase()
  const nombresLimpio = payload.nombres.trim()

  try {
    // 1. Verificar nuevamente la preinscripción por seguridad
    const { data: pre, error: preErr } = await supabaseAdmin
      .from('preinscripciones')
      .select('id, email, categoria_id, partner_email, partner_nombres, reclamado')
      .eq('id', payload.preinscripcionId)
      .maybeSingle()

    if (preErr || !pre) {
      return { success: false, error: 'No se encontró la preinscripción especificada.' }
    }

    if (pre.reclamado) {
      return { success: false, error: 'Esta preinscripción ya fue activada con anterioridad.' }
    }

    // 2. Validar que la cédula no esté duplicada en public.usuarios
    const { data: userExiste } = await supabaseAdmin
      .from('usuarios')
      .select('id, cedula, email')
      .or(`cedula.eq.${cedulaNormalizada},email.ilike.${emailNormalizado}`)
      .limit(1)
      .maybeSingle()

    if (userExiste) {
      return {
        success: false,
        error: 'Ya existe un usuario con esta cédula de identidad o correo en el sistema.'
      }
    }

    // 3. Obtener simulación activa
    const { data: sim, error: simErr } = await supabaseAdmin
      .from('simulaciones')
      .select('id, nombre')
      .order('fecha_creacion', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (simErr || !sim) {
      return { success: false, error: 'No se encontró ninguna competición activa en el sistema.' }
    }

    // 4. Crear usuario en Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: emailNormalizado,
      password: payload.password,
      email_confirm: true,
      user_metadata: {
        name: nombresLimpio,
        fecha_nacimiento: payload.fechaNacimiento,
        talla_franela: payload.tallaFranela,
        telefono: payload.telefono
      }
    })

    if (authError || !authData.user) {
      console.error('[completarActivacion] Error auth.users:', authError)
      return { success: false, error: `Error creando credenciales: ${authError?.message || ''}` }
    }

    const nuevoUserId = authData.user.id

    // 5. Insertar en public.usuarios
    const { error: userInsertErr } = await supabaseAdmin
      .from('usuarios')
      .upsert({
        id: nuevoUserId,
        nombres: nombresLimpio,
        cedula: cedulaNormalizada,
        telefono: payload.telefono,
        email: emailNormalizado,
        talla_franela: payload.tallaFranela,
        rol: 'atleta'
      })

    if (userInsertErr) {
      console.error('[completarActivacion] Error insertando usuario:', userInsertErr)
      await supabaseAdmin.auth.admin.deleteUser(nuevoUserId)
      return { success: false, error: `Error guardando perfil: ${userInsertErr.message}` }
    }

    // 6. Migración Automática de Tiempos Históricos (tiempos_preinscritos -> tiempos_historicos)
    // 1. Buscar los tiempos precargados del correo con cliente Admin (Service Role)
    const inputEmail = payload.email.trim()
    console.log("=== INICIANDO MIGRACIÓN PARA ===", inputEmail);

    let { data: tiemposTemp, error: errTemp } = await supabaseAdmin
      .from('tiempos_preinscritos')
      .select('*')
      .ilike('email', inputEmail.trim())

    console.log("TIEMPOS ENCONTRADOS:", tiemposTemp);
    console.log("ERROR DE BÚSQUEDA (si hay):", errTemp);

    // Fallback: si no hubo coincidencia por inputEmail, buscar también por pre.email si es distinto
    if ((!tiemposTemp || tiemposTemp.length === 0) && pre.email && pre.email.trim().toLowerCase() !== inputEmail.toLowerCase()) {
      console.log('[completarActivacion] Intentando fallback con pre.email:', pre.email.trim())
      const { data: tpPre } = await supabaseAdmin
        .from('tiempos_preinscritos')
        .select('*')
        .ilike('email', pre.email.trim())
      if (tpPre && tpPre.length > 0) {
        tiemposTemp = tpPre
        console.log("TIEMPOS ENCONTRADOS (FALLBACK PRE.EMAIL):", tiemposTemp)
      }
    }

    // 2. Si hay tiempos, insertarlos en tiempos_historicos usando supabaseAdmin
    if (tiemposTemp && tiemposTemp.length > 0) {
      const tiemposInsert = tiemposTemp.map(t => ({
        usuario_id: nuevoUserId,
        numero_test: t.numero_test,
        tiempo_segundos: t.tiempo_segundos
      }))

      const { error: errInsertTiempos } = await supabaseAdmin
        .from('tiempos_historicos')
        .insert(tiemposInsert)

      if (errInsertTiempos) {
        console.error('[completarActivacion] Error insertando tiempos_historicos:', errInsertTiempos)
        await supabaseAdmin.from('usuarios').delete().eq('id', nuevoUserId)
        await supabaseAdmin.auth.admin.deleteUser(nuevoUserId)
        throw new Error('Error migrando tiempos.')
      }

      console.log("TIEMPOS INSERTADOS CORRECTAMENTE");
    }

    // 7. Inscribir en public.participantes_simulacion con categoria_id y partner_nombres
    const { error: partErr } = await supabaseAdmin
      .from('participantes_simulacion')
      .insert({
        simulacion_id: sim.id,
        usuario_id: nuevoUserId,
        categoria_id: pre.categoria_id,
        partner_nombres: pre.partner_nombres || null
      })

    if (partErr) {
      console.error('[completarActivacion] Error insertando participante:', partErr)
      await supabaseAdmin.from('tiempos_historicos').delete().eq('usuario_id', nuevoUserId)
      await supabaseAdmin.from('usuarios').delete().eq('id', nuevoUserId)
      await supabaseAdmin.auth.admin.deleteUser(nuevoUserId)
      return { success: false, error: `Error en la inscripción a la carrera: ${partErr.message}` }
    }

    // 8. Marcar reclamado = true en public.preinscripciones
    const { error: updatePreErr } = await supabaseAdmin
      .from('preinscripciones')
      .update({ reclamado: true })
      .eq('id', pre.id)

    if (updatePreErr) {
      console.warn('[completarActivacion] Advertencia actualizando preinscripciones a reclamado:', updatePreErr)
    }

    return {
      success: true,
      email: emailNormalizado,
      password: payload.password
    }
  } catch (err: any) {
    console.error('[completarActivacion] Excepción:', err)
    return { success: false, error: err.message || 'Error inesperado durante la activación.' }
  }
}
