import { useCallback, useEffect, useState, Fragment } from 'react'
import { deleteComment, listComments } from '../../api/comments'
import { useAuth } from '../../auth/AuthContext'
import { errorMessage } from '../../utils/error'
import type { Comment } from '../../types'
import Button from '../ui/Button'
import EmptyState from '../ui/EmptyState'
import LoadingState from '../ui/LoadingState'
import CommentComposer from './CommentComposer'
import CommentItem from './CommentItem'
import styles from './CommentList.module.css'

const PAGE_SIZE = 20

interface CommentListProps {
  itemId: string
}

export default function CommentList({ itemId }: CommentListProps) {
  const { userId, role } = useAuth()
  const [comments, setComments] = useState<Comment[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [replyTo, setReplyTo] = useState<Comment | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const canModerate = role === 'staff' || role === 'admin'

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const page = await listComments(itemId, { limit: PAGE_SIZE, offset: 0 })
      setComments(page.items)
      setTotal(page.total)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [itemId])

  useEffect(() => {
    setComments([])
    setTotal(0)
    setReplyTo(null)
    setNotice('')
    void load()
  }, [load])

  async function loadMore() {
    if (loadingMore) return
    setLoadingMore(true)
    setError('')
    try {
      const page = await listComments(itemId, { limit: PAGE_SIZE, offset: comments.length })
      setComments((prev) => {
        const seen = new Set(prev.map((comment) => comment.id))
        return [...prev, ...page.items.filter((comment) => !seen.has(comment.id))]
      })
      setTotal(page.total)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setLoadingMore(false)
    }
  }

  function handleCreated(comment: Comment, parentId: string | null) {
    if (parentId) {
      setComments((prev) =>
        prev.map((parent) =>
          parent.id === parentId ? { ...parent, replies: [...parent.replies, comment] } : parent,
        ),
      )
      setNotice('回复已发布')
    } else {
      setComments((prev) => [...prev, comment])
      setTotal((prev) => prev + 1)
      setNotice('评论已发布')
    }
    setReplyTo(null)
  }

  function markDeleted(commentId: string) {
    setComments((prev) =>
      prev.map((parent) => {
        if (parent.id === commentId) {
          return { ...parent, content: '', images: [], is_deleted: true }
        }
        return {
          ...parent,
          replies: parent.replies.map((reply) =>
            reply.id === commentId ? { ...reply, content: '', images: [], is_deleted: true } : reply,
          ),
        }
      }),
    )
    if (replyTo?.id === commentId) setReplyTo(null)
  }

  async function handleDelete(comment: Comment) {
    if (deletingId) return
    setDeletingId(comment.id)
    setError('')
    setNotice('')
    try {
      await deleteComment(comment.id)
      markDeleted(comment.id)
      setNotice('评论已删除')
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <section className={styles.section} aria-labelledby="comments-heading">
      <div className={styles.header}>
        <h2 id="comments-heading">评论</h2>
        <span className={styles.count}>共 {total} 条</span>
      </div>
      {replyTo ? (
        <CommentComposer
          itemId={itemId}
          parentId={replyTo.id}
          replyTo={replyTo.author.display_name}
          onCreated={(comment) => handleCreated(comment, replyTo.id)}
          onCancel={() => setReplyTo(null)}
        />
      ) : (
        <CommentComposer itemId={itemId} onCreated={(comment) => handleCreated(comment, null)} />
      )}
      {notice && (
        <p className={styles.notice} role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <LoadingState text="正在加载评论…" />
      ) : comments.length === 0 ? (
        <EmptyState text="还没有评论，来说两句吧" />
      ) : (
        <>
          <ul className={styles.list}>
            {comments.map((comment) => (
              <Fragment key={comment.id}>
                <CommentItem
                  comment={comment}
                  currentUserId={userId}
                  canModerate={canModerate}
                  onReply={setReplyTo}
                  onDelete={handleDelete}
                />
                {comment.replies.map((reply) => (
                  <CommentItem
                    key={reply.id}
                    comment={reply}
                    currentUserId={userId}
                    canModerate={canModerate}
                    isReply
                    onReply={setReplyTo}
                    onDelete={handleDelete}
                  />
                ))}
              </Fragment>
            ))}
          </ul>
          {comments.length < total && (
            <div className={styles.more}>
              <Button variant="secondary" loading={loadingMore} disabled={loadingMore} onClick={loadMore}>
                {loadingMore ? '加载中…' : '加载更多评论'}
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  )
}