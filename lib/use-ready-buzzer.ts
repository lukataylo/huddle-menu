'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * The "visual buzzer": when `ready` flips from false to true, vibrate the
 * device and fire a browser notification (if the customer allowed them).
 * The visual side (flashing/pulsing) is up to the page.
 */
export function useReadyBuzzer(ready: boolean, message: string, title = 'Your food is ready! 🎉') {
  const wasReady = useRef(ready)

  useEffect(() => {
    if (ready && !wasReady.current) {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate([300, 100, 300, 100, 500])
      }
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        try {
          new Notification(title, { body: message })
        } catch {
          // some mobile browsers only allow notifications via service workers
        }
      }
    }
    wasReady.current = ready
  }, [ready, message, title])
}

/** Button state helper for asking notification permission from a user gesture. */
export function useNotificationPermission() {
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('unsupported')

  useEffect(() => {
    // deferred so the post-hydration state update isn't a synchronous cascade
    const timer = setTimeout(() => {
      if (typeof Notification !== 'undefined') setPermission(Notification.permission)
    }, 0)
    return () => clearTimeout(timer)
  }, [])

  async function request() {
    if (typeof Notification === 'undefined') return
    const result = await Notification.requestPermission()
    setPermission(result)
  }

  return { permission, request }
}
