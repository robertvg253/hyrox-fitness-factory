'use server'

import { createClient } from '@/src/utils/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { generarIdentidadFantasma } from '@/src/utils/authHelpers'

// Almacenamiento seguro temporal de OTPs en caso de que la tabla public.otps aún no esté migrada
const inMemoryOtps = new Map<string, { codigo: string; expiresAt: Date }>();

export async function evaluarCedulaRegistro(cedula: string) {
  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    const cedulaNormalizada = cedula.replace(/[\s\-\.]/g, '').toUpperCase();
    const matchLetra = cedulaNormalizada.match(/^([VEJGP])(\d+)$/);
    const cedulaConGuion = matchLetra ? `${matchLetra[1]}-${matchLetra[2]}` : cedulaNormalizada;

    let query = supabaseAdmin
      .from('usuarios')
      .select('id, cedula, nombres, email, telefono');

    if (cedulaConGuion !== cedulaNormalizada) {
      query = query.or(`cedula.eq.${cedulaNormalizada},cedula.eq.${cedulaConGuion}`);
    } else {
      query = query.eq('cedula', cedulaNormalizada);
    }

    const { data: usuarioExistente, error } = await query.limit(1).maybeSingle();

    if (error) {
      console.error('[evaluarCedulaRegistro] Error:', error);
      return { success: false, error: 'Error consultando la base de datos' };
    }

    if (usuarioExistente) {
      return {
        success: true,
        estado: 'COMPLETO' as const,
        usuario: usuarioExistente,
        message: 'Esta cédula ya se encuentra registrada en el sistema.'
      };
    }

    // 2. Desacoplamiento de Cupos (Fase H14):
    // Para este MVP, el evento no tiene límite de cupos numérico.
    return {
      success: true,
      estado: 'NUEVO' as const
    };
  } catch (err: any) {
    console.error('[evaluarCedulaRegistro] Catch error:', err);
    return { success: false, error: err.message || 'Error inesperado' };
  }
}

