import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import RequireAuth from './components/RequireAuth'
import Home from './pages/Home'
import ItemDetail from './pages/ItemDetail'
import ItemForm from './pages/ItemForm'
import Login from './pages/Login'
import MapView from './pages/MapView'
import MyDelegations from './pages/MyDelegations'
import Register from './pages/Register'
import Tickets from './pages/Tickets'
import StaffClaims from './pages/StaffClaims'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route path="/" element={<Home />} />
        <Route path="/publish" element={<ItemForm />} />
        <Route path="/items/:id" element={<ItemDetail />} />
        <Route path="/me" element={<MyDelegations />} />
        <Route path="/tickets" element={<Tickets />} />
        <Route path="/map" element={<MapView />} />
        <Route path="/staff/claims" element={<StaffClaims />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
