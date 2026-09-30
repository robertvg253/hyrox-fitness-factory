import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  "https://hbegtmhjsywbqbbgpqrg.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhiZWd0bWhqc3l3YnFiYmdwcXJnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDA0NTAyNSwiZXhwIjoyMDk5NjIxMDI1fQ.VhKtCwarCihRSYqRZpUkdYNKOCWoUEFcV6BV0n4l-4U"
);

async function check() {
  const { data, error } = await supabase.from('planes').select('*').limit(1);
  console.log(JSON.stringify(data, null, 2));
}
check();
