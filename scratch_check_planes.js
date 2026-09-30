const URL = "https://hbegtmhjsywbqbbgpqrg.supabase.co/rest/v1/planes?select=*&limit=1";
const KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhiZWd0bWhqc3l3YnFiYmdwcXJnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDA0NTAyNSwiZXhwIjoyMDk5NjIxMDI1fQ.VhKtCwarCihRSYqRZpUkdYNKOCWoUEFcV6BV0n4l-4U";

async function check() {
  const res = await fetch(URL, {
    headers: {
      "apikey": KEY,
      "Authorization": `Bearer ${KEY}`
    }
  });
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}
check();
