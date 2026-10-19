'use server'

import { createClient } from '@/src/utils/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

export interface CrearStaffPayload {
  nombre: string
  apellido: string
  cedula: string
  email: string
  password: string
  rol: 'RECEPCIONISTA' | 'GERENTE_SEDE' | 'GERENTE'
  sedeId: string
}

export async function crearMiembroStaff(payload: CrearStaffPayload) {
  // 1. Verificación de Seguridad Nivel 1: Verificar que el invocador sea SUPERADMIN
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'No autenticado.' }
  }

  const { data: currentProfile, error: profileErr } = await supabase
    .from('usuarios')
    .select('rol')
    .eq('id', user.id)
    .single()

  if (profileErr || currentProfile?.rol?.toUpperCase() !== 'SUPERADMIN') {
    return { success: false, error: 'Acceso denegado: Se requiere rol SUPERADMIN para dar de alta personal administrativo.' }
  }

  // 2. Normalización y validaciones de entrada
  const nombre = payload.nombre?.trim()
  const apellido = payload.apellido?.trim()
  const cedula = payload.cedula?.trim().replace(/[\s\-\.]/g, '').toUpperCase()
  const email = payload.email?.trim().toLowerCase()
  const password = payload.password?.trim()
  const rol = payload.rol
  const sedeId = payload.sedeId

  if (!nombre || !apellido || !cedula || !email || !password || !rol || !sedeId) {
    return { success: false, error: 'Todos los campos son obligatorios.' }
  }

  if (password.length < 6) {
    return { success: false, error: 'La contraseña debe tener al menos 6 caracteres.' }
  }

  const rolesPermitidos = ['RECEPCIONISTA', 'GERENTE_SEDE', 'GERENTE']
  if (!rolesPermitidos.includes(rol)) {
    return { success: false, error: 'Rol seleccionado no válido.' }
  }

  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const nombreCompleto = `${nombre} ${apellido}`

  try {
    // 3. Verificar si ya existe en la base de datos por email o cédula
    const { data: existingUser } = await supabaseAdmin
      .from('usuarios')
      .select('id, email, cedula_rif')
      .or(`cedula_rif.eq.${cedula},email.eq.${email}`)
      .maybeSingle()

    if (existingUser) {
      if (existingUser.email?.toLowerCase() === email) {
        return { success: false, error: 'Ya existe un usuario registrado con este correo electrónico.' }
      }
      return { success: false, error: 'Ya existe un usuario registrado con esta cédula.' }
    }

    // Paso A (Auth): Crear identidad en auth.users con Email y Contraseña reales
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name: nombreCompleto,
        role: rol
      }
    })

    if (authError || !authData.user) {
      console.error('[crearMiembroStaff] Error Auth:', authError)
      return { success: false, error: authError?.message || 'Error al crear credenciales de autenticación.' }
    }

    const newStaffId = authData.user.id

    // Paso B (Public): Insertar en public.usuarios con acepto_terminos: true
    const { error: insertErr } = await supabaseAdmin
      .from('usuarios')
      .insert({
        id: newStaffId,
        nombre_completo: nombreCompleto,
        cedula_rif: cedula,
        email,
        rol,
        sede_id: sedeId,
        acepto_terminos: true,
        migracion_pendiente: false
      })

    if (insertErr) {
      console.error('[crearMiembroStaff] Error Insert en public.usuarios:', insertErr)
      // Rollback en auth si falló el insert en tabla pública
      await supabaseAdmin.auth.admin.deleteUser(newStaffId)
      return { success: false, error: 'Error al registrar perfil en base de datos: ' + insertErr.message }
    }

    revalidatePath('/admin/configuracion')
    return { success: true }
  } catch (err: any) {
    console.error('[crearMiembroStaff] Catch error:', err)
    return { success: false, error: err.message || 'Error inesperado al crear miembro del staff.' }
  }
}
