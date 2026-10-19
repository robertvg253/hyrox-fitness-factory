'use server'

import { createClient } from '@/src/utils/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { generarIdentidadFantasma } from '@/src/utils/authHelpers'



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
      .select('id, cedula_rif, nombre_completo, email, telefono, rol, acepto_terminos, sede_id');

    if (cedulaConGuion !== cedulaNormalizada) {
      query = query.or(`cedula_rif.eq.${cedulaNormalizada},cedula_rif.eq.${cedulaConGuion}`);
    } else {
      query = query.eq('cedula_rif', cedulaNormalizada);
    }

    const { data: usuarioExistente, error } = await query.limit(1).maybeSingle();

    if (error) {
      console.error('[evaluarCedulaRegistro] Error:', error);
      return { success: false, error: 'Error consultando la base de datos' };
    }

    // SI ES NUEVO (Flujo 1):
    if (!usuarioExistente) {
      return {
        success: true,
        estado: 'NUEVO' as const
      };
    }

    // SI YA ESTÁ REGISTRADO Y ACTIVO:
    if (usuarioExistente.acepto_terminos === true) {
      return {
        success: true,
        estado: 'COMPLETO' as const,
        usuario: usuarioExistente,
        message: 'Esta cédula ya está registrada y activa.'
      };
    }

    // SI ES PRE-REGISTRADO / ESCALONADO (Flujo 2):
    const userPhone = usuarioExistente.telefono;
    if (!userPhone) {
      return {
        success: true,
        estado: 'NUEVO' as const
      };
    }

    // Disparar envío automático de OTP al teléfono recuperado
    const otpRes = await enviarOtp(userPhone);
    if (!otpRes.success) {
      return {
        success: false,
        error: otpRes.error || 'Error al enviar código de verificación.'
      };
    }

    // Extraer últimos 4 dígitos
    const cleanDigits = userPhone.replace(/\D/g, '');
    const last4 = cleanDigits.slice(-4);

    return {
      success: true,
      estado: 'ESCALONADO' as const,
      telefono: userPhone,
      ultimosCuatroDigitos: last4,
      usuario: {
        id: usuarioExistente.id,
        nombre_completo: usuarioExistente.nombre_completo,
        cedula_rif: usuarioExistente.cedula_rif,
        email: usuarioExistente.email,
        sede_id: usuarioExistente.sede_id
      },
      message: 'Código de seguridad enviado a tu WhatsApp'
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
      .select('id, cedula_rif, nombre_completo, telefono, migracion_pendiente');

    if (cedulaConGuion !== cedulaNormalizada) {
      query = query.or(`cedula_rif.eq.${cedulaNormalizada},cedula_rif.eq.${cedulaConGuion}`);
    } else {
      query = query.eq('cedula_rif', cedulaNormalizada);
    }

    const { data, error } = await query.limit(1).maybeSingle()

    if (error || !data) {
      return { success: false, action: 'REGISTER' }
    }

    if (data.migracion_pendiente) {
      return { success: true, action: 'MIGRATION', user: data }
    }

    return { success: true, action: 'LOGIN', user: data }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

export async function obtenerSedesPublicas() {
  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    const { data, error } = await supabaseAdmin
      .from('sedes')
      .select('id, nombre, codigo_slug')
      .order('nombre')
      
    if (error) throw error
    return { success: true, data }
  } catch (err: any) {
    console.error('[obtenerSedesPublicas] Error:', err)
    return { success: false, error: err.message }
  }
}

