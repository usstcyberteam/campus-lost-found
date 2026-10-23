import { useCallback, useEffect, useRef, useState } from 'react'

// Web Speech API 未进入 TS lib.dom，按需声明最小子集，避免 any
interface SpeechRecognitionAlternativeLike {
  readonly transcript: string
}

interface SpeechRecognitionResultLike {
  readonly isFinal: boolean
  readonly length: number
  readonly [index: number]: SpeechRecognitionAlternativeLike
}

interface SpeechRecognitionResultListLike {
  readonly length: number
  readonly [index: number]: SpeechRecognitionResultLike
}

interface SpeechRecognitionEventLike extends Event {
  readonly resultIndex: number
  readonly results: SpeechRecognitionResultListLike
}

interface SpeechRecognitionErrorEventLike extends Event {
  readonly error: string
}

interface SpeechRecognitionLike extends EventTarget {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike

type SpeechRecognitionWindow = Window & {
  SpeechRecognition?: SpeechRecognitionCtor
  webkitSpeechRecognition?: SpeechRecognitionCtor
}

// 停顿 3s 自动结束，避免长连接麦克风一直开着
const SILENCE_STOP_MS = 3000
const VOICE_LANG = 'zh-CN'
const INPUT_MAX = 2000

const ERROR_MESSAGES: Record<string, string> = {
  'no-speech': '没有听到声音，请靠近麦克风再试',
  'not-allowed': '麦克风权限被拒绝，请在浏览器设置中允许',
  'service-not-allowed': '语音服务不可用，请稍后再试',
  'audio-capture': '没有检测到可用麦克风',
  network: '语音识别网络异常，请稍后再试',
}

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  const w = window as SpeechRecognitionWindow
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export interface VoiceInput {
  supported: boolean
  listening: boolean
  error: string
  toggle: () => void
}

/**
 * 语音输入：识别期间通过 onUpdate(finalText + interimText) 实时回写输入框，
 * 开始时的既有内容由调用方保存并在回调里自行拼接。
 */
export function useVoiceInput(onUpdate: (partial: string) => void): VoiceInput {
  const [supported] = useState(() => getRecognitionCtor() !== null)
  const [listening, setListening] = useState(false)
  const [error, setError] = useState('')
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const finalRef = useRef('')
  const silenceTimer = useRef(0)
  const onUpdateRef = useRef(onUpdate)
  onUpdateRef.current = onUpdate

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimer.current) {
      window.clearTimeout(silenceTimer.current)
      silenceTimer.current = 0
    }
  }, [])

  const finish = useCallback(() => {
    clearSilenceTimer()
    setListening(false)
  }, [clearSilenceTimer])

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor()
    if (Ctor === null) return
    setError('')
    finalRef.current = ''
    const recognition = new Ctor()
    recognition.lang = VOICE_LANG
    recognition.continuous = true
    recognition.interimResults = true
    recognition.onresult = (event) => {
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i]
        const transcript = result[0]?.transcript ?? ''
        if (result.isFinal) finalRef.current += transcript
        else interim += transcript
      }
      onUpdateRef.current((finalRef.current + interim).slice(0, INPUT_MAX))
      clearSilenceTimer()
      silenceTimer.current = window.setTimeout(() => recognition.stop(), SILENCE_STOP_MS)
    }
    recognition.onerror = (event) => {
      setError(ERROR_MESSAGES[event.error] ?? '语音识别失败，请稍后再试')
    }
    recognition.onend = finish
    recognitionRef.current = recognition
    try {
      recognition.start()
      setListening(true)
    } catch {
      // start 可能因状态机异常抛 InvalidStateError：丢弃实例，回到未录音状态
      recognitionRef.current = null
      setListening(false)
    }
  }, [clearSilenceTimer, finish])

  const stop = useCallback(() => {
    recognitionRef.current?.stop()
    finish()
  }, [finish])

  const toggle = useCallback(() => {
    if (listening) {
      stop()
      return
    }
    start()
  }, [listening, start, stop])

  // 卸载时必须释放麦克风
  useEffect(
    () => () => {
      clearSilenceTimer()
      recognitionRef.current?.abort()
      recognitionRef.current = null
    },
    [clearSilenceTimer],
  )

  return { supported, listening, error, toggle }
}