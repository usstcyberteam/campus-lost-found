import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { me } from '../api/auth'
import { changePassword, deleteAvatar, updateProfile, uploadAvatar } from '../api/me'
import { useAsync } from '../hooks/useAsync'
import { useAuthedImage } from '../hooks/useAuthedImage'
import { useAuth } from '../auth/AuthContext'
import { errorMessage } from '../utils/error'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import ErrorState from '../components/ui/ErrorState'
import Input from '../components/ui/Input'
import LoadingState from '../components/ui/LoadingState'
import Field from '../components/Field'
import PageContainer from '../components/PageContainer'
import PageHeader from '../components/AppShell/PageHeader'
import styles from './Profile.module.css'

const AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const AVATAR_MAX_BYTES = 5 * 1024 * 1024

export default function Profile() {
  const { refresh, avatarUrl, displayName: currentName } = useAuth()
  const avatarImage = useAuthedImage(avatarUrl)
  const fileRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState('')
  const [avatarBusy, setAvatarBusy] = useState<'upload' | 'remove' | null>(null)
  const [avatarMsg, setAvatarMsg] = useState('')
  const [avatarError, setAvatarError] = useState('')

  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview)
    },
    [preview],
  )

  async function pickAvatar(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    // 清空选择，允许重复选同一张图
    e.target.value = ''
    if (!file || avatarBusy) return
    setAvatarMsg('')
    if (!AVATAR_TYPES.includes(file.type)) {
      setAvatarError('仅支持 JPG、PNG、WebP 图片')
      return
    }
    if (file.size > AVATAR_MAX_BYTES) {
      setAvatarError('图片不能超过 5MB')
      return
    }
    setAvatarError('')
    setPreview(URL.createObjectURL(file))
    setAvatarBusy('upload')
    try {
      await uploadAvatar(file)
      await refresh()
      setAvatarMsg('证件照已更新')
    } catch (err) {
      setAvatarError(errorMessage(err, '上传失败，请重试'))
    } finally {
      setAvatarBusy(null)
      setPreview('')
    }
  }

  async function removeAvatar() {
    if (avatarBusy) return
    setAvatarBusy('remove')
    setAvatarError('')
    setAvatarMsg('')
    try {
      await deleteAvatar()
      await refresh()
      setAvatarMsg('已恢复默认头像')
    } catch (err) {
      setAvatarError(errorMessage(err, '移除失败，请重试'))
    } finally {
      setAvatarBusy(null)
    }
  }

  const { data, loading, error, reload } = useAsync(() => me(), [])
  const [displayName, setDisplayName] = useState('')
  const [contact, setContact] = useState('')
  const [filled, setFilled] = useState(false)

  useEffect(() => {
    if (data && !filled) {
      setDisplayName(data.display_name)
      setContact(data.contact ?? '')
      setFilled(true)
    }
  }, [data, filled])

  const [profileBusy, setProfileBusy] = useState(false)
  const [profileMsg, setProfileMsg] = useState('')
  const [profileError, setProfileError] = useState('')

  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwBusy, setPwBusy] = useState(false)
  const [pwMsg, setPwMsg] = useState('')
  const [pwError, setPwError] = useState('')

  async function saveProfile(e: FormEvent) {
    e.preventDefault()
    if (profileBusy) return
    if (!displayName.trim()) {
      setProfileError('昵称不能为空')
      return
    }
    setProfileBusy(true)
    setProfileError('')
    setProfileMsg('')
    try {
      await updateProfile({ display_name: displayName.trim(), contact: contact.trim() || null })
      await refresh()
      setProfileMsg('资料已保存')
    } catch (err) {
      setProfileError(errorMessage(err, '保存失败，请重试'))
    } finally {
      setProfileBusy(false)
    }
  }

  async function savePassword(e: FormEvent) {
    e.preventDefault()
    if (pwBusy) return
    setPwError('')
    setPwMsg('')
    if (newPassword !== confirmPassword) {
      setPwError('两次输入的新密码不一致')
      return
    }
    if (newPassword.length < 6) {
      setPwError('新密码至少 6 位')
      return
    }
    setPwBusy(true)
    try {
      await changePassword({ old_password: oldPassword, new_password: newPassword })
      setOldPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPwMsg('密码已修改')
    } catch (err) {
      setPwError(errorMessage(err, '修改失败，请重试'))
    } finally {
      setPwBusy(false)
    }
  }

  return (
    <PageContainer>
      <PageHeader title="资料修改" backTo="/me" />
      {loading && <LoadingState />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {data && (
        <>
          <Card className={styles.block}>
            <h2>证件照</h2>
            <div className={styles.avatarRow}>
              <div className={`${styles.photo} ${avatarBusy === 'upload' ? styles.developing : ''}`}>
                {preview || avatarImage ? (
                  <img className={styles.photoImg} src={preview || avatarImage} alt="当前头像" />
                ) : (
                  <span className={styles.photoInitial} aria-hidden="true">
                    {(currentName ?? data.display_name).trim().charAt(0) || '寻'}
                  </span>
                )}
                {avatarBusy === 'upload' && (
                  <span className={styles.developLabel} role="status">
                    冲洗中…
                  </span>
                )}
              </div>
              <div className={styles.avatarSide}>
                <p className={styles.hint}>
                  支持 JPG、PNG、WebP，5MB 以内。会自动裁成正方形，并去掉照片里的拍摄位置等信息。
                </p>
                <div className={styles.avatarActions}>
                  <Button
                    loading={avatarBusy === 'upload'}
                    disabled={avatarBusy !== null}
                    onClick={() => fileRef.current?.click()}
                  >
                    {avatarUrl ? '更换头像' : '上传头像'}
                  </Button>
                  {avatarUrl && (
                    <Button
                      variant="secondary"
                      loading={avatarBusy === 'remove'}
                      disabled={avatarBusy !== null}
                      onClick={removeAvatar}
                    >
                      移除
                    </Button>
                  )}
                </div>
                <input
                  ref={fileRef}
                  className={styles.fileInput}
                  type="file"
                  accept={AVATAR_TYPES.join(',')}
                  aria-label="选择头像图片"
                  onChange={pickAvatar}
                />
                {avatarError && (
                  <p className={styles.error} role="alert">
                    {avatarError}
                  </p>
                )}
                {avatarMsg && (
                  <p className={styles.status} role="status">
                    {avatarMsg}
                  </p>
                )}
              </div>
            </div>
          </Card>

          <Card className={styles.block}>
            <h2>基本资料</h2>
            <p className={styles.hint}>用户名（不可修改）：{data.username}</p>
            <form className={styles.form} onSubmit={saveProfile}>
              <Field label="昵称" htmlFor="profile-display-name" required>
                <Input
                  id="profile-display-name"
                  aria-label="昵称"
                  value={displayName}
                  disabled={profileBusy}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </Field>
              <Field label="联系方式" htmlFor="profile-contact">
                <Input
                  id="profile-contact"
                  aria-label="联系方式"
                  placeholder="手机号 / 邮箱（选填，仅工作人员在必要时可见）"
                  value={contact}
                  disabled={profileBusy}
                  onChange={(e) => setContact(e.target.value)}
                />
              </Field>
              {profileError && (
                <p className={styles.error} role="alert">
                  {profileError}
                </p>
              )}
              {profileMsg && (
                <p className={styles.status} role="status">
                  {profileMsg}
                </p>
              )}
              <div>
                <Button type="submit" loading={profileBusy}>
                  保存资料
                </Button>
              </div>
            </form>
          </Card>

          <Card className={styles.block}>
            <h2>修改密码</h2>
            <form className={styles.form} onSubmit={savePassword}>
              <Field label="原密码" htmlFor="profile-old-password" required>
                <Input
                  id="profile-old-password"
                  aria-label="原密码"
                  type="password"
                  value={oldPassword}
                  disabled={pwBusy}
                  onChange={(e) => setOldPassword(e.target.value)}
                />
              </Field>
              <Field label="新密码" htmlFor="profile-new-password" required>
                <Input
                  id="profile-new-password"
                  aria-label="新密码"
                  type="password"
                  placeholder="至少 6 位"
                  value={newPassword}
                  disabled={pwBusy}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </Field>
              <Field label="确认新密码" htmlFor="profile-confirm-password" required>
                <Input
                  id="profile-confirm-password"
                  aria-label="确认新密码"
                  type="password"
                  value={confirmPassword}
                  disabled={pwBusy}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </Field>
              {pwError && (
                <p className={styles.error} role="alert">
                  {pwError}
                </p>
              )}
              {pwMsg && (
                <p className={styles.status} role="status">
                  {pwMsg}
                </p>
              )}
              <div>
                <Button type="submit" loading={pwBusy}>
                  修改密码
                </Button>
              </div>
            </form>
          </Card>
        </>
      )}
    </PageContainer>
  )
}
