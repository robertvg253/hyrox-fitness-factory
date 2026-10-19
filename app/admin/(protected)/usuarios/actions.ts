'use server'

import { createClient } from '@/src/utils/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { generarIdentidadFantasma } from '@/src/utils/authHelpers'

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

  const { emailFicticio, claveFicticia } = generarIdentidadFantasma(cedula);

  // Crear en Auth primero
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: emailFicticio,
    password: claveFicticia,
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
      email: emailFicticio,
      acepto_terminos: false
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

export async function asignarPlan(usuarioId: string, planId: string, sedeId: string | null) {
  const supabase = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: plan, error: planErr } = await supabase
    .from('planes')
    .select('precio_usd, tipo, sesiones_total')
    .eq('id', planId)
    .single();

  if (planErr || !plan) {
    return { success: false, error: 'Plan no encontrado' };
  }

  // 1. Limpiar suscripciones anteriores activas
  await supabase
    .from('suscripciones')
    .update({ estado: 'INACTIVO' })
    .eq('usuario_id', usuarioId)
    .eq('estado', 'ACTIVO');

  // 2. Preparar el payload de la nueva suscripción (Nacimiento Neutro)
  const hoy = new Date();
  const payload: any = {
    usuario_id: usuarioId,
    plan_id: planId,
    estado: 'INACTIVO',
    fecha_corte: hoy.toISOString()
  };

  // Inyectar sesiones en 0 si corresponde (el motor optimista sumará al pagar)
  if (plan.tipo === 'SESIONES') {
    payload.sesiones_restantes = 0;
  }

  // 3. Inserción Completa y Calculada
  const { data, error } = await supabase
    .from('suscripciones')
    .insert(payload)
    .select()
    .single();

  if (error) {
    console.error('[asignarPlan]', error);
    return { success: false, error: 'Error al asignar plan' };
  }

  // Graduar al usuario (limpiar etiqueta_lead)
  const { error: userError } = await supabase
    .from('usuarios')
    .update({ etiqueta_lead: null })
    .eq('id', usuarioId);

  if (userError) {
    console.error('[asignarPlan] Error limpiando etiqueta_lead', userError);
  }

  return { success: true, data };
}

export async function actualizarFechaCorteManual(suscripcionId: string, nuevaFecha: string) {
  const supabaseAuth = await createClient();
  const { data: { user } } = await supabaseAuth.auth.getUser();
  
  if (!user) throw new Error("No autenticado");

  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Verificar rol
  const { data: adminUser } = await supabaseAdmin
    .from('usuarios')
    .select('rol')
    .eq('id', user.id)
    .single();

  if (!adminUser || !['SUPERADMIN', 'ADMIN', 'GERENTE', 'ENCARGADO'].includes(adminUser.rol)) {
    throw new Error("Acceso denegado: No tienes permisos de gerente para modificar fechas de corte.");
  }

  // Ajuste de Zona Horaria (Caracas UTC-4)
  const fechaAjustada = `${nuevaFecha}T00:00:00-04:00`;

  // Update
  const { error } = await supabaseAdmin
    .from('suscripciones')
    .update({ fecha_corte: new Date(fechaAjustada).toISOString() })
    .eq('id', suscripcionId);

  if (error) {
    throw new Error("Error al actualizar la fecha de corte: " + error.message);
  }

  // Opcionalmente podemos revalidar
  const { revalidatePath } = require('next/cache');
  revalidatePath('/admin/usuarios/[id]', 'page');

  return { success: true };
}
