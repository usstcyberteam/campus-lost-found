import { useCallback, useEffect, useState } from 'react'

export interface TTS {
  isSupported: boolean
  speaking: boolean
  speak: (text: string, lang?: string) => void
  stop: () => void
}

/** 语音播报：speak 会先取消当前朗读再播新内容（打断式切换）。 */
export function useTTS(): TTS {
  const [isSupported] = useState(() => typeof window !== 'undefined' && 'speechSynthesis' in window)
  const [speaking, setSpeaking] = useState(false)

  const speak = useCallback((text: string, lang = 'zh-CN') => {
    if (!('speechSynthesis' in window) || !text.trim()) return
    const synth = window.speechSynthesis
    synth.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = lang
    utterance.rate = 1.0
    utterance.pitch = 1.0
    utterance.onend = () => setSpeaking(false)
    utterance.onerror = () => setSpeaking(false)
    // 部分浏览器不触发 onstart：先乐观置位，保证按钮即时切到朗读中状态
    setSpeaking(true)
    synth.speak(utterance)
  }, [])

  const stop = useCallback(() => {
    if (!('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    setSpeaking(false)
  }, [])

  // 卸载时停止朗读，避免离开页面后声音继续
  useEffect(
    () => () => {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel()
    },
    [],
  )

  return { isSupported, speaking, speak, stop }
}