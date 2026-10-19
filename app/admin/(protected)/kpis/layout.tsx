import { redirect } from 'next/navigation';
import { createClient } from '@/src/utils/supabase/server';
import { hasFinanceAccess } from '@/src/utils/permissions';

export default async function KpisLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user?.email) {
    redirect('/admin/login');
  }

  const { data: userData } = await supabase
    .from('usuarios')
    .select('rol')
    .eq('email', user.email)
    .single();

  if (!hasFinanceAccess(userData?.rol)) {
    redirect('/admin/dashboard');
  }

  return <>{children}</>;
}
