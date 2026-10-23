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
      .select('id, email, nombres, categoria_id, partner_email, partner_nombres, reclamado, creado_en, heat_asignado, salida_asignada')
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
        .select('id, nombre, tipo')
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
      .select('id, email, categoria_id, partner_email, partner_nombres, reclamado, heat_asignado, salida_asignada')
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

    // 6. Migración Automática e Idempotente de Tiempos Históricos (tiempos_preinscritos -> tiempos_historicos)
    try {
      const inputEmail = payload.email.trim()
      console.log('[completarActivacion] Iniciando migración de tiempos para:', inputEmail)

      let { data: tiemposTemp, error: errTemp } = await supabaseAdmin
        .from('tiempos_preinscritos')
        .select('*')
        .ilike('email', inputEmail)

      if (errTemp) {
        console.error('[AUDITORÍA FORENSE H32 - ERROR CONSULTANDO TIEMPOS PREINSCRITOS]:', {
          code: errTemp.code,
          message: errTemp.message,
          details: errTemp.details,
          hint: errTemp.hint,
          inputEmail
        })
      }

      // Fallback: si no hubo coincidencia por inputEmail, buscar también por pre.email si es distinto
      if (
        (!tiemposTemp || tiemposTemp.length === 0) &&
        pre.email &&
        pre.email.trim().toLowerCase() !== inputEmail.toLowerCase()
      ) {
        console.log('[completarActivacion] Intentando fallback con pre.email:', pre.email.trim())
        const { data: tpPre, error: errFallback } = await supabaseAdmin
          .from('tiempos_preinscritos')
          .select('*')
          .ilike('email', pre.email.trim())
        if (errFallback) {
          console.error('[AUDITORÍA FORENSE H32 - ERROR FALLBACK PRE.EMAIL]:', {
            code: errFallback.code,
            message: errFallback.message,
            details: errFallback.details,
            hint: errFallback.hint,
            preEmail: pre.email.trim()
          })
        }
        if (tpPre && tpPre.length > 0) {
          tiemposTemp = tpPre
          console.log('[completarActivacion] Tiempos encontrados vía pre.email fallback:', tiemposTemp.length)
        }
      }

      // Procesamiento resiliente si existen tiempos precargados
      if (tiemposTemp && tiemposTemp.length > 0) {
        // BLINDAJE IDEMPOTENTE Y RESOLUCIÓN DE CAUSA RAÍZ:
        // En producción se detectaron múltiples filas para el mismo numero_test por atleta (ej. dos test 1).
        // Postgres tiene un constraint UNIQUE en (usuario_id, numero_test).
        // Agrupamos por test y conservamos el mejor tiempo (más rápido, menor segundos > 0).
        const tiemposPorTest = new Map<number, number>()

        for (const t of tiemposTemp) {
          const testNum = parseInt(String(t.numero_test), 10)
          const tiempoSec = Math.round(Number(t.tiempo_segundos))

          if (!isNaN(testNum) && testNum > 0 && !isNaN(tiempoSec) && tiempoSec > 0) {
            if (!tiemposPorTest.has(testNum)) {
              tiemposPorTest.set(testNum, tiempoSec)
            } else {
              // Si hay duplicados para el mismo test, conservamos el mejor tiempo (más rápido)
              const tiempoPrevio = tiemposPorTest.get(testNum)!
              if (tiempoSec < tiempoPrevio) {
                tiemposPorTest.set(testNum, tiempoSec)
              }
            }
          }
        }

        const tiemposFinales = Array.from(tiemposPorTest.entries()).map(([numero_test, tiempo_segundos]) => ({
          usuario_id: nuevoUserId,
          numero_test,
          tiempo_segundos
        }))

        if (tiemposFinales.length > 0) {
          // Usamos upsert con onConflict: 'usuario_id,numero_test' para garantizar 100% idempotencia ante reintentos
          const { error: errUpsertTiempos } = await supabaseAdmin
            .from('tiempos_historicos')
            .upsert(tiemposFinales, {
              onConflict: 'usuario_id,numero_test'
            })

          if (errUpsertTiempos) {
            console.error('[AUDITORÍA FORENSE H32 - ERROR INSERTANDO TIEMPOS HISTÓRICOS]:', {
              code: errUpsertTiempos.code,
              message: errUpsertTiempos.message,
              details: errUpsertTiempos.details,
              hint: errUpsertTiempos.hint,
              userPayload: {
                nuevoUserId,
                emailNormalizado,
                cedulaNormalizada,
                inputEmail,
                preEmail: pre.email
              },
              tiemposTemp,
              tiemposFinales
            })
            // BLINDAJE: Los tiempos históricos son métricas de referencia comparativa opcionales.
            // Una inconsistencia en estos registros NUNCA debe abortar la activación ni borrar la cuenta del atleta.
          } else {
            console.log('[completarActivacion] Tiempos migrados exitosamente:', tiemposFinales.length)
          }
        } else {
          console.log('[completarActivacion] No se encontraron tiempos numéricos válidos en tiemposTemp.')
        }
      } else {
        console.log('[completarActivacion] El atleta no tiene registros en tiempos_preinscritos. Flujo limpio continuado.')
      }
    } catch (migracionError: any) {
      console.error('[AUDITORÍA FORENSE H32 - EXCEPCIÓN EN MIGRACIÓN DE TIEMPOS]:', {
        error: migracionError?.message || migracionError,
        stack: migracionError?.stack,
        user: { nuevoUserId, emailNormalizado, cedulaNormalizada }
      })
      // Continuar sin romper el flujo de activación
    }

    // 7. Inscribir de forma idempotente en public.participantes_simulacion con categoria_id y partner_nombres
    const { error: partErr } = await supabaseAdmin
      .from('participantes_simulacion')
      .upsert(
        {
          simulacion_id: sim.id,
          usuario_id: nuevoUserId,
          categoria_id: pre.categoria_id,
          partner_nombres: pre.partner_nombres || null,
          heat_asignado: pre.heat_asignado || null,
          salida_asignada: pre.salida_asignada || null
        },
        { onConflict: 'simulacion_id,usuario_id' }
      )

    if (partErr) {
      console.error('[completarActivacion] Error inscribiendo participante:', {
        code: partErr.code,
        message: partErr.message,
        details: partErr.details,
        hint: partErr.hint,
        nuevoUserId,
        simulacionId: sim.id
      })
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
