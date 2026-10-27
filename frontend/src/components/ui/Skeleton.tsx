import styles from './Skeleton.module.css'

type Variant = 'text' | 'card' | 'circle'

interface Props {
  variant?: Variant
  width?: string
  height?: string
}

export default function Skeleton({ variant = 'text', width, height }: Props) {
  const style: Record<string, string> = {}
  if (width) style.width = width
  if (height) style.height = height
  return <div className={`${styles.skeleton} ${styles[variant]}`} style={style} aria-hidden="true" />
}
