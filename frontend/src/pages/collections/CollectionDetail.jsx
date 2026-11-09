import { useParams } from "react-router-dom";
import {
  Film,
  FolderOpen,
} from "lucide-react";

import SideImage from "../../components/ui/SideImages";
import MediaCard from "../../components/media/MediaCard";
import CollectionHero from "../../components/collections/CollectionHero";

import useCollectionDetail from "../../hooks/useCollectionDetail";
import { useSeo } from "../../seo/useSeo";
import { breadcrumbJsonLd, collectionJsonLd } from "../../seo/jsonLd";


export default function CollectionDetailPage() {

  const { slug } = useParams();


  const {
    collection,
    loading,
    error,
  } = useCollectionDetail(slug);

  const collectionItems = (collection?.items || []).map((item) => {
    const media = item.movie || item.series || item.media || item;
    const isSeriesItem = Boolean(item.series) || media?.media_type === "series";
    return {
      name: media?.title || media?.original_title || "بدون عنوان",
      path: media?.slug
        ? `/${isSeriesItem ? "series" : "movie"}/${media.slug}`
        : "/collection",
      image: media?.poster_url || media?.poster,
    };
  });

  useSeo({
    title: collection
      ? `کالکشن ${collection.title || collection.name} | دانلود فیلم‌های این مجموعه در مووی‌ورس`
      : "کالکشن فیلم | مووی‌ورس",
    description: collection
      ? `دانلود و تماشای آنلاین همه‌ی فیلم‌های کالکشن ${collection.title || collection.name} با زیرنویس فارسی و بهترین کیفیت در مووی‌ورس. ${collection.description ? String(collection.description).slice(0, 110) : ""}`
      : undefined,
    path: `/collection/${slug}`,
    image: collection?.cover || collection?.poster || collection?.image,
    jsonLd: collection
      ? [
          collectionJsonLd(collection, collectionItems),
          breadcrumbJsonLd([
            { name: "خانه", path: "/" },
            { name: "مجموعه‌ها", path: "/collection" },
            { name: collection.title || collection.name, path: `/collection/${slug}` },
          ]),
        ]
      : undefined,
  });



  if (loading) {

    return (
      <div
        className="
          min-h-screen
          flex
          items-center
          justify-center
          bg-[#08040d]
          text-white
        "
      >
        در حال بارگذاری...
      </div>
    );

  }



  if (error || !collection) {

    return (
      <div
        className="
          min-h-screen
          flex
          items-center
          justify-center
          bg-[#08040d]
          text-red-400
        "
      >
        {error}
      </div>
    );

  }



  return (

    <div
      dir="rtl"
      className="
        min-h-screen
        overflow-hidden
        bg-gradient-to-b
        from-black
        via-[#120709]
        to-[#08040d]
      "
    >

      {/* <SideImage /> */}


      {/* Glow */}

      <div
        className="
          pointer-events-none
          fixed
          -right-40
          top-20
          h-[450px]
          w-[450px]
          rounded-full
          bg-red-600/20
          blur-[150px]
        "
      />


      <main
        className="
          relative
          mx-auto
          max-w-7xl
          px-4
          pb-16
          pt-28
          sm:px-6
          lg:px-8
        "
      >



        {/* HERO */}
        <CollectionHero
          collection={collection}
        />




        {/* MOVIES */}


        <section className="mt-12">


          <h2
            className="
              mb-8
              text-3xl
              font-black
              text-white
            "
          >
            فیلم‌های این کالکشن
          </h2>



          <div
          className="
            grid
            grid-cols-2
            gap-4
            justify-items-center

            xs:grid-cols-2
            sm:grid-cols-2
            md:grid-cols-3
            lg:grid-cols-4
            xl:grid-cols-5
          "
          >


            {
              collection.items
              ?.sort(
                (a,b)=>
                  a.order - b.order
              )
              .map((item)=>{


                const media = item.media;


                if(!media)
                  return null;



                return (

                  <MediaCard

                    key={media.slug}

                    media={media}

                    type={media.media_type ?? "movie"}

                  />

                );


              })

            }


          </div>


        </section>



      </main>


    </div>

  );

}




function Badge({
  icon,
  text
}) {

  return (

    <div
      className="
        flex
        items-center
        gap-2
        rounded-full
        border
        border-white/10
        bg-white/5
        px-4
        py-2
        text-sm
        text-zinc-300
      "
    >

      <span className="text-red-400">
        {icon}
      </span>

      {text}

    </div>

  );

}