import styles from './Avatar.module.css'

export type AvatarSize = 'sm' | 'md' | 'lg'

export interface AvatarProps {
  name: string
  src?: string | null
  size?: AvatarSize
}

export default function Avatar({ name, src, size = 'md' }: AvatarProps) {
  const initial = name.trim().charAt(0).toUpperCase() || '?'
  return (
    <span className={`${styles.avatar} ${styles[size]}`} role="img" aria-label={name}>
      {src ? <img className={styles.image} src={src} alt={name} /> : initial}
    </span>
  )
}