export async function verificarCedula(cedula: string) {
  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    const cedulaNormalizada = cedula.replace(/[\s\-\.]/g, '').toUpperCase();
    const matchLetra = cedulaNormalizada.match(/^([VEJGP])(\d+)$/);
    const cedulaConGuion = matchLetra ? `${matchLetra[1]}-${matchLetra[2]}` : cedulaNormalizada;

    let query = supabaseAdmin
      .from('usuarios')
      .select('id, cedula, nombres, telefono');

    if (cedulaConGuion !== cedulaNormalizada) {
      query = query.or(`cedula.eq.${cedulaNormalizada},cedula.eq.${cedulaConGuion}`);
    } else {
      query = query.eq('cedula', cedulaNormalizada);
    }

    const { data, error } = await query.limit(1).maybeSingle()

    if (error || !data) {
      return { success: false, action: 'REGISTER' }
    }

    return { success: true, action: 'LOGIN', user: data }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

export async function iniciarSesionUsuario(
  identificador: string, 
  password: string, 
  portal: 'atleta' | 'admin' = 'atleta'
) {
  const supabase = await createClient()
  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const idTrim = identificador.trim()
  const esEmail = idTrim.includes('@')

  let query = supabaseAdmin
    .from('usuarios')
    .select('id, email, rol, cedula, nombres')

  if (esEmail) {
    query = query.ilike('email', idTrim)
  } else {
    // Normalización de Cédula
    const cedulaNormalizada = idTrim.replace(/[\s\-\.]/g, '').toUpperCase()
    const matchLetra = cedulaNormalizada.match(/^([VEJGP])(\d+)$/)
    const cedulaConGuion = matchLetra ? `${matchLetra[1]}-${matchLetra[2]}` : cedulaNormalizada

    if (cedulaConGuion !== cedulaNormalizada) {
      query = query.or(`cedula.eq.${cedulaNormalizada},cedula.eq.${cedulaConGuion}`)
    } else {
      query = query.eq('cedula', cedulaNormalizada)
    }
  }

  // 1. Consulta de usuario en public.usuarios
  const { data: usuario, error } = await query.limit(1).maybeSingle()

  if (error || !usuario) {
    if (portal === 'admin') {
      return { success: false, error: 'Credenciales inválidas o no tienes permisos de administrador' }
    }
    return { success: false, error: 'Credenciales inválidas. Usuario no encontrado.' }
  }

  const rol = (usuario.rol || '').toLowerCase().trim()

  // 2. Validación de Portal Admin: Si proviene de /admin/login, rol debe ser 'admin'
  if (portal === 'admin' && rol !== 'admin') {
    return { 
      success: false, 
      error: 'Credenciales inválidas o no tienes permisos de administrador' 
    }
  }

  // 3. Resolver email para Supabase Auth
  let emailParaAuth = usuario.email
  if (!emailParaAuth) {
    if (usuario.id) {
      const { data: authUserData } = await supabaseAdmin.auth.admin.getUserById(usuario.id)
      if (authUserData?.user?.email) {
        emailParaAuth = authUserData.user.email
      }
    }
    if (!emailParaAuth && usuario.cedula) {
      const cedLimpia = usuario.cedula.replace(/[\s\-\.]/g, '').toUpperCase()
      emailParaAuth = `${cedLimpia}@hyrox.local`
    }
  }

  if (!emailParaAuth) {
    return { success: false, error: 'No se pudo resolver la cuenta de acceso.' }
  }

  // 4. Iniciar sesión usando Supabase Auth (establece cookies de sesión)
  const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
    email: emailParaAuth,
    password
  })

  if (signInError || !authData.user) {
    if (portal === 'admin') {
      return { success: false, error: 'Credenciales inválidas o no tienes permisos de administrador' }
    }
    return { success: false, error: 'Credenciales inválidas. Contraseña incorrecta.' }
  }

  // 5. Verificación de rol en el servidor tras autenticación
  const { data: usuarioAuth } = await supabaseAdmin
    .from('usuarios')
    .select('rol')
    .eq('id', authData.user.id)
    .maybeSingle()

  const rolFinal = (usuarioAuth?.rol || rol).toLowerCase().trim()

  if (portal === 'admin' && rolFinal !== 'admin') {
    await supabase.auth.signOut()
    return { success: false, error: 'Credenciales inválidas o no tienes permisos de administrador' }
  }

  // 6. Redirección Condicional según el rol
  const redirectUrl = rolFinal === 'admin' ? '/admin/dashboard' : '/dashboard'

  return { 
    success: true, 
    rol: rolFinal,
    redirect: redirectUrl,
    redirectUrl 
  }
}

