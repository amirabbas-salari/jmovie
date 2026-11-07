import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
    Calendar,
    MapPin,
    Star,
    Film,
    Tv,
    User,
} from "lucide-react";

import api from "../services/api";
import MediaCard from "../components/media/MediaCard";
import SideImage from "../components/ui/SideImages";
import minions from '../assets/success_signup/minions.webp'

export default function ActorDetailPage() {
    const { slug } = useParams();

    const [actor, setActor] = useState(null);

    const [loading, setLoading] = useState(true);

    const [error, setError] = useState("");

    const [expanded, setExpanded] = useState(false);

    useEffect(() => {
        const fetchActor = async () => {
            try {
                setLoading(true);

                const { data } = await api.get(`/people/${slug}/`);

                setActor(data);
            } catch (err) {
                setError("خطا در دریافت اطلاعات بازیگر");
            } finally {
                setLoading(false);
            }
        };

        fetchActor();
    }, [slug]);

    if (loading) {
        return (
            <div
                dir="rtl"
                className="min-h-screen bg-gradient-to-b from-black to-[#1A0B0C]"
            >

                <div className="mx-auto max-w-7xl px-5 py-28">

                    <div className="animate-pulse">

                        <div className="flex flex-col gap-10 lg:flex-row">

                            <div className="h-[420px] w-full rounded-3xl bg-white/10 lg:w-80" />

                            <div className="flex-1 space-y-5">

                                <div className="h-12 w-72 rounded-xl bg-white/10" />

                                <div className="h-8 w-56 rounded-xl bg-white/10" />

                                <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">

                                    {Array.from({ length: 4 }).map((_, i) => (
                                        <div
                                            key={i}
                                            className="h-24 rounded-2xl bg-white/10"
                                        />
                                    ))}

                                </div>

                                <div className="h-48 rounded-3xl bg-white/10" />

                            </div>

                        </div>

                    </div>

                </div>

            </div>
        );
    }

    if (error || !actor) {
        return (
            <div
                dir="rtl"
                className="flex min-h-screen items-center justify-center bg-black text-red-400"
            >
                {error}
            </div>
        );
    }

    const biography =
        actor.biography ||
        actor.bio ||
        "بیوگرافی برای این بازیگر ثبت نشده است.";

    const movies = actor.movies || [];

    const series = actor.series || [];

    return (
        <div
            dir="rtl"
            className="min-h-screen overflow-hidden bg-gradient-to-b from-black via-[#140709] to-[#1A0B0C] pt-10 px-4"
        >
            <SideImage showMinions={false} />

            <div className="pointer-events-none fixed -right-40 -top-40 h-96 w-96 rounded-full bg-fuchsia-600/20 blur-3xl" />

            <div className="pointer-events-none fixed -left-40 top-32 h-96 w-96 rounded-full bg-red-600/10 blur-3xl" />

            <div className="relative mx-auto max-w-7xl px-5 py-24">
                {/* ================= HERO ================= */}

                <div className="grid gap-10 lg:grid-cols-[320px_1fr]">

                    {/* تصویر بازیگر */}

                    <div className="mx-auto w-full max-w-[320px]">

                        <div
                            className="
        overflow-hidden
        rounded-[32px]
        border
        border-white/10
        bg-white/5
        shadow-[0_20px_80px_rgba(0,0,0,.45)]
        backdrop-blur-xl
      "
                        >
                            <img
                                src={actor.profile_image || actor.profile_image_url}
                                alt={actor.name}
                                className="aspect-[2/3] w-full object-cover"
                            />
                        </div>

                    </div>

                    {/* اطلاعات */}

                    <div className="space-y-8">

                        <div className="relative">

                            <img
                                src={minions}
                                alt=""
                                aria-hidden="true"
                                className="pointer-events-none absolute -mr-10 top-[0px] -translate-x-1/2 h-[115px] w-auto select-none object-contain"
                            />
                            <h1 className="mr-[100px] text-4xl font-black text-white lg:text-6xl">
                                {actor.name}
                            </h1>

                            {actor.original_name && (
                                <p className="mr-[100px] mt-3 text-xl text-zinc-400">
                                    {actor.original_name}
                                </p>
                            )}

                        </div>

                        {/* آمار */}

                        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">

                            <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">

                                <Calendar className="mb-3 text-red-400" size={22} />

                                <div className="text-xs text-zinc-500">
                                    تولد
                                </div>

                                <div className="mt-2 font-bold text-white">
                                    {actor.birth_date || "-"}
                                </div>

                            </div>

                            <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">

                                <MapPin className="mb-3 text-red-400" size={22} />

                                <div className="text-xs text-zinc-500">
                                    محل تولد
                                </div>

                                <div className="mt-2 font-bold text-white">
                                    {actor.place_of_birth || "-"}
                                </div>

                            </div>

                            <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">

                                <Film className="mb-3 text-red-400" size={22} />

                                <div className="text-xs text-zinc-500">
                                    فیلم
                                </div>

                                <div className="mt-2 text-2xl font-black text-white">
                                    {movies.length}
                                </div>

                            </div>

                            <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">

                                <Tv className="mb-3 text-red-400" size={22} />

                                <div className="text-xs text-zinc-500">
                                    سریال
                                </div>

                                <div className="mt-2 text-2xl font-black text-white">
                                    {series.length}
                                </div>

                            </div>

                        </div>

                        {/* بیوگرافی */}

                        <div
                            className="
        rounded-[30px]
        border
        border-white/10
        bg-white/[0.04]
        p-7
        backdrop-blur-xl
      "
                        >

                            <div className="mb-5 flex items-center gap-3">

                                <User className="text-red-400" />

                                <h2 className="text-2xl font-bold text-white">
                                    بیوگرافی
                                </h2>

                            </div>

                            <p
                                className={`leading-9 text-zinc-300 transition-all ${expanded ? "" : "line-clamp-6"
                                    }`}
                            >
                                {biography}
                            </p>

                            {biography.length > 500 && (
                                <button
                                    onClick={() => setExpanded((v) => !v)}
                                    className="mt-5 text-red-400 transition hover:text-red-300"
                                >
                                    {expanded ? "بستن" : "نمایش بیشتر"}
                                </button>
                            )}

                        </div>

                    </div>

                </div>

                {/* ================= فیلم‌ها ================= */}

                {movies.length > 0 && (
                    <section className="mt-20">

                        <div className="mb-8 flex items-center justify-between">

                            <div className="flex items-center gap-3">

                                <Film size={30} className="text-red-400" />

                                <h2 className="text-3xl font-black text-white">
                                    فیلم‌ها
                                </h2>

                            </div>

                            <span
                                className="
          rounded-full
          border
          border-white/10
          bg-white/5
          px-4
          py-2
          text-sm
          text-zinc-300
          backdrop-blur-xl
        "
                            >
                                {movies.length} فیلم
                            </span>

                        </div>

                        <div
                            className="
        grid
        grid-cols-2
        gap-4

        sm:grid-cols-3

        lg:grid-cols-5
      "
                        >
                            {movies.map((movie) => (
                                <MediaCard
                                    key={movie.slug}
                                    media={movie}
                                    type="movie"
                                />
                            ))}
                        </div>

                    </section>
                )}

                {/* ================= سریال‌ها ================= */}

                {series.length > 0 && (
                    <section className="mt-24">

                        <div className="mb-8 flex items-center justify-between">

                            <div className="flex items-center gap-3">

                                <Tv size={30} className="text-red-400" />

                                <h2 className="text-3xl font-black text-white">
                                    سریال‌ها
                                </h2>

                            </div>

                            <span
                                className="
          rounded-full
          border
          border-white/10
          bg-white/5
          px-4
          py-2
          text-sm
          text-zinc-300
          backdrop-blur-xl
        "
                            >
                                {series.length} سریال
                            </span>

                        </div>

                        <div
                            className="
        grid
        grid-cols-2
        gap-4

        sm:grid-cols-3

        lg:grid-cols-5
      "
                        >
                            {series.map((item) => (
                                <MediaCard
                                    key={item.slug}
                                    media={item}
                                    type="series"
                                />
                            ))}
                        </div>

                    </section>
                )}
            </div>
        </div>
    );
}