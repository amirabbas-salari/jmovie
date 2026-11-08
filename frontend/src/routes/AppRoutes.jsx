import { Suspense, lazy } from 'react'
import { Routes, Route } from 'react-router-dom'
import Home from '../pages/Home'

import ScrollToTop from '../components/ui/ScrollToTop'
import ProtectedRoute from './ProtectedRoute'
import MainLayout from '../layout/MainLayout'

// بقیه‌ی صفحات lazy لود می‌شوند تا باندل اولیه (صفحه خانه) سبک بماند و
// کاربر کد صفحه‌هایی را که باز نکرده دانلود نکند.
const Register = lazy(() => import('../pages/auth/Register'))
const Login = lazy(() => import('../pages/auth/Login'))
const EditProfilePage = lazy(() => import('../pages/auth/EditProfilePage'))
const NotFound = lazy(() => import('../pages/NotFound'))
const MovieDetails = lazy(() => import('../pages/movies/MovieDetails'))
const MoviesPage = lazy(() => import('../pages/movies/MoviesPage'))
const SeriesDetails = lazy(() => import('../pages/series/SeriesDetails'))
const SeriesPage = lazy(() => import('../pages/series/SeriesPage'))
const CollectionsPage = lazy(() => import('../pages/collections/CollectionsPage'))
const CollectionDetail = lazy(() => import('../pages/collections/CollectionDetail'))
const GenreDetailsPage = lazy(() => import('../pages/GenreDetailsPage'))
const SupportPage = lazy(() => import('../pages/SupportPage'))
const PrizePage = lazy(() => import('../pages/PrizePage'))
const ActorDetailPage = lazy(() => import('../pages/ActorDetailPage'))

const PageFallback = () => (
  <div className="flex min-h-[50vh] items-center justify-center gap-3 text-sm text-zinc-400">
    <span className="h-5 w-5 animate-spin rounded-full border-2 border-rose-500 border-t-transparent" />
    در حال بارگذاری...
  </div>
)

// admin — صفحات پنل هم lazy هستند (همان lazy بالای فایل)
import AdminRoute from "../admin/routes/AdminRoute"
import AdminLayout from "../admin/layout/AdminLayout"
import NotAuthorized from "../admin/pages/NotAuthorized"

const Dashboard = lazy(() => import("../admin/pages/Dashboard"))
const Movies = lazy(() => import("../admin/pages/Movies"))
const MovieForm = lazy(() => import("../admin/pages/MovieForm"))
const Series = lazy(() => import("../admin/pages/Series"))
const SeriesForm = lazy(() => import("../admin/pages/SeriesForm"))
const People = lazy(() => import("../admin/pages/People"))
const PersonForm = lazy(() => import("../admin/pages/PersonForm"))
const Genres = lazy(() => import("../admin/pages/Genres"))
const GenreForm = lazy(() => import("../admin/pages/GenreForm"))
const Collections = lazy(() => import("../admin/pages/Collections"))
const CollectionForm = lazy(() => import("../admin/pages/CollectionForm"))
const Downloads = lazy(() => import("../admin/pages/Downloads"))
const Comments = lazy(() => import("../admin/pages/Comments"))
const Users = lazy(() => import("../admin/pages/Users"))
const UserForm = lazy(() => import("../admin/pages/UserForm"))
const Roles = lazy(() => import("../admin/pages/Roles"))
const AuditLogs = lazy(() => import("../admin/pages/AuditLogs"))

function AppRoutes() {
  return (
    <>
    <ScrollToTop />
    <Suspense fallback={<PageFallback />}>
    <Routes>
      <Route element={<MainLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/home" element={<Home />} />
        <Route path="/movie/:slug" element={<MovieDetails />} />
        <Route path="/series/:slug" element={<SeriesDetails />} />
        <Route path="/movies" element={<MoviesPage />} />
        <Route path="/series" element={<SeriesPage />} />
        <Route path="/support" element={<SupportPage />} />
        <Route path="/faq" element={<SupportPage />} />
        <Route path="/profile" element={<ProtectedRoute><EditProfilePage /></ProtectedRoute>} />
        <Route path="/person/:slug" element={<ActorDetailPage />} />
        <Route path="/genre/:slug" element={<GenreDetailsPage />} />
        <Route path="/pricing" element={<PrizePage />} />
        <Route path="/collection" element={<CollectionsPage />} />
        <Route path="/collection/:slug" element={<CollectionDetail />} />


        


        
      </Route>
      <Route path="/register" element={<Register />} />
      <Route path="/login" element={<Login />} />
      <Route path="*" element={<NotFound />} />

      

      <Route path="/not-authorized" element={<NotAuthorized />} />

      {/* Admin Routes */}
      <Route element={<AdminRoute />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Dashboard />} />

          {/* movie */}
          <Route path="movies" element={<Movies />} />
          <Route path="movies/new" element={<MovieForm />} />
          <Route path="movies/:id/edit" element={<MovieForm />} />

          {/* series */}
          <Route path="series" element={<Series />} />
          <Route path="series/new" element={<SeriesForm />} />
          <Route path="series/:id/edit" element={<SeriesForm />} />

          {/* genres */}
          <Route path="genres" element={<Genres />} />
          <Route path="genres/new" element={<GenreForm />} />
          <Route path="genres/:id/edit" element={<GenreForm />} />

          {/* people */}
          <Route path="people" element={<People />} />
          <Route path="people/new" element={<PersonForm />} />
          <Route path="people/:id/edit" element={<PersonForm />} />

          {/* collections */}
          <Route path="collections" element={<Collections />} />
          <Route path="collections/new" element={<CollectionForm />} />
          <Route path="collections/:id/edit" element={<CollectionForm />} />

          {/* downloads & comments */}
          <Route path="downloads" element={<Downloads />} />
          <Route path="comments" element={<Comments />} />

          {/* users */}
          <Route path="users" element={<Users />} />
          <Route path="users/new" element={<UserForm />} />
          <Route path="users/:id/edit" element={<UserForm />} />

          {/* roles & audit (فقط سوپرادمین) */}
          <Route path="roles" element={<Roles />} />
          <Route path="audit-logs" element={<AuditLogs />} />
        </Route>
      </Route>
    </Routes>
    </Suspense>
    </>
  )
}

export default AppRoutes
