import { createClient } from '@/src/utils/supabase/server'
import { redirect } from 'next/navigation'
import AtletasDirectorioClient, { AtletaDirectorioItem } from './AtletasDirectorioClient'
import { Users, ShieldCheck } from 'lucide-react'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function formatSegundosAMM_SS(totalSec: number | null | undefined): string {
  if (totalSec === null || totalSec === undefined || totalSec <= 0) return '--:--'
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

export default async function AtletasPage() {
  const supabase = await createClient()

  // 1. Validar autenticación
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/admin/login')
  }

  // 2. Fetch de todos los atletas registrados
  const { data: usuariosAtletas } = await supabase
    .from('usuarios')
    .select('id, nombres, cedula, telefono, email, talla_franela, rol')
    .ilike('rol', 'atleta')
    .order('creado_en', { ascending: false })

  const atletasList = usuariosAtletas || []

  // 3. Fetch de todos los tiempos históricos
  const { data: todosTiempos } = await supabase
    .from('tiempos_historicos')
    .select('usuario_id, numero_test, tiempo_segundos')

  // Agrupar tiempos por atleta
  const tiemposMap = new Map<string, Map<number, number>>()
  todosTiempos?.forEach((t) => {
    if (t.usuario_id && typeof t.tiempo_segundos === 'number' && t.tiempo_segundos > 0) {
      const userTests = tiemposMap.get(t.usuario_id) || new Map<number, number>()
      userTests.set(t.numero_test, t.tiempo_segundos)
      tiemposMap.set(t.usuario_id, userTests)
    }
  })

  // 4. Formatear datos para el Directorio
  const atletasFormatted: AtletaDirectorioItem[] = atletasList.map((atleta) => {
    const userTests = tiemposMap.get(atleta.id) || new Map<number, number>()
    const testList = Array.from(userTests.values())

    const suma = testList.reduce((acc, v) => acc + v, 0)
    const promSec = testList.length > 0 ? Math.round(suma / testList.length) : 0
    const prSec = testList.length > 0 ? Math.min(...testList) : 0

    return {
      id: atleta.id,
      nombres: atleta.nombres || 'Atleta Sin Nombre',
      cedula: atleta.cedula || 'N/A',
      telefono: atleta.telefono || null,
      email: atleta.email || 'N/A',
      talla_franela: atleta.talla_franela || null,
      tests: {
        test1: formatSegundosAMM_SS(userTests.get(1)),
        test2: formatSegundosAMM_SS(userTests.get(2)),
        test3: formatSegundosAMM_SS(userTests.get(3)),
        test4: formatSegundosAMM_SS(userTests.get(4)),
      },
      promedioMMSS: formatSegundosAMM_SS(promSec),
      prMMSS: formatSegundosAMM_SS(prSec),
    }
  })

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header de la Vista */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-lg bg-[#02D7E5]/10 border border-[#02D7E5]/30 text-[#02D7E5] font-bold text-[10px] uppercase tracking-widest">
              Directorio de Atletas
            </span>
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight mt-1">
            Atletas Registrados
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Consulta consolidada de competidores, tiempos históricos en los 4 tests y récords personales (PR).
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-zinc-950/80 border border-zinc-800 text-xs font-semibold text-zinc-300">
            <Users className="w-4 h-4 text-[#02D7E5]" />
            <span>{atletasFormatted.length} Atleta(s)</span>
          </div>
        </div>
      </header>

      {/* Contenido Interactivo */}
      <AtletasDirectorioClient atletas={atletasFormatted} />
    </div>
  )
}
