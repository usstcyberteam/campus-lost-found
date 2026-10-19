import { Link } from 'react-router-dom'
import { listMyBadges, listMyClaims, listMyItems, listMyTickets } from '../api/me'
import { useAsync } from '../hooks/useAsync'
import { claimStatusLabels, directionLabels, statusLabels, ticketStatusLabels } from '../types'
import Empty from '../components/Empty'
import ErrorNotice from '../components/ErrorNotice'
import PageContainer from '../components/PageContainer'
import Spinner from '../components/Spinner'

export default function MyDelegations() {
  const { data, error, loading } = useAsync(
    () =>
      Promise.all([listMyItems(), listMyClaims(), listMyTickets(), listMyBadges()]).then(
        ([items, claims, tickets, badges]) => ({ items, claims, tickets, badges }),
      ),
    [],
  )

  if (loading) {
    return (
      <PageContainer>
        <Spinner />
      </PageContainer>
    )
  }
  if (error) {
    return (
      <PageContainer>
        <ErrorNotice message={error} />
      </PageContainer>
    )
  }
  const items = data?.items.items ?? []
  const claims = data?.claims.items ?? []
  const tickets = data?.tickets.items ?? []
  const badges = data?.badges ?? []
  return (
    <PageContainer>
      <h1>我的委托</h1>
      {badges.length > 0 && <p>徽章：{badges.map((b) => b.kind).join('、')}</p>}

      <h2>我的发布</h2>
      {items.length === 0 && <Empty text="暂无" />}
      <ul>
        {items.map((i) => (
          <li key={i.id}>
            <Link to={`/hall/${i.id}`}>
              [{directionLabels[i.direction]}] {i.title}
            </Link>{' '}
            · {statusLabels[i.status]}
          </li>
        ))}
      </ul>

      <h2>我的认领</h2>
      {claims.length === 0 && <Empty text="暂无" />}
      <ul>
        {claims.map((c) => (
          <li key={c.id}>
            <Link to={'/hall/' + c.found_item_id}>认领物品</Link> · {claimStatusLabels[c.status]}
          </li>
        ))}
      </ul>

      <h2>我的工单</h2>
      {tickets.length === 0 && <Empty text="暂无" />}
      <ul>
        {tickets.map((t) => (
          <li key={t.id}>{ticketStatusLabels[t.status]}</li>
        ))}
      </ul>
    </PageContainer>
  )
}
