import { BottomNav } from '@/components/BottomNav'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-black text-white pb-24 font-sans">
      <div className="max-w-md mx-auto relative min-h-screen">
        {children}
        <BottomNav />
      </div>
    </div>
  )
}
