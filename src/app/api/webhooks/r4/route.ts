import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('X-Api-Key');
    const secret = process.env.R4_WEBHOOK_SECRET;

    if (!secret || !signature) {
      return NextResponse.json({ error: 'Falta configuración de seguridad' }, { status: 401 });
    }

    // Validación HMAC-SHA256
    const hash = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    if (hash !== signature) {
      console.error('[Webhook R4] Firma inválida. Posible ataque.', { hash, signature });
      return NextResponse.json({ error: 'Firma inválida' }, { status: 401 });
    }

    // Si la firma es correcta, leemos los datos
    const payload = JSON.parse(rawBody);
    console.log('[Webhook R4] Payload verificado recibido:', payload);

    // Aquí irá tu lógica de actualización en Supabase según payload.status

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error('[Webhook R4] Error procesando notificación:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
