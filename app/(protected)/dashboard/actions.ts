'use server'

import { createClient } from '@/src/utils/supabase/server'
import { revalidatePath } from 'next/cache'

/**
 * Server Actions para el Dashboard de Atleta Hyrox
 */

export async function obtenerEstadoAtleta() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'No autenticado' }
  }

  const { data: usuario, error: userError } = await supabase
    .from('usuarios')
    .select('id, nombres, cedula, telefono, email, talla_franela, rol')
    .eq('id', user.id)
    .maybeSingle()

  if (userError) {
    return { success: false, error: userError.message }
  }

  return { success: true, data: usuario }
}
