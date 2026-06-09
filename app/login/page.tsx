'use client'

import { supabase } from '../../lib/supabase/client'

export default function LoginPage() {
  async function testConnection() {
    const { data, error } = await supabase.auth.getSession()

    console.log('DATA', data)
    console.log('ERROR', error)

    alert('Supabase connected')
  }

  return (
    <main>
      <h1>Login</h1>

      <button onClick={testConnection}>
        Test Supabase
      </button>
    </main>
  )
}