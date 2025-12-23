import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_URL

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      'Missing Supabase environment variables. Please check your .env file:\n' +
      `NEXT_PUBLIC_SUPABASE_URL: ${supabaseUrl ? '✓' : '✗'}\n` +
      `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_URL: ${supabaseKey ? '✓' : '✗'}`
    )
  }

  return createBrowserClient(supabaseUrl, supabaseKey)
}

