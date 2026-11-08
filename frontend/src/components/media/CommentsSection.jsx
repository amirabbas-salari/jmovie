import { useRef } from "react";
import { Link } from "react-router-dom";
import { FiThumbsUp, FiThumbsDown, FiArrowLeft } from "react-icons/fi";
import { FiChevronRight, FiChevronLeft } from "react-icons/fi";


function CommentCard({ comment }) {
  // user الان یک رشته‌ست (StringRelatedField در بک‌اند)
  const username =
    typeof comment.user === "string"
      ? comment.user
      : comment.user?.name || comment.user?.username || "کاربر";

  const avatar =
    typeof comment.user === "object" ? comment.user?.avatar : null;


  const initial = username?.trim()?.[0]?.toUpperCase() || "؟";
  const likes = comment.likes ?? 0;
  const dislikes = comment.dislikes ?? 0;

  return (
    <div className="flex w-[230px] flex-shrink-0 flex-col rounded-xl border border-white/5 bg-rose-950 p-4 shadow-lg">
      {/* هدر: آواتار + نام */}
      <div className="flex items-center gap-3">
        {avatar ? (
          <img
            src={avatar || "/avatar.webp"}
            alt={username}
            className="h-9 w-9 flex-shrink-0 rounded-full object-cover"
            onError={(e) => { e.target.src = "/avatar.webp" }}
          />
        ) : (
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-rose-500 to-[#751a6c] text-sm font-bold text-white">
            {initial}
          </span>
        )}
        <span className="truncate text-sm font-medium text-rose-200">
          {username}
        </span>
      </div>

      {/* متن کامنت */}
      <p className="mt-4 text-sm leading-6 text-rose-300">{comment.text}</p>

      {/* شمارنده‌ها */}
      <div className="mt-4 flex items-center justify-start gap-4 text-xs text-gray-300">
        <span className="flex items-center gap-1">
          <FiThumbsDown className="h-3.5 w-3.5" />
          {dislikes}
        </span>
        <span className="flex items-center gap-1">
          <FiThumbsUp className="h-3.5 w-3.5" />
          {likes > 0 ? `+${likes}` : likes}
        </span>
      </div>
    </div>
  );
}

export default function CommentsSection({ comments = [], mediaId }) {
  
  const scrollRef = useRef(null);

  const scroll = (dir) => {
    const el = scrollRef.current;
    if (!el) return;

    const amount = el.clientWidth * 0.8;

    el.scrollBy({
      left: dir === "next" ? -amount : amount,
      behavior: "smooth",
    });
  };


  return (
    <section dir="rtl" className="px-5 py-10 sm:px-14 lg:px-20">
      {/* سرتیتر */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="h-6 w-1 rounded-full bg-gradient-to-b from-rose-500 to-[#751a6c] shadow-[0_0_10px_[#751a6c]]" />
          <h2 className="text-xl font-bold tracking-tight sm:text-2xl">نظرات</h2>
        </div>

        <Link
          to={`/movies/${mediaId}/comments`}
          className="flex items-center gap-2 text-sm font-semibold text-rose-500 transition hover:text-[#751a6c]"
        >
          مشاهده‌ی بیشتر
          <FiArrowLeft className="h-4 w-4" />
        </Link>
      </div>

      {/* لیست کارت‌ها */}
      {comments.length > 0 ? (
        <div className="group/row relative">
          
          <div 
            // className="flex gap-4 overflow-x-auto pb-3 [scrollbar-width:thin]"
            className="flex gap-5 overflow-x-auto scroll-smooth pb-3 pr-16 pl-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
          >

            {/* دکمه قبلی */}
            <button
              type="button"
              onClick={() => scroll("prev")}
              aria-label="قبلی"
              className="absolute right-0 top-1/2 z-20 hidden h-full w-16 -translate-y-1/2 items-center justify-center bg-gradient-to-l from-black/80 to-transparent opacity-0 transition-opacity duration-300 group-hover/row:opacity-100 md:flex"
            >
              <span className="grid h-11 w-11 place-items-center rounded-full bg-white/10 backdrop-blur-md transition-all hover:scale-110 hover:bg-white/20">
                <FiChevronRight className="text-2xl text-white" />
              </span>
            </button>

            {/* دکمه بعدی */}
            <button
              type="button"
              onClick={() => scroll("next")}
              aria-label="بعدی"
              className="absolute left-0 top-1/2 z-20 hidden h-full w-16 -translate-y-1/2 items-center justify-center bg-gradient-to-r from-black/80 to-transparent opacity-0 transition-opacity duration-300 group-hover/row:opacity-100 md:flex"
            >
              <span className="grid h-11 w-11 place-items-center rounded-full bg-white/10 backdrop-blur-md transition-all hover:scale-110 hover:bg-white/20">
                <FiChevronLeft className="text-2xl text-white" />
              </span>
            </button>
            {comments.map((c) => (
              <CommentCard key={c.id} comment={c} />
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-500">هنوز نظری ثبت نشده است.</p>
      )}
    </section>
  );
}
