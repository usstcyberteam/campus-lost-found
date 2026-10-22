import { Navigate, Route, Routes, useParams } from 'react-router-dom'
import AppShell from './components/AppShell/AppShell'
import AiFloatWidget from './components/AiFloat/AiFloatWidget'
import RequireAuth from './components/RequireAuth'
import AdminAnnouncements from './pages/AdminAnnouncements'
import AdminStats from './pages/AdminStats'
import AdminUsers from './pages/AdminUsers'
import AiPage from './pages/AiPage'
import AnnouncementDetail from './pages/AnnouncementDetail'
import Announcements from './pages/Announcements'
import Hall from './pages/Hall'
import ItemDetail from './pages/ItemDetail'
import ItemForm from './pages/ItemForm'
import Login from './pages/Login'
import MapView from './pages/MapView'
import Me from './pages/Me'
import MeList from './pages/MeList'
import MePoints from './pages/MePoints'
import Praises from './pages/Praises'
import Profile from './pages/Profile'
import Register from './pages/Register'
import StaffApplications from './pages/StaffApplications'
import StaffClaims from './pages/StaffClaims'
import StaffComments from './pages/StaffComments'
import Tickets from './pages/Tickets'

function LegacyItemRedirect() {
  const { id } = useParams()
  return <Navigate to={`/hall/${id ?? ''}`} replace />
}

export default function App() {
  return (
    <>
      <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route path="/hall" element={<Hall />} />
        <Route path="/hall/:id" element={<ItemDetail />} />
        <Route path="/publish" element={<ItemForm />} />
        <Route path="/items/:id/edit" element={<ItemForm />} />
        <Route path="/map" element={<MapView />} />
        <Route path="/ai" element={<AiPage />} />
        <Route path="/me" element={<Me />} />
        <Route path="/me/points" element={<MePoints />} />
        <Route path="/me/profile" element={<Profile />} />
        <Route path="/me/:kind" element={<MeList />} />
        <Route path="/announcements" element={<Announcements />} />
        <Route path="/announcements/:id" element={<AnnouncementDetail />} />
        <Route path="/praises" element={<Praises />} />
        <Route path="/staff/claims" element={<StaffClaims />} />
        <Route path="/staff/comments" element={<StaffComments />} />
        <Route path="/staff/tickets" element={<Tickets />} />
        <Route path="/admin/staff-applications" element={<StaffApplications />} />
        <Route path="/admin/users" element={<AdminUsers />} />
        <Route path="/admin/stats" element={<AdminStats />} />
        <Route path="/admin/announcements" element={<AdminAnnouncements />} />
      </Route>
      <Route path="/" element={<Navigate to="/hall" replace />} />
      <Route path="/items/:id" element={<LegacyItemRedirect />} />
      <Route path="/tickets" element={<Navigate to="/staff/tickets" replace />} />
      <Route path="*" element={<Navigate to="/hall" replace />} />
      </Routes>
      <AiFloatWidget />
    </>
  )
}