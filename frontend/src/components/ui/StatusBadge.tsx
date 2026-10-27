import Badge from './Badge'
import { statusLabels, type ItemStatus } from '../../types'

interface Props {
  status: ItemStatus
}

const variantMap: Record<ItemStatus, 'primary' | 'secondary' | 'mint' | 'coral' | 'gray'> = {
  searching: 'primary',
  reviewing: 'secondary',
  found: 'mint',
  pending: 'coral',
  returned: 'mint',
  withdrawn: 'gray',
}

export default function StatusBadge({ status }: Props) {
  return <Badge variant={variantMap[status]}>{statusLabels[status]}</Badge>
}
