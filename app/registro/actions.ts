'use server'

import { createClient } from '@/src/utils/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { Categoria, Simulacion } from '@/src/types'

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

/**
 * Consulta la simulación activa y sus categorías disponibles
 */
export async function obtenerCategoriasSimulacionActiva(): Promise<{
  success: boolean
  simulacion: Simulacion | null
  categorias: Categoria[]
  error?: string
}> {
  const supabaseAdmin = getAdminClient()

  try {
    // 1. Obtener la simulación más reciente o en curso
    const { data: sim, error: simErr } = await supabaseAdmin
      .from('simulaciones')
      .select('id, nombre, estado, tabla_liberada, heats_liberados, fecha_creacion')
      .order('fecha_creacion', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (simErr) {
      console.error('[obtenerCategoriasSimulacionActiva] Error simulaciones:', simErr)
      return { success: false, simulacion: null, categorias: [], error: 'Error consultando competición activa.' }
    }

    if (!sim) {
      return { success: false, simulacion: null, categorias: [], error: 'No hay ninguna simulación creada.' }
    }

    // 2. Consultar categorías asociadas a la simulación mediante simulacion_categorias
    const { data: simCatList, error: simCatErr } = await supabaseAdmin
      .from('simulacion_categorias')
      .select('categoria_id, categorias ( id, nombre, tipo, genero )')
      .eq('simulacion_id', sim.id)

    let categorias: Categoria[] = []

    if (!simCatErr && simCatList && simCatList.length > 0) {
      categorias = simCatList
        .map((sc: any) => sc.categorias)
        .filter(Boolean) as Categoria[]
    }

    // Fallback: si la tabla puente no tiene filas, consultar la tabla global categorias
    if (categorias.length === 0) {
      const { data: todasCat, error: catErr } = await supabaseAdmin
        .from('categorias')
        .select('id, nombre, tipo, genero')
        .order('nombre', { ascending: true })

      if (!catErr && todasCat) {
        categorias = todasCat as Categoria[]
      }
    }

    return {
      success: true,
      simulacion: sim as Simulacion,
      categorias
    }
  } catch (err: any) {
    console.error('[obtenerCategoriasSimulacionActiva] Excepción:', err)
    return { success: false, simulacion: null, categorias: [], error: err.message || 'Error inesperado' }
  }
}

/**
 * Evalúa disponibilidad de Cédula y Email antes de proceder en el Wizard
 */
export async function evaluarDisponibilidadRegistro(params: {
  cedula: string
  email: string
}): Promise<{
  success: boolean
  error?: string
  cuposAgotados?: boolean
}> {
  const supabaseAdmin = getAdminClient()
  const cedulaNormalizada = params.cedula.replace(/[\s\-\.]/g, '').toUpperCase()
  const emailNormalizado = params.email.trim().toLowerCase()

  try {
    // 1. Validar si ya existe usuario con esa cédula o email
    const { data: usuarioExistente } = await supabaseAdmin
      .from('usuarios')
      .select('id, cedula, email')
      .or(`cedula.eq.${cedulaNormalizada},email.ilike.${emailNormalizado}`)
      .limit(1)
      .maybeSingle()

    if (usuarioExistente) {
      const esMismoEmail = usuarioExistente.email?.toLowerCase() === emailNormalizado
      return {
        success: false,
        error: esMismoEmail
          ? 'Ya existe un atleta registrado con este correo electrónico.'
          : 'Esta cédula de identidad ya se encuentra registrada en el sistema.'
      }
    }

    // 2. Desacoplamiento de Cupos (Fase H14):
    // Para este MVP el evento no tiene límite de cupos numérico.
    // Cualquier usuario con cédula y correo disponibles puede continuar sin restricciones.
    return { success: true }
  } catch (err: any) {
    console.error('[evaluarDisponibilidadRegistro] Excepción:', err)
    return { success: false, error: err.message || 'Error verificando disponibilidad.' }
  }
}

export interface RegistroAutonomoPayload {
  cedula: string
  nombres: string
  email: string
  telefono: string
  tallaFranela: string
  fechaNacimiento: string
  password: string
  simulacionId: string
  categoriaId: string
  companero?: {
    email: string
    nombre: string
    telefono: string
    genero: string
  }
}

/**
 * Server Action Principal: Registro Autónomo de Atletas
 * Soporta registro Individual y registro de Duplas con validación estricta de no duplicidad
 */
export async function registrarAtletaAutonomo(payload: RegistroAutonomoPayload): Promise<{
  success: boolean
  error?: string
  email?: string
  password?: string
  duplaInscritaSilenciosa?: boolean
}> {
  const supabaseAdmin = getAdminClient()
  const cedulaNormalizada = payload.cedula.replace(/[\s\-\.]/g, '').toUpperCase()
  const emailAtleta = payload.email.trim().toLowerCase()
  const nombresAtleta = payload.nombres.trim()

  try {
    // 1. Obtener datos de la categoría elegida
    const { data: categoria, error: catErr } = await supabaseAdmin
      .from('categorias')
      .select('id, nombre, tipo')
      .eq('id', payload.categoriaId)
      .maybeSingle()

    if (catErr || !categoria) {
      return { success: false, error: 'La categoría seleccionada no es válida.' }
    }

    const esDupla = categoria.tipo === 'dupla'
    let companeroUsuarioExistente: { id: string; nombres: string; email: string } | null = null
    let emailCompNormalizado = ''

    // 2. Si es Dupla: Validaciones estrictas de duplicidad para el compañero
    if (esDupla) {
      if (!payload.companero || !payload.companero.email || !payload.companero.nombre) {
        return { success: false, error: 'Debes completar los datos obligatorios del compañero para categoría Dupla.' }
      }

      emailCompNormalizado = payload.companero.email.trim().toLowerCase()

      if (emailCompNormalizado === emailAtleta) {
        return { success: false, error: 'El correo del compañero no puede ser igual a tu propio correo electrónico.' }
      }

      // 2.1 Verificar si el compañero ya existe en public.usuarios
      const { data: compUser } = await supabaseAdmin
        .from('usuarios')
        .select('id, nombres, email')
        .ilike('email', emailCompNormalizado)
        .maybeSingle()

      if (compUser) {
        companeroUsuarioExistente = compUser

        // Verificar si el compañero YA está en otra dupla para este mismo simulacro
        const { data: partExistente } = await supabaseAdmin
          .from('participantes_simulacion')
          .select('id, categoria_id, equipo_id, simulacion_id, categorias(tipo)')
          .eq('simulacion_id', payload.simulacionId)
          .eq('usuario_id', compUser.id)
          .maybeSingle()

        if (partExistente) {
          const catTipo = (partExistente as any)?.categorias?.tipo
          if (partExistente.equipo_id || catTipo === 'dupla') {
            return {
              success: false,
              error: `El compañero ${compUser.nombres} (${emailCompNormalizado}) ya forma parte de otra dupla inscrita en esta competición.`
            }
          }
        }
      } else {
        // 2.2 Si el compañero NO existe en usuarios: Verificar si ya tiene una preinscripción activa en duplas
        const { data: preExistente } = await supabaseAdmin
          .from('preinscripciones')
          .select('id, partner_nombres, categoria_id')
          .ilike('email', emailCompNormalizado)
          .eq('reclamado', false)
          .maybeSingle()

        if (preExistente) {
          return {
            success: false,
            error: `El correo del compañero (${emailCompNormalizado}) ya tiene una invitación de dupla pendiente (invitado por ${preExistente.partner_nombres || 'otro atleta'}).`
          }
        }
      }
    }

    // 3. Validar que el atleta principal no exista previamente
    const { data: userPrevio } = await supabaseAdmin
      .from('usuarios')
      .select('id, email, cedula')
      .or(`cedula.eq.${cedulaNormalizada},email.ilike.${emailAtleta}`)
      .limit(1)
      .maybeSingle()

    if (userPrevio) {
      return { success: false, error: 'Ya existe una cuenta registrada con este correo o cédula.' }
    }

    // 4. Crear cuenta en auth.users para el atleta principal
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: emailAtleta,
      password: payload.password,
      email_confirm: true,
      user_metadata: {
        name: nombresAtleta,
        fecha_nacimiento: payload.fechaNacimiento,
        talla_franela: payload.tallaFranela,
        telefono: payload.telefono
      }
    })

    if (authError || !authData.user) {
      console.error('[registrarAtletaAutonomo] Error en auth.users:', authError)
      return { success: false, error: `Error al crear credenciales: ${authError?.message || ''}` }
    }

    const nuevoUsuarioId = authData.user.id

    // 5. Insertar perfil en public.usuarios
    const usuarioInsertData: any = {
      id: nuevoUsuarioId,
      nombres: nombresAtleta,
      cedula: cedulaNormalizada,
      telefono: payload.telefono,
      email: emailAtleta,
      talla_franela: payload.tallaFranela,
      rol: 'atleta'
    }

    const { error: userInsertErr } = await supabaseAdmin
      .from('usuarios')
      .upsert(usuarioInsertData)

    if (userInsertErr) {
      console.error('[registrarAtletaAutonomo] Error insertando usuario:', userInsertErr)
      await supabaseAdmin.auth.admin.deleteUser(nuevoUsuarioId)
      return { success: false, error: `Error al crear el perfil: ${userInsertErr.message}` }
    }

    // 6. Inscribir atleta principal en public.participantes_simulacion con partner_nombres si es dupla
    const partnerNombreTexto = esDupla && payload.companero ? payload.companero.nombre.trim() : null

    const { error: partErr } = await supabaseAdmin
      .from('participantes_simulacion')
      .insert({
        simulacion_id: payload.simulacionId,
        usuario_id: nuevoUsuarioId,
        categoria_id: payload.categoriaId,
        partner_nombres: partnerNombreTexto
      })

    if (partErr) {
      console.error('[registrarAtletaAutonomo] Error inscribiendo en participantes_simulacion:', partErr)
      await supabaseAdmin.from('usuarios').delete().eq('id', nuevoUsuarioId)
      await supabaseAdmin.auth.admin.deleteUser(nuevoUsuarioId)
      return { success: false, error: `Error en la inscripción a la carrera: ${partErr.message}` }
    }

    // 7. Si es Dupla, registrar preinscripción para el compañero
    if (esDupla && payload.companero) {
      const preinscripcionPayload: any = {
        email: emailCompNormalizado,
        nombres: payload.companero.nombre.trim(),
        categoria_id: payload.categoriaId,
        partner_email: emailAtleta,
        partner_nombres: nombresAtleta,
        reclamado: false
      }

      const { error: preErr } = await supabaseAdmin
        .from('preinscripciones')
        .insert(preinscripcionPayload)

      if (preErr) {
        console.error('[registrarAtletaAutonomo] Error insertando preinscripción:', preErr)
      }
    }

    // 9. Liberar reserva atómica de cupo temporal si existía
    try {
      await supabaseAdmin.from('reservas_temporales').delete().eq('cedula', cedulaNormalizada)
    } catch (e) {
      // Ignorar fallo de limpieza no crítico
    }

    return {
      success: true,
      email: emailAtleta,
      password: payload.password,
      duplaInscritaSilenciosa: false
    }
  } catch (err: any) {
    console.error('[registrarAtletaAutonomo] Excepción crítica:', err)
    return { success: false, error: err.message || 'Error inesperado durante el registro.' }
  }
}
