import { Navigate, Route, Routes, useParams } from 'react-router-dom'
import AppShell from './components/AppShell/AppShell'
import RequireAuth from './components/RequireAuth'
import AiPage from './pages/AiPage'
import Hall from './pages/Hall'
import ItemDetail from './pages/ItemDetail'
import ItemForm from './pages/ItemForm'
import Login from './pages/Login'
import MapView from './pages/MapView'
import Me from './pages/Me'
import Register from './pages/Register'
import StaffApplications from './pages/StaffApplications'
import StaffClaims from './pages/StaffClaims'
import Tickets from './pages/Tickets'

function LegacyItemRedirect() {
  const { id } = useParams()
  return <Navigate to={`/hall/${id ?? ''}`} replace />
}

export default function App() {
  return (
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
        <Route path="/map" element={<MapView />} />
        <Route path="/ai" element={<AiPage />} />
        <Route path="/me" element={<Me />} />
        <Route path="/staff/claims" element={<StaffClaims />} />
        <Route path="/staff/tickets" element={<Tickets />} />
        <Route path="/admin/staff-applications" element={<StaffApplications />} />
      </Route>
      <Route path="/" element={<Navigate to="/hall" replace />} />
      <Route path="/items/:id" element={<LegacyItemRedirect />} />
      <Route path="/tickets" element={<Navigate to="/staff/tickets" replace />} />
      <Route path="*" element={<Navigate to="/hall" replace />} />
    </Routes>
  )
}
