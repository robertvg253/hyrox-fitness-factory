'use server'

import { createClient } from '@/src/utils/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export async function verificarDisponibilidad(cedula?: string, telefono?: string) {
  const supabase = await createClient();
  let cedulaExiste = false;
  let telefonoExiste = false;

  if (cedula) {
    const { data } = await supabase.from('usuarios').select('id').eq('cedula_rif', cedula.trim()).limit(1).single();
    if (data) cedulaExiste = true;
  }

  if (telefono) {
    const { data } = await supabase.from('usuarios').select('id').eq('telefono', telefono.trim()).limit(1).single();
    if (data) telefonoExiste = true;
  }

  return { cedulaExiste, telefonoExiste };
}

export async function crearAtleta(formData: FormData) {
  const cookieStore = await cookies()
  const activeSedeId = cookieStore.get('active_sede')?.value || null

  const nombre = formData.get('nombre') as string;
  const apellido = formData.get('apellido') as string;
  const cedula = formData.get('cedula') as string;
  const telefono = formData.get('telefono') as string;

  if (!nombre || !apellido || !cedula || !telefono) {
    return { success: false, error: 'Todos los campos son obligatorios' };
  }

  const nombre_completo = `${nombre.trim()} ${apellido.trim()}`;

  const supabase = await createClient();

  // Verificar si la cédula ya existe
  const { data: existingUser } = await supabase
    .from('usuarios')
    .select('id')
    .eq('cedula_rif', cedula.trim())
    .single();

  if (existingUser) {
    return { success: false, error: 'Ya existe un usuario con esta cédula' };
  }

  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const telefonoLimpio = telefono.trim().replace(/\+/g, '');
  const emailFicticio = `${telefonoLimpio}@fitnessfactory.local`;
  const password = Math.random().toString(36).slice(-10) + 'A1!';

  // Crear en Auth primero
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: emailFicticio,
    password: password,
    email_confirm: true,
    user_metadata: {
      name: nombre_completo,
      role: 'ATLETA'
    }
  });

  if (authError || !authData.user) {
    console.error('[crearAtleta] Auth Error:', authError);
    return { success: false, error: 'Error al crear la cuenta de usuario en el sistema' };
  }

  const realId = authData.user.id;

  const { data, error } = await supabaseAdmin
    .from('usuarios')
    .upsert({
      id: realId,
      nombre_completo,
      cedula_rif: cedula.trim(),
      telefono: telefono.trim(),
      rol: 'ATLETA',
      sede_id: activeSedeId,
      email: emailFicticio
    })
    .select()
    .single();

  if (error) {
    console.error('[crearAtleta] Error insert:', error);
    // Rollback
    await supabaseAdmin.auth.admin.deleteUser(realId);
    return { success: false, error: 'Error interno al registrar los datos del atleta' };
  }

  return { success: true, data };
}
