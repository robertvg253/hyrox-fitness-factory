import { BottomNav } from '@/components/BottomNav'
import Image from 'next/image'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-black text-white pb-24 font-sans">
      <div className="max-w-md mx-auto relative min-h-screen">
        {/* Header con Safe-Area (Compatible con Isla Dinámica / Notch de iOS) */}
        <header className="sticky top-0 z-40 w-full backdrop-blur-xl bg-black/85 border-b border-white/5 pt-12 sm:pt-14 pb-2.5 px-4 transition-all">
          <div className="flex items-center justify-between w-full max-w-md mx-auto">
            {/* Izquierda: Logo de Fitness Factory en tamaño muy pequeño */}
            <div className="flex items-center gap-2">
              <div className="relative w-6 h-6 overflow-hidden rounded-md bg-white/5 p-0.5 border border-white/10 flex items-center justify-center shrink-0">
                <Image
                  src="/images/LOGO TEXTURA01.png"
                  alt="Fitness Factory Logo"
                  width={20}
                  height={20}
                  className="object-contain"
                  priority
                />
              </div>
              <span className="text-[10px] font-bold tracking-widest text-zinc-400 uppercase">
                Fitness Factory
              </span>
            </div>

            {/* Centro: Espacio vacío para que la Isla Dinámica (Dynamic Island) / Notch no estorbe */}
            <div className="w-16 sm:w-20 pointer-events-none" aria-hidden="true" />

            {/* Derecha: Texto estilizado HYROX */}
            <div className="flex items-center">
              <span className="px-2.5 py-0.5 rounded-full bg-[#02D7E5]/15 border border-[#02D7E5]/30 text-[11px] font-black tracking-widest text-[#02D7E5] drop-shadow-sm">
                HYROX
              </span>
            </div>
          </div>
        </header>

        {children}
        <BottomNav />
      </div>
    </div>
  )
}
