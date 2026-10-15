import CommuteBoardHome from '@/components/home/CommuteBoardHome'

// One Home for both layouts (UX v2 Direction A "Commute Board"). The full (wallet)
// layout only adds the one-line wallet strip, which CommuteBoardHome gates on
// !RELEASE_MODE + signed in.
export default function HomeScreen() {
  return <CommuteBoardHome />
}
