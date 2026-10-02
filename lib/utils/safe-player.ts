/**
 * Run an expo-video player call that may hit an already-released player.
 *
 * useVideoPlayer releases the native player when its screen unmounts, and its
 * cleanup can run BEFORE our own focus/effect cleanups and interval ticks. Any
 * call on a released player throws NativeSharedObjectNotFoundException
 * ("Calling the 'pause' function has failed") — which crashed the Pulse reel
 * into the error boundary every time a video was closed. A released player has
 * nothing left to pause or read, so swallowing that is correct.
 */
export function safePlayer<T>(fn: () => T): T | undefined {
  try {
    return fn()
  } catch {
    return undefined
  }
}
