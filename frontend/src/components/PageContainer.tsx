import type { ReactNode } from 'react'
import styles from './PageContainer.module.css'

interface PageContainerProps {
  children: ReactNode
}

export default function PageContainer({ children }: PageContainerProps) {
  return <main className={styles.page}>{children}</main>
}