export async function enviarOtp(telefono: string) {
  let tel = telefono.replace(/\s+/g, '');
  if (!tel.startsWith('+')) {
    tel = '+' + tel;
  }

  const codigo = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + 5);

  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Intentar almacenar en public.otps si la tabla existe
  try {
    // Límites básicos
    const limite24h = new Date();
    limite24h.setHours(limite24h.getHours() - 24);

    const { data: otpsPrevios, error: fetchErr } = await supabaseAdmin
      .from('otps')
      .select('created_at')
      .eq('telefono', tel)
      .gte('created_at', limite24h.toISOString())
      .order('created_at', { ascending: false });

    if (!fetchErr && otpsPrevios) {
      if (otpsPrevios.length > 0) {
        const lastOtpTime = new Date(otpsPrevios[0].created_at).getTime();
        const nowTime = new Date().getTime();
        if (nowTime - lastOtpTime < 60000) {
          return { success: false, error: 'Espera 60 segundos antes de pedir otro código' };
        }
      }
      if (otpsPrevios.length >= 3) {
        return { success: false, error: 'Has excedido el límite de solicitudes (Max 3/24h)' };
      }
    }

    await supabaseAdmin.from('otps').delete().eq('telefono', tel);
    const { error: insertError } = await supabaseAdmin
      .from('otps')
      .insert({ telefono: tel, codigo, expires_at: expiresAt.toISOString() });

    if (insertError) {
      console.warn('[OTP Send] Tabla public.otps no disponible en la BD, usando almacenamiento temporal:', insertError.message);
      inMemoryOtps.set(tel, { codigo, expiresAt });
    }
  } catch (err: any) {
    console.warn('[OTP Send] Catch error en Supabase OTP, usando almacenamiento temporal:', err.message);
    inMemoryOtps.set(tel, { codigo, expiresAt });
  }

  // Enviar código vía Callbell (WhatsApp)
  const otpString = String(codigo);
  const callbellUrl = 'https://api.callbell.eu/v1/messages/send';
  
  if (process.env.CALLBELL_API_TOKEN && process.env.CALLBELL_CHANNEL_UUID) {
    const callbellPayload = {
      to: tel,
      from: "whatsapp",
      type: "text",
      channel_uuid: process.env.CALLBELL_CHANNEL_UUID,
      content: { text: `Tu código de verificación Hyrox es ${otpString}` },
      template_uuid: process.env.CALLBELL_OTP_TEMPLATE_UUID,
      template_values: [otpString],
      optin_contact: true
    };

    try {
      const callbellResponse = await fetch(callbellUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.CALLBELL_API_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(callbellPayload)
      });

      if (!callbellResponse.ok) {
        console.error('[OTP Send] Error en Callbell:', await callbellResponse.text());
      }
    } catch (err) {
      console.error('[OTP Send] Error conectando a Callbell:', err);
    }
  } else {
    console.log(`[OTP Local/Dev] Código generado para ${tel}: ${otpString}`);
  }

  return { success: true, message: 'Código enviado correctamente' }
}

export async function validarOtp(telefono: string, codigo: string) {
  let tel = telefono.replace(/\s+/g, '');
  if (!tel.startsWith('+')) {
    tel = '+' + tel;
  }

  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // 1. Intentar validar en tabla public.otps
  try {
    const { data: otps, error } = await supabaseAdmin
      .from('otps')
      .select('id, expires_at')
      .eq('telefono', tel)
      .eq('codigo', codigo)
      .order('created_at', { ascending: false })
      .limit(1);

    if (!error && otps && otps.length > 0) {
      const otpData = otps[0];
      const now = new Date();
      const expiresAt = new Date(otpData.expires_at);

      if (now > expiresAt) {
        return { success: false, error: 'El código ha expirado.' };
      }

      await supabaseAdmin.from('otps').delete().eq('id', otpData.id);
      return { success: true, estado: 'NUEVO' as const };
    }
  } catch (err: any) {
    console.warn('[validarOtp] Error consultando tabla public.otps:', err.message);
  }

  // 2. Fallback a almacenamiento en memoria
  const memOtp = inMemoryOtps.get(tel);
  if (memOtp && memOtp.codigo === codigo) {
    if (new Date() > memOtp.expiresAt) {
      inMemoryOtps.delete(tel);
      return { success: false, error: 'El código ha expirado.' };
    }
    inMemoryOtps.delete(tel);
    return { success: true, estado: 'NUEVO' as const };
  }

  return { success: false, error: 'Código incorrecto.' };
}

