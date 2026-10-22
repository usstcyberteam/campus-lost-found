import { useEffect, useState, type FormEvent } from 'react'
import { me } from '../api/auth'
import { changePassword, updateProfile } from '../api/me'
import { useAsync } from '../hooks/useAsync'
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

export default function Profile() {
  const { refresh } = useAuth()
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