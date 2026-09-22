import { NextResponse } from 'next/server'
import { getR4Config } from '@/src/services/r4-service'

export async function GET() {
  try {
    const { apiUrl, dispatcher } = getR4Config()
    
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10s timeout
    
    const response = await fetch(`${apiUrl}/restapi/api/`, {
      method: 'GET',
      signal: controller.signal,
      ...(dispatcher && { dispatcher })
    } as RequestInit)
    
    clearTimeout(timeoutId)
    
    // Si responde, no importa el HTTP status code, significa que el puente funcionó
    return NextResponse.json({ status: 'ONLINE', message: 'Proxy R4 Operativo' }, { status: 200 })
  } catch (error) {
    console.error('[Proxy Health Check] Fallo en la conexión:', error)
    return NextResponse.json({ status: 'OFFLINE', message: 'Proxy Caído / Desconectado' }, { status: 200 })
  }
}