export async function iniciarSesionUsuario(cedula: string, password: string) {
  const supabase = await createClient()
  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // 1. Normalización de Cédula
  const cedulaNormalizada = cedula.replace(/[\s\-\.]/g, '').toUpperCase();
  console.log('[DEBUG LOGIN] Cédula normalizada:', cedulaNormalizada)

  // Soportar coincidencia con y sin guión (ej. V16161616 y V-16161616)
  const matchLetra = cedulaNormalizada.match(/^([VEJGP])(\d+)$/);
  const cedulaConGuion = matchLetra ? `${matchLetra[1]}-${matchLetra[2]}` : cedulaNormalizada;

  let query = supabaseAdmin
    .from('usuarios')
    .select('id, email, rol, acepto_terminos, cedula_rif');

  if (cedulaConGuion !== cedulaNormalizada) {
    query = query.or(`cedula_rif.eq.${cedulaNormalizada},cedula_rif.eq.${cedulaConGuion}`);
  } else {
    query = query.eq('cedula_rif', cedulaNormalizada);
  }

  // 2. Consulta con Bypass de RLS (Supabase Admin)
  const { data, error } = await query.limit(1).maybeSingle();

  console.log('[DEBUG LOGIN] Resultado BD:', data, error)

  if (error || !data) {
    return { success: false, error: error ? `Error BD: ${error.message}` : 'Cédula no encontrada en el sistema public.usuarios.' }
  }

  // Si detectas que el usuario existe pero tiene acepto_terminos === false, no lo redirijas. Retorna error directo:
  if (data.acepto_terminos === false) {
    return {
      success: false,
      error: 'Tu cuenta aún no está activada. Por favor, ve a la sección de Registro para completarla.'
    }
  }

  // Resolver email para login (si en public.usuarios es null, buscar en auth.users o fallback a fantasma)
  let emailUsuario = data.email;
  if (!emailUsuario) {
    if (data.id) {
      const { data: authUserData } = await supabaseAdmin.auth.admin.getUserById(data.id);
      if (authUserData?.user?.email) {
        emailUsuario = authUserData.user.email;
      }
    }
    if (!emailUsuario) {
      emailUsuario = `${cedulaNormalizada}@fitnessfactory.local`;
    }
  }

  // 3. Iniciar sesión usando el email
  console.log(`[DEBUG LOGIN] Paso 2 - Intentando signInWithPassword con email: ${emailUsuario}`)
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: emailUsuario,
    password
  })

  console.log('[DEBUG LOGIN] Resultado de signInWithPassword:', signInError ? signInError : 'ÉXITO (No error)')

  if (signInError) {
    return { success: false, error: `Auth Error: ${signInError.message} (${signInError.code || 'sin_codigo'})` }
  }

  // Redirigir directamente a /dashboard
  console.log('[DEBUG LOGIN] Paso 3 - Redirigiendo a /dashboard')
  return { success: true, redirect: '/dashboard' }
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

  // --- ANTI-SPAM (LÍMITES) ---
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

  // --- INVALIDACIÓN ---
  await supabaseAdmin.from('otps').delete().eq('telefono', tel);

  // Guardar en la base de datos
  const { error: insertError } = await supabaseAdmin
    .from('otps')
    .insert({ telefono: tel, codigo, expires_at: expiresAt.toISOString() });

  if (insertError) {
    console.error('[OTP Send] Error guardando código:', insertError);
    return { success: false, error: 'Error generando código de validación' };
  }

  // Enviar código vía Callbell (WhatsApp)
  const otpString = String(codigo);
  const callbellUrl = 'https://api.callbell.eu/v1/messages/send';
  
  const callbellPayload = {
    to: tel,
    from: "whatsapp",
    type: "text",
    channel_uuid: process.env.CALLBELL_CHANNEL_UUID,
    content: { text: `Tu código de verificación es ${otpString}` },
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
      return { success: false, error: 'Error despachando mensaje a WhatsApp' };
    }
  } catch (err) {
    console.error('[OTP Send] Error conectando a Callbell:', err);
    return { success: false, error: 'Error despachando mensaje a WhatsApp' };
  }

  return { success: true, message: 'Código enviado correctamente' }
}

