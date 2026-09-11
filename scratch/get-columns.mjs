import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env.local', 'utf-8').split('\n').reduce((acc, line) => {
  const [key, ...val] = line.split('=');
  if (key && val.length) acc[key.trim()] = val.join('=').trim().replace(/"/g, '');
  return acc;
}, {});

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
)

async function run() {
  const { data, error } = await supabase
    .from('usuarios')
    .select('*')
    .limit(1)
  
  if (error) {
    console.error('Error:', error)
  } else {
    if (data && data.length > 0) {
      console.log('Columns:', Object.keys(data[0]))
    } else {
      console.log('No data, cannot infer columns. Try fetching definition from postgres.')
    }
  }
}

run()
