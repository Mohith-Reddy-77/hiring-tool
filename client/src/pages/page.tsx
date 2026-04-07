import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'

export default async function Page() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  // `todos` table removed from Supabase; show empty placeholder
  return (
    <ul>
      <li className="muted">No example items (todos table removed)</li>
    </ul>
  )
}
