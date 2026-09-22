import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const rawTelefono = body.telefono;

    if (!rawTelefono) {
      return NextResponse.json({ error: 'El teléfono es obligatorio' }, { status: 400 });
    }

    // Limpia el teléfono quitando espacios y asegura que inicie con +
    let telefono = rawTelefono.replace(/\s+/g, '');
    if (!telefono.startsWith('+')) {
      telefono = '+' + telefono;
    }

    // Genera código numérico aleatorio de 6 dígitos
    const codigo = Math.floor(100000 + Math.random() * 900000).toString();

    // Fecha de expiración (5 minutos)
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 5);

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // --- ANTI-SPAM (LÍMITES) ---
    const limite24h = new Date();
    limite24h.setHours(limite24h.getHours() - 24);

    const { data: otpsPrevios, error: fetchErr } = await supabase
      .from('otps')
      .select('created_at')
      .eq('telefono', telefono)
      .gte('created_at', limite24h.toISOString())
      .order('created_at', { ascending: false });

    if (!fetchErr && otpsPrevios) {
      // 1. Cooldown 60 segundos
      if (otpsPrevios.length > 0) {
        const lastOtpTime = new Date(otpsPrevios[0].created_at).getTime();
        const nowTime = new Date().getTime();
        if (nowTime - lastOtpTime < 60000) {
          return NextResponse.json({ error: 'Por favor espera 60 segundos antes de pedir otro código' }, { status: 429 });
        }
      }
      // 2. Hard Limit 3/24h
      if (otpsPrevios.length >= 3) {
        return NextResponse.json({ error: 'Has excedido el límite de solicitudes (Max 3/24h)' }, { status: 429 });
      }
    }

    // --- INVALIDACIÓN ---
    // Eliminar OTPs anteriores para este número
    await supabase.from('otps').delete().eq('telefono', telefono);

    // Guardar en la base de datos
    const { error: insertError } = await supabase
      .from('otps')
      .insert({
        telefono,
        codigo,
        expires_at: expiresAt.toISOString()
      });

    if (insertError) {
      console.error('[OTP Send] Error guardando código:', insertError);
      return NextResponse.json({ error: 'Error generando código de validación' }, { status: 500 });
    }

    // 1. Garantizar que el código sea un String explícito
    const otpString = String(codigo);

    // Enviar código vía Callbell (WhatsApp)
    const callbellUrl = 'https://api.callbell.eu/v1/messages/send';
    
    // 2. Construir el payload oficial de Callbell
    const callbellPayload = {
      to: telefono,
      from: "whatsapp",
      type: "text",
      channel_uuid: process.env.CALLBELL_CHANNEL_UUID,
      content: { text: `Tu código de verificación es ${otpString}` },
      template_uuid: process.env.CALLBELL_OTP_TEMPLATE_UUID,
      template_values: [otpString],
      optin_contact: true
    };

    // 3. Log de Auditoría ANTES de enviar (Para debug en Vercel/Local)
    console.log(">>> PAYLOAD CALLBELL:", JSON.stringify(callbellPayload, null, 2));

    const callbellResponse = await fetch(callbellUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.CALLBELL_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(callbellPayload)
    });

    if (!callbellResponse.ok) {
      const callbellError = await callbellResponse.text();
      console.error('[OTP Send] Error en Callbell:', callbellError);
      return NextResponse.json({ error: 'Error despachando mensaje a WhatsApp' }, { status: 502 });
    }

    return NextResponse.json({ message: 'Código enviado correctamente' }, { status: 200 });

  } catch (error: any) {
    console.error('[OTP Send] Error crítico:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