export async function validarOtp(telefono: string, codigo: string, datosExtra?: any) {
  let tel = telefono.replace(/\s+/g, '');
  if (!tel.startsWith('+')) {
    tel = '+' + tel;
  }

  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: otps, error } = await supabaseAdmin
    .from('otps')
    .select('id, expires_at')
    .eq('telefono', tel)
    .eq('codigo', codigo)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error || !otps || otps.length === 0) {
    return { success: false, error: 'Código incorrecto.' };
  }

  const otpData = otps[0];
  const now = new Date();
  const expiresAt = new Date(otpData.expires_at);

  if (now > expiresAt) {
    return { success: false, error: 'El código ha expirado.' };
  }

  // Consumir el código
  await supabaseAdmin.from('otps').delete().eq('id', otpData.id);

  try {
    // Si viene de Recepción (Walk-in / Clase de prueba)
    if (datosExtra?.isLead) {
      console.log('[validarOtp] Validación exitosa para Lead (RecepcionPanel).')
      return { success: true }
    }

    // Intercepción Smart Onboarding para Registro
    if (datosExtra?.isRegister || datosExtra?.cedula) {
      const cedulaRaw = datosExtra.cedula || '';
      const cedulaNormalizada = cedulaRaw.replace(/[\s\-\.]/g, '').toUpperCase();
      const matchLetra = cedulaNormalizada.match(/^([VEJGP])(\d+)$/);
      const cedulaConGuion = matchLetra ? `${matchLetra[1]}-${matchLetra[2]}` : cedulaNormalizada;

      let query = supabaseAdmin
        .from('usuarios')
        .select('id, cedula_rif, nombre_completo, email, telefono, rol, acepto_terminos, sede_id');

      if (cedulaConGuion !== cedulaNormalizada) {
        query = query.or(`cedula_rif.eq.${cedulaNormalizada},cedula_rif.eq.${cedulaConGuion}`);
      } else {
        query = query.eq('cedula_rif', cedulaNormalizada);
      }

      const { data: usuarioExistente } = await query.limit(1).maybeSingle();

      if (!usuarioExistente) {
        return {
          success: true,
          estado: 'NUEVO' as const,
          message: 'Usuario nuevo.'
        };
      }

      if (usuarioExistente.acepto_terminos === true) {
        return {
          success: true,
          estado: 'COMPLETO' as const,
          usuario: usuarioExistente,
          message: 'Esta cédula ya está registrada y activa.'
        };
      }

      // Si existe y acepto_terminos === false
      return {
        success: true,
        estado: 'ESCALONADO' as const,
        usuario: {
          id: usuarioExistente.id,
          nombre_completo: usuarioExistente.nombre_completo,
          cedula_rif: usuarioExistente.cedula_rif,
          email: usuarioExistente.email,
          sede_id: usuarioExistente.sede_id
        },
        message: 'Pre-registro en recepción detectado.'
      };
    }

    // Flujo de migración (fallback)
    if (datosExtra?.isMigration) {
      const user = datosExtra.user;
      const { emailFicticio, claveFicticia } = generarIdentidadFantasma(user.cedula_rif || user.id);
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: emailFicticio,
        password: claveFicticia,
        email_confirm: true,
        user_metadata: {
          name: user.nombre_completo,
          role: 'ATLETA'
        }
      });
      if (authError || !authData.user) {
        throw new Error('Error al crear credenciales de migración en Supabase Auth.');
      }
      await supabaseAdmin
        .from('usuarios')
        .update({
          telefono: tel,
          migracion_pendiente: false,
          email: emailFicticio,
          acepto_terminos: false
        })
        .eq('id', user.id);
      return { success: true, dummyEmail: emailFicticio, dummyPassword: claveFicticia };
    }

    return { success: true };
  } catch (err: any) {
    console.error('[validarOtp] Excepción capturada:', err.message)
    return { success: false, error: err.message }
  }
}

