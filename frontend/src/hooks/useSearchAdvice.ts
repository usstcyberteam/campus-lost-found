import { useState } from 'react'
import { searchAdvice, type SearchAdviceInput } from '../api/ai'
import type { SearchAdvice } from '../types'
import { errorMessage } from '../utils/error'

export interface SearchAdviceState {
  advice: SearchAdvice | null
  error: string
  pending: boolean
  request: (body: SearchAdviceInput) => Promise<boolean>
}

export function useSearchAdvice(initial: SearchAdvice | null = null): SearchAdviceState {
  const [advice, setAdvice] = useState<SearchAdvice | null>(initial)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  async function request(body: SearchAdviceInput): Promise<boolean> {
    setPending(true)
    setError('')
    try {
      setAdvice(await searchAdvice(body))
      return true
    } catch (e) {
      setError(errorMessage(e, '地点推荐失败，请稍后重试'))
      return false
    } finally {
      setPending(false)
    }
  }

  return { advice, error, pending, request }
}