export async function completarRegistroUsuario(payload: {
  cedula: string
  telefono: string
  password: string
  nombre?: string
  apellido?: string
  email?: string
  tallaFranela: string
  tiempos: {
    test1: number
    test2: number
    test3: number
    test4: number
  } | Array<{ numero_test: number; tiempo_segundos: number }>
}) {
  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const cedulaNormalizada = payload.cedula.replace(/[\s\-\.]/g, '').toUpperCase();

  try {
    const nombreCompleto = `${payload.nombre?.trim() || ''} ${payload.apellido?.trim() || ''}`.trim();
    const emailUsuario = payload.email?.trim() || `${cedulaNormalizada}@hyrox.local`;

    // 1. Crear en auth.users con la contraseña proporcionada por el atleta
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: emailUsuario,
      password: payload.password,
      email_confirm: true,
      user_metadata: {
        name: nombreCompleto
      }
    });

    if (authError || !authData.user) {
      console.error('[completarRegistroUsuario] Error auth.users:', authError);
      return { success: false, error: 'Error al crear credenciales de acceso: ' + (authError?.message || '') };
    }

    const newUserId = authData.user.id;

    // 2. Inserción en public.usuarios: nombres, cedula, telefono, email, talla_franela
    const { error: insertErr } = await supabaseAdmin
      .from('usuarios')
      .upsert({
        id: newUserId,
        nombres: nombreCompleto,
        cedula: cedulaNormalizada,
        telefono: payload.telefono,
        email: emailUsuario,
        talla_franela: payload.tallaFranela
      });

    if (insertErr) {
      console.error('[completarRegistroUsuario] Error insertando public.usuarios:', insertErr);
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      return { success: false, error: 'Error al guardar los datos del usuario: ' + insertErr.message };
    }

    // 3. Inserción múltiple (bulk insert) en public.tiempos_historicos
    let t1 = 0, t2 = 0, t3 = 0, t4 = 0;
    if (Array.isArray(payload.tiempos)) {
      t1 = payload.tiempos.find(t => t.numero_test === 1)?.tiempo_segundos || 0;
      t2 = payload.tiempos.find(t => t.numero_test === 2)?.tiempo_segundos || 0;
      t3 = payload.tiempos.find(t => t.numero_test === 3)?.tiempo_segundos || 0;
      t4 = payload.tiempos.find(t => t.numero_test === 4)?.tiempo_segundos || 0;
    } else if (payload.tiempos && typeof payload.tiempos === 'object') {
      t1 = payload.tiempos.test1 || 0;
      t2 = payload.tiempos.test2 || 0;
      t3 = payload.tiempos.test3 || 0;
      t4 = payload.tiempos.test4 || 0;
    }

    const tiemposInsertPayload = [
      { id: crypto.randomUUID(), usuario_id: newUserId, numero_test: 1, tiempo_segundos: Math.round(t1) },
      { id: crypto.randomUUID(), usuario_id: newUserId, numero_test: 2, tiempo_segundos: Math.round(t2) },
      { id: crypto.randomUUID(), usuario_id: newUserId, numero_test: 3, tiempo_segundos: Math.round(t3) },
      { id: crypto.randomUUID(), usuario_id: newUserId, numero_test: 4, tiempo_segundos: Math.round(t4) }
    ];

    const { error: tiemposErr } = await supabaseAdmin
      .from('tiempos_historicos')
      .insert(tiemposInsertPayload);

    if (tiemposErr) {
      console.error('[completarRegistroUsuario] Error insertando en tiempos_historicos:', tiemposErr);
      // Rollback para evitar estado inconsistente
      await supabaseAdmin.from('usuarios').delete().eq('id', newUserId);
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      return { success: false, error: 'Error al registrar los tiempos históricos: ' + tiemposErr.message };
    }

    // 4. Limpiar reserva temporal de cupo una vez consolidado el usuario
    try {
      await supabaseAdmin
        .from('reservas_temporales')
        .delete()
        .eq('cedula', cedulaNormalizada);
    } catch (cleanupErr) {
      console.warn('[completarRegistroUsuario] Advertencia limpiando reserva_temporal:', cleanupErr);
    }

    return { success: true, email: emailUsuario, password: payload.password };
  } catch (err: any) {
    console.error('[completarRegistroUsuario] Excepción:', err);
    return { success: false, error: err.message || 'Error inesperado durante el registro.' };
  }
}
