export interface ClusterInput<T> {
  x: number
  y: number
  data: T
}

export interface PointCluster<T> {
  x: number
  y: number
  items: T[]
}

// 贪心聚合：每次取一个种子点，吸收半径内的点；缩放变化时用新的半径重算即可
export function clusterPoints<T>(inputs: readonly ClusterInput<T>[], radius: number): PointCluster<T>[] {
  const remaining = inputs.slice()
  const clusters: PointCluster<T>[] = []
  while (remaining.length > 0) {
    const seed = remaining.shift()
    if (!seed) break
    const members = [seed.data]
    let sumX = seed.x
    let sumY = seed.y
    for (let index = remaining.length - 1; index >= 0; index -= 1) {
      const candidate = remaining[index]
      if (Math.hypot(candidate.x - seed.x, candidate.y - seed.y) > radius) continue
      members.push(candidate.data)
      sumX += candidate.x
      sumY += candidate.y
      remaining.splice(index, 1)
    }
    clusters.push({ x: sumX / members.length, y: sumY / members.length, items: members })
  }
  return clusters
}