import type { Comment } from '../../types'
import Avatar from '../ui/Avatar'
import Tag from '../ui/Tag'
import PhotoGallery from '../PhotoGallery/PhotoGallery'
import styles from './CommentList.module.css'

interface CommentItemProps {
  comment: Comment
  currentUserId: string | null
  canModerate: boolean
  isReply?: boolean
  onReply: (comment: Comment) => void
  onDelete: (comment: Comment) => void
}

export default function CommentItem({
  comment,
  currentUserId,
  canModerate,
  isReply = false,
  onReply,
  onDelete,
}: CommentItemProps) {
  const canDelete = !comment.is_deleted && (canModerate || comment.author.id === currentUserId)
  return (
    <li className={`${styles.item} ${isReply ? styles.replyItem : ''}`}>
      <Avatar name={comment.author.display_name} size="sm" />
      <div className={styles.main}>
        <div className={styles.head}>
          <span className={styles.name}>{comment.author.display_name}</span>
          <Tag>{comment.author.role_label}</Tag>
          <Tag tone="primary">{comment.author.title}</Tag>
          <time className={styles.time} dateTime={comment.created_at}>
            {new Date(comment.created_at).toLocaleString('zh-CN')}
          </time>
        </div>
        {comment.is_deleted ? (
          <p className={styles.deleted}>该评论已删除</p>
        ) : (
          <p className={styles.content}>{comment.content}</p>
        )}
        {!comment.is_deleted && comment.images.length > 0 && <PhotoGallery photos={comment.images} />}
        <div className={styles.itemActions}>
          {!comment.is_deleted && !isReply && (
            <button type="button" className={styles.action} onClick={() => onReply(comment)}>
              回复
            </button>
          )}
          {canDelete && (
            <button type="button" className={styles.action} onClick={() => onDelete(comment)}>
              删除
            </button>
          )}
        </div>
      </div>
    </li>
  )
}