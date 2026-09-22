import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { telefono: rawTelefono, codigo } = body;

    if (!rawTelefono || !codigo) {
      return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 });
    }

    let telefono = rawTelefono.replace(/\s+/g, '');
    if (!telefono.startsWith('+')) {
      telefono = '+' + telefono;
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Buscar el OTP correspondiente
    const { data: otps, error } = await supabase
      .from('otps')
      .select('id, expires_at')
      .eq('telefono', telefono)
      .eq('codigo', codigo)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error || !otps || otps.length === 0) {
      return NextResponse.json({ error: 'Código inválido o expirado' }, { status: 400 });
    }

    const otpData = otps[0];
    const now = new Date();
    const expiresAt = new Date(otpData.expires_at);

    // Verificar expiración
    if (now > expiresAt) {
      return NextResponse.json({ error: 'Código inválido o expirado' }, { status: 400 });
    }

    // Consumir el código (solo un uso)
    await supabase.from('otps').delete().eq('id', otpData.id);

    return NextResponse.json({ message: 'Código verificado correctamente' }, { status: 200 });

  } catch (error: any) {
    console.error('[OTP Verify] Error crítico:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
