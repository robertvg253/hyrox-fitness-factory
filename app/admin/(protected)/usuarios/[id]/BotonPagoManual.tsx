'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import ModalCobroManual from '@/components/admin/ModalCobroManual'

interface Props {
  suscripcionId: string;
  precioPlan: number;
}

export default function BotonPagoManual({ suscripcionId, precioPlan }: Props) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleModalSuccess = () => {
    setIsModalOpen(false);
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className="mt-4 w-full py-2 bg-[#02D7E5]/10 hover:bg-[#02D7E5]/20 text-[#02D7E5] text-sm font-semibold rounded-lg transition-colors border border-[#02D7E5]/20"
      >
        Realizar Pago Manual
      </button>

      {isModalOpen && (
        <ModalCobroManual
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          suscripcionId={suscripcionId}
          precioPlan={precioPlan}
          onSuccess={handleModalSuccess}
        />
      )}
    </>
  )
}