export async function completarRegistroUsuario(payload: {
  estado: 'NUEVO' | 'ESCALONADO'
  cedula: string
  telefono: string
  password: string
  nombre?: string
  apellido?: string
  sedeId?: string
  usuarioId?: string
  fechaNacimiento?: string
  genero?: string
}) {
  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const cedulaNormalizada = payload.cedula.replace(/[\s\-\.]/g, '').toUpperCase();

  try {
    if (payload.estado === 'ESCALONADO') {
      // 1. Localizar usuario existente en public.usuarios
      let usuario = null;
      if (payload.usuarioId) {
        const { data } = await supabaseAdmin
          .from('usuarios')
          .select('id, cedula_rif, email, nombre_completo')
          .eq('id', payload.usuarioId)
          .single();
        usuario = data;
      }

      if (!usuario) {
        const matchLetra = cedulaNormalizada.match(/^([VEJGP])(\d+)$/);
        const cedulaConGuion = matchLetra ? `${matchLetra[1]}-${matchLetra[2]}` : cedulaNormalizada;
        const { data } = await supabaseAdmin
          .from('usuarios')
          .select('id, cedula_rif, email, nombre_completo')
          .or(`cedula_rif.eq.${cedulaNormalizada},cedula_rif.eq.${cedulaConGuion}`)
          .maybeSingle();
        usuario = data;
      }

      if (!usuario) {
        return { success: false, error: 'No se encontró el registro del atleta para activar.' };
      }

      // 2. CRÍTICO: NO usar auth.admin.createUser. Inyectar contraseña en auth.users existente:
      const { error: authUpdateErr } = await supabaseAdmin.auth.admin.updateUserById(usuario.id, {
        password: payload.password
      });

      if (authUpdateErr) {
        console.error('[completarRegistroUsuario] Error actualizando contraseña en Auth:', authUpdateErr);
        return { success: false, error: 'Error al establecer contraseña: ' + authUpdateErr.message };
      }

      // Determinar email para login
      let emailUsuario = usuario.email;
      if (!emailUsuario) {
        const { data: authData } = await supabaseAdmin.auth.admin.getUserById(usuario.id);
        emailUsuario = authData?.user?.email || `${cedulaNormalizada}@fitnessfactory.local`;
      }

      // 3. UPDATE en public.usuarios seteando acepto_terminos = true
      const { error: updateErr } = await supabaseAdmin
        .from('usuarios')
        .update({
          acepto_terminos: true,
          email: emailUsuario,
          migracion_pendiente: false
        })
        .eq('id', usuario.id);

      if (updateErr) {
        console.error('[completarRegistroUsuario] Error actualizando public.usuarios:', updateErr);
        return { success: false, error: 'Error activando la cuenta: ' + updateErr.message };
      }

      return { success: true, email: emailUsuario, password: payload.password };

    } else {
      // NUEVO (Flujo 1)
      const nombreCompleto = `${payload.nombre?.trim() || ''} ${payload.apellido?.trim() || ''}`.trim();
      const { emailFicticio } = generarIdentidadFantasma(cedulaNormalizada);

      // 1. Crear en auth.users con la contraseña proporcionada por el usuario
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: emailFicticio,
        password: payload.password,
        email_confirm: true,
        user_metadata: {
          name: nombreCompleto,
          role: 'ATLETA'
        }
      });

      if (authError || !authData.user) {
        console.error('[completarRegistroUsuario] Error auth.users (NUEVO):', authError);
        return { success: false, error: 'Error al crear credenciales de acceso: ' + authError?.message };
      }

      const newUserId = authData.user.id;

      // 2. Insertar en public.usuarios con acepto_terminos: true
      const { error: insertErr } = await supabaseAdmin
        .from('usuarios')
        .upsert({
          id: newUserId,
          cedula_rif: cedulaNormalizada,
          nombre_completo: nombreCompleto,
          telefono: payload.telefono,
          rol: 'ATLETA',
          sede_id: payload.sedeId || null,
          email: emailFicticio,
          fecha_nacimiento: payload.fechaNacimiento || null,
          genero: payload.genero || null,
          acepto_terminos: true,
          migracion_pendiente: false
        });

      if (insertErr) {
        console.error('[completarRegistroUsuario] Error insertando public.usuarios (NUEVO):', insertErr);
        await supabaseAdmin.auth.admin.deleteUser(newUserId);
        return { success: false, error: 'Error al guardar los datos del usuario: ' + insertErr.message };
      }

      // 3. Asignación Automática de Clase de Prueba (Onboarding de Cortesía - Solo Flujo NUEVO)
      try {
        let planId: string | null = null;
        const { data: planPrueba } = await supabaseAdmin
          .from('planes')
          .select('id')
          .ilike('nombre', '%Clase de Prueba%')
          .limit(1)
          .maybeSingle();

        if (planPrueba?.id) {
          planId = planPrueba.id;
        } else {
          const { data: fallbackPlan } = await supabaseAdmin
            .from('planes')
            .select('id')
            .eq('tipo', 'SESIONES')
            .eq('sesiones_total', 1)
            .limit(1)
            .maybeSingle();
          planId = fallbackPlan?.id || '31d7a0c9-715b-4800-8ad9-47ef8cead520';
        }

        if (planId) {
          const fechaCorte = new Date();
          fechaCorte.setDate(fechaCorte.getDate() + 15); // Vencimiento a 15 días

          const { error: subErr } = await supabaseAdmin.from('suscripciones').insert({
            usuario_id: newUserId,
            plan_id: planId,
            estado: 'ACTIVO',
            sesiones_restantes: 1,
            fecha_corte: fechaCorte.toISOString(),
            metadata: {
              origen: 'onboarding_registro',
              tipo_cortesia: 'clase_de_prueba',
              asignado_el: new Date().toISOString()
            }
          });

          if (subErr) {
            console.error('[completarRegistroUsuario] Error asignando suscripción de prueba:', subErr);
          }
        }
      } catch (subException) {
        console.error('[completarRegistroUsuario] Excepción al asignar clase de prueba:', subException);
      }

      return { success: true, email: emailFicticio, password: payload.password };
    }
  } catch (err: any) {
    console.error('[completarRegistroUsuario] Excepción:', err);
    return { success: false, error: err.message || 'Error inesperado durante el registro.' };
  }
}
