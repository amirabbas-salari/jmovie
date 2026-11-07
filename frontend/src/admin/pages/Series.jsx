import MediaListPage from "../components/MediaListPage"
import { seriesApi } from "../services/adminApi"
import { P } from "../permissions"

export default function Series() {
  return (
    <MediaListPage
      title="سریال‌ها"
      subtitle="مدیریت سریال‌ها، فصل‌ها، قسمت‌ها، عوامل و لینک‌های دانلود"
      basePath="/admin/series"
      api={seriesApi}
      kindLabel="سریال"
      perms={{ add: P.seriesAdd, change: P.seriesChange, delete: P.seriesDelete }}
    />
  )
}
