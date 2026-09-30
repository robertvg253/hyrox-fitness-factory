'use server'

import { createClient } from '@/src/utils/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'



export async function verificarCedula(cedula: string) {
  const supabase = await createClient()

  try {
    const { data, error } = await supabase
      .from('usuarios')
      .select('id, cedula_rif, nombre_completo, telefono, migracion_pendiente')
      .eq('cedula_rif', cedula.trim())
      .maybeSingle()

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

export async function iniciarSesionUsuario(cedula: string, password: string) {
  const supabase = await createClient()
  
  const emailUsuario = `${cedula.trim()}@fitnessfactory.local`

  const { error } = await supabase.auth.signInWithPassword({
    email: emailUsuario,
    password
  })

  if (error) {
    return { success: false, error: 'Cédula o contraseña incorrecta.' }
  }

  return { success: true }
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
    let finalUserId = ''
    let dummyEmail = ''
    const dummyPassword = crypto.randomUUID() + 'A1!'

    if (datosExtra?.isRegister) {
      dummyEmail = `${datosExtra.cedula}@fitnessfactory.local`
      console.log(`[validarOtp] Creando usuario fantasma en auth.users para registro: ${dummyEmail}`)

      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: dummyEmail,
        password: dummyPassword,
        email_confirm: true,
        user_metadata: {
          name: datosExtra.nombre,
          role: 'ATLETA'
        }
      })

      if (authError || !authData.user) {
        console.error('[validarOtp] Error auth.users (Register):', authError)
        throw new Error('Error al crear credenciales seguras en Supabase Auth.')
      }

      finalUserId = authData.user.id
      console.log(`[validarOtp] Usuario creado en auth.users con ID: ${finalUserId}. Insertando en public.usuarios...`)

      const { error: insertErr } = await supabaseAdmin
        .from('usuarios')
        .upsert({
          id: finalUserId,
          cedula_rif: datosExtra.cedula,
          nombre_completo: datosExtra.nombre,
          telefono: tel,
          rol: 'ATLETA',
          etiqueta_lead: 'PRUEBA_PENDIENTE',
          migracion_pendiente: false
        })

      if (insertErr) {
        console.error('[validarOtp] Error insertando en public.usuarios (Register):', insertErr)
        await supabaseAdmin.auth.admin.deleteUser(finalUserId)
        throw new Error('Error al registrar el perfil del usuario.')
      }
    } else if (datosExtra?.isMigration) {
      const user = datosExtra.user
      dummyEmail = `${user.cedula_rif || user.id}@fitnessfactory.local`
      console.log(`[validarOtp] Creando usuario fantasma en auth.users para migración: ${dummyEmail}`)

      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: dummyEmail,
        password: dummyPassword,
        email_confirm: true,
        user_metadata: {
          name: user.nombre_completo,
          role: 'ATLETA'
        }
      })
      
      if (authError || !authData.user) {
        console.error('[validarOtp] Error auth.users (Migration):', authError)
        throw new Error('Error al crear credenciales de migración en Supabase Auth.')
      }

      finalUserId = authData.user.id
      console.log(`[validarOtp] Usuario de migración creado en auth.users con ID: ${finalUserId}. Actualizando public.usuarios...`)

      const { error: insertErr } = await supabaseAdmin
        .from('usuarios')
        .update({
          telefono: tel,
          migracion_pendiente: false
        })
        .eq('id', user.id)

      if (insertErr) {
        console.error('[validarOtp] Error actualizando en public.usuarios (Migration):', insertErr)
        throw new Error('Error al actualizar el perfil de migración.')
      }

      finalUserId = user.id
    } else if (datosExtra?.isLead) {
      console.log('[validarOtp] Validación exitosa para Lead (RecepcionPanel).')
      return { success: true }
    } else {
      // Normal Login
      console.log(`[validarOtp] Buscando usuario existente con teléfono: ${tel}`)
      const { data: userRecord, error: searchError } = await supabaseAdmin.from('usuarios').select('id, cedula_rif').eq('telefono', tel).single()
      
      if (searchError || !userRecord) {
        console.error('[validarOtp] Error buscando usuario (Login):', searchError)
        throw new Error('Usuario no encontrado o múltiples coincidencias.')
      }
      
      finalUserId = userRecord.id
      dummyEmail = `${userRecord.cedula_rif || finalUserId}@fitnessfactory.local`
      
      // Update password for login so we can signInWithPassword
      console.log(`[validarOtp] Forzando nueva clave temporal para login del usuario: ${finalUserId}`)
      const { error: updateAuthErr } = await supabaseAdmin.auth.admin.updateUserById(finalUserId, {
        password: dummyPassword
      })

      if (updateAuthErr) {
         console.error('[validarOtp] Error actualizando password (Login):', updateAuthErr)
         throw new Error('Error preparando la sesión segura.')
      }
    }

    console.log(`[validarOtp] Todo exitoso. Devolviendo dummy credentials para auto-login.`)
    return { success: true, dummyEmail, dummyPassword }
  } catch (err: any) {
    console.error('[validarOtp] Excepción capturada:', err.message)
    return { success: false, error: err.message }
  }
}
