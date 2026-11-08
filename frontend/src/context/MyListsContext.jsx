import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import api from "../services/api"
import { useAuth } from "./AuthContext"

// لیست‌های کاربر: favorite (علاقه‌مندی‌ها)، watchlist (لیست تماشا)،
// watched (دیده‌شده‌ها). وضعیت همه‌ی کارت‌ها از همین‌جا خوانده می‌شود تا
// با یک درخواست سبک (/accounts/my-lists/ids/) همه‌ی دکمه‌ها همگام باشند
// و با toggle، همه‌ی کارت‌های همان مدیا در صفحه هم‌زمان آپدیت شوند.
const EMPTY = {
  favorite: { movie: [], series: [] },
  watchlist: { movie: [], series: [] },
  watched: { movie: [], series: [] },
}

const MyListsContext = createContext(null)

export function MyListsProvider({ children }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [lists, setLists] = useState(EMPTY)
  const [loaded, setLoaded] = useState(false)
  const pending = useRef(new Set())

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get("/accounts/my-lists/ids/", { skipCache: true })
      setLists({
        favorite: data.favorite ?? EMPTY.favorite,
        watchlist: data.watchlist ?? EMPTY.watchlist,
        watched: data.watched ?? EMPTY.watched,
      })
    } catch {
      // کاربر لاگین نیست یا خطای شبکه؛ دکمه‌ها در وضعیت خالی می‌مانند
    } finally {
      setLoaded(true)
    }
  }, [])

  useEffect(() => {
    if (user) {
      refresh()
    } else {
      setLists(EMPTY)
      setLoaded(false)
    }
  }, [user, refresh])

  const isIn = useCallback(
    (list, mediaType, mediaId) =>
      Boolean(lists[list]?.[mediaType]?.includes(Number(mediaId))),
    [lists]
  )

  const toggle = useCallback(
    async (list, mediaType, mediaId) => {
      if (!user) {
        navigate("/login")
        return false
      }
      if (mediaType !== "movie" && mediaType !== "series") return false

      const id = Number(mediaId)
      const key = `${list}:${mediaType}:${id}`
      if (pending.current.has(key)) return isIn(list, mediaType, id)
      pending.current.add(key)

      const wasIn = isIn(list, mediaType, id)
      // آپدیت خوش‌بینانه: دکمه همان لحظه تغییر می‌کند
      setLists((prev) => {
        const current = prev[list][mediaType]
        return {
          ...prev,
          [list]: {
            ...prev[list],
            [mediaType]: wasIn
              ? current.filter((x) => x !== id)
              : [...current, id],
          },
        }
      })

      try {
        const { data } = await api.post("/accounts/my-lists/toggle/", {
          media_type: mediaType,
          media_id: id,
          list,
        })
        return Boolean(data.active)
      } catch (err) {
        // برگشت به وضعیت قبلی در صورت خطا
        setLists((prev) => {
          const current = prev[list][mediaType]
          return {
            ...prev,
            [list]: {
              ...prev[list],
              [mediaType]: wasIn
                ? [...current, id]
                : current.filter((x) => x !== id),
            },
          }
        })
        if (err.response?.status === 401) navigate("/login")
        return wasIn
      } finally {
        pending.current.delete(key)
      }
    },
    [user, navigate, isIn]
  )

  return (
    <MyListsContext.Provider value={{ lists, loaded, isIn, toggle, refresh }}>
      {children}
    </MyListsContext.Provider>
  )
}

export function useMyLists() {
  const ctx = useContext(MyListsContext)
  if (!ctx) throw new Error("useMyLists must be used within MyListsProvider")
  return ctx
}
