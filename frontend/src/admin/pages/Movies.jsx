import MediaListPage from "../components/MediaListPage"
import { moviesApi } from "../services/adminApi"
import { P } from "../permissions"

export default function Movies() {
  return (
    <MediaListPage
      title="فیلم‌ها"
      subtitle="مدیریت کامل فیلم‌ها: اطلاعات، عوامل، گالری و لینک‌های دانلود"
      basePath="/admin/movies"
      api={moviesApi}
      kindLabel="فیلم"
      perms={{ add: P.movieAdd, change: P.movieChange, delete: P.movieDelete }}
    />
  )
}
