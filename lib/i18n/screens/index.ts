import { train } from './train'
import { account } from './account'
import { home } from './home'
import { shared } from './shared'
/**
 * Per-screen dictionaries, merged into STRINGS (lib/i18n/strings.ts). Each
 * module exports `{ en, fr }` with identical keys, namespaced by screen
 * (e.g. 'train.nextDeparture'). Add a module here, never edit another's.
 */
export type ScreenDict = { en: Record<string, string>; fr: Record<string, string> }

export const SCREENS: ScreenDict[] = [train, account, home, shared]
