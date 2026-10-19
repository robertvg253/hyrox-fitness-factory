import { redirect } from 'next/navigation';
import { createClient } from '@/src/utils/supabase/server';
import { isSuperAdmin } from '@/src/utils/permissions';

export default async function ConfiguracionLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user?.email) {
    redirect('/admin/login');
  }

  const { data: userData } = await supabase
    .from('usuarios')
    .select('rol')
    .eq('id', user.id)
    .single();

  if (!isSuperAdmin(userData?.rol)) {
    redirect('/admin/dashboard');
  }

  return <>{children}</>;
}
