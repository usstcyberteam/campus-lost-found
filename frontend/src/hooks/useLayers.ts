import { listLayers } from '../api/layers'
import { useAsync, type AsyncState } from './useAsync'
import type { Layer } from '../types'

export function useLayers(): AsyncState<Layer[]> {
  return useAsync(() => listLayers(), [])
}