import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'

export interface CommuterTip {
  id: string
  tip: string
  author_name: string
  category: string
  upvotes: number
}

/* ── Static fallback tips ──────────────────────────── */

const FALLBACK_TIPS: CommuterTip[] = [
  { id: 'f1', tip: 'The 5:30 AM Express from Madina usually has plenty of window seats. Perfect for a quiet morning.', author_name: 'Ama K.', category: 'trotro', upvotes: 0 },
  { id: 'f2', tip: 'Avoid the Circle interchange between 5-6 PM. Take the Kaneshie route instead — faster by 20 mins.', author_name: 'Kojo B.', category: 'trotro', upvotes: 0 },
  { id: 'f3', tip: 'Trotro fares from Tema go up by ₵2 during peak hours. Travel before 6 AM to save.', author_name: 'Esi M.', category: 'trotro', upvotes: 0 },
  { id: 'f4', tip: 'The Kasoa-Kaneshie route has more vehicles on Mondays. Queue is usually shorter.', author_name: 'Kwaku D.', category: 'trotro', upvotes: 0 },
  { id: 'f5', tip: 'Train from Tema departs sharp at 6 AM. Arrive 10 mins early — it doesn\'t wait.', author_name: 'Nana A.', category: 'train', upvotes: 0 },
  { id: 'f6', tip: 'GPRTU-verified fares are always displayed at the station. Check before boarding to avoid overcharges.', author_name: 'GPRTU', category: 'gprtu', upvotes: 0 },
  { id: 'f7', tip: 'Mpakadan train has scenic river views after Akosombo. Try to sit on the left side.', author_name: 'Yaw P.', category: 'train', upvotes: 0 },
  { id: 'f8', tip: 'If a trotro mate quotes a higher fare than what\'s posted, you can report it on Troski.', author_name: 'Adjoa F.', category: 'gprtu', upvotes: 0 },
]

/* ── Fetch approved tips from Supabase ─────────────── */

async function fetchTips(): Promise<CommuterTip[]> {
  const { data, error } = await supabase
    .from('commuter_tips')
    .select('id, tip, author_name, category, upvotes')
    .eq('is_approved', true)
    .order('upvotes', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(30)

  if (error || !data?.length) return FALLBACK_TIPS
  return data as CommuterTip[]
}

/* ── Pick daily tip (deterministic by day) ─────────── */

function pickDaily(tips: CommuterTip[], category?: string): CommuterTip {
  const filtered = category
    ? tips.filter((t) => t.category === category || t.category === 'general')
    : tips
  const pool = filtered.length > 0 ? filtered : tips
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000)
  return pool[dayOfYear % pool.length]
}

/* ── Hook ──────────────────────────────────────────── */

export function useCommuterTips(category?: string) {
  const { data: tips = FALLBACK_TIPS } = useQuery({
    queryKey: ['commuter-tips'],
    queryFn: fetchTips,
    staleTime: 1000 * 60 * 60, // 1 hour
    gcTime: 1000 * 60 * 60 * 24, // cache 24h
  })

  const dailyTip = pickDaily(tips, category)

  return { tips, dailyTip }
}
