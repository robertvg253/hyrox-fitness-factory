'use client'

import { Toaster, ToastBar } from 'react-hot-toast'

import { usePathname } from 'next/navigation'

export function ToastProvider() {
  const pathname = usePathname()
  const isAdmin = pathname?.startsWith('/admin')

  return (
    <Toaster 
      position={isAdmin ? "bottom-right" : "top-center"}
      toastOptions={{
        duration: 4000,
        style: {
          background: '#18181b', // zinc-900
          color: '#fff',
          border: '1px solid rgba(2, 215, 229, 0.2)', // Borde sutil cyan
          borderRadius: '9999px',
          padding: '8px 16px',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
        }
      }}
    >
      {(t) => (
        <div
          style={{
            marginTop: isAdmin ? '0' : '54px', // Evita chocar con la isla dinámica en iOS si es top
            marginBottom: isAdmin ? '10px' : '0',
            animation: t.visible 
              ? (isAdmin ? 'slideInRightToast 0.4s ease-out forwards' : 'dynamicToastEnter 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards')
              : (isAdmin ? 'slideOutRightToast 0.4s ease-in forwards' : 'dynamicToastLeave 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards'),
          }}
        >
          <ToastBar toast={t} style={{ ...t.style, animation: 'none' }} />
        </div>
      )}
    </Toaster>
  )
}
