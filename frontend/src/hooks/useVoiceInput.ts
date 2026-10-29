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
  'service-not-allowed': '语音识别服务不可用：浏览器的语音识别依赖在线服务，当前网络无法访问，请检查代理或改用文字输入',
  'audio-capture': '没有检测到可用麦克风',
  network: '语音识别服务连接失败：浏览器的语音识别依赖在线服务，当前网络无法访问，请检查代理或改用文字输入',
}

// 用户主动停止时 Chrome 会先触发 aborted 错误再 onend：这不是错误，静默处理避免误报
const SILENT_ERRORS = new Set(['aborted'])

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  const w = window as SpeechRecognitionWindow
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export interface VoiceInput {
  supported: boolean
  listening: boolean
  error: string
  toggle: () => void
  /** 立即结束识别（发送消息时用，避免识别回调继续写回输入框） */
  stop: () => void
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
  const disposedRef = useRef(false)
  // getUserMedia 异步期间 listening 仍为 false：连点麦克风会重复创建识别实例，需独立守卫
  const pendingRef = useRef(false)
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

  /**
   * 显式申请麦克风权限：SpeechRecognition 在权限状态未知时可能静默失败（不弹申请框），
   * 先在用户手势的同步调用栈里发起 getUserMedia 触发浏览器权限弹窗，
   * 授权后立即释放音轨再启动识别，拒绝时给出可操作的错误提示。
   */
  const requestMicPermission = useCallback((): Promise<boolean> => {
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      setError('语音输入需要 HTTPS 或 localhost 环境，当前页面无法访问麦克风')
      return Promise.resolve(false)
    }
    const media = typeof navigator !== 'undefined' ? navigator.mediaDevices : undefined
    if (!media?.getUserMedia) {
      // 无 getUserMedia 但存在 SpeechRecognition：保持直接启动（浏览器自行处理权限）
      return Promise.resolve(true)
    }
    return media
      .getUserMedia({ audio: true })
      .then((stream) => {
        stream.getTracks().forEach((track) => track.stop())
        return true
      })
      .catch(() => {
        setError('麦克风权限被拒绝，请在浏览器地址栏或站点设置中允许后重试')
        return false
      })
  }, [])

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor()
    if (Ctor === null) return
    if (pendingRef.current) return
    pendingRef.current = true
    setError('')
    finalRef.current = ''
    void requestMicPermission().then((granted) => {
      pendingRef.current = false
      if (!granted || disposedRef.current) return
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
        if (SILENT_ERRORS.has(event.error)) return
        setError(ERROR_MESSAGES[event.error] ?? '语音识别失败，请稍后再试')
      }
      recognition.onend = finish
      recognitionRef.current = recognition
      try {
        recognition.start()
        setListening(true)
      } catch {
        // start 可能因状态机异常抛 InvalidStateError：丢弃实例并给出提示，不再静默
        recognitionRef.current = null
        setListening(false)
        setError('无法启动语音识别，请稍后重试')
      }
    })
  }, [clearSilenceTimer, finish, requestMicPermission])

  const stop = useCallback(() => {
    pendingRef.current = false
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

  // 卸载时必须释放麦克风，并阻止权限申请回调在卸载后再启动识别
  useEffect(
    () => () => {
      disposedRef.current = true
      clearSilenceTimer()
      recognitionRef.current?.abort()
      recognitionRef.current = null
    },
    [clearSilenceTimer],
  )

  return { supported, listening, error, toggle, stop }
}