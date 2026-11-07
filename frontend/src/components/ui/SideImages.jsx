import deadpool from "../../assets/success_signup/deadpool.webp";
import raya from "../../assets/success_signup/raya.webp";
import avatar from "../../assets/success_signup/avatar.webp";
import minions from "../../assets/success_signup/minions.webp";

export default function SideImages({ showMinions = true, showOther = true }) {
  return (
    <div className="pointer-events-none">
      
      {showOther && (
        <>

            {/* deadpool */}
            <img
            src={deadpool}
            alt=""
            aria-hidden="true"
            className="
                fixed bottom-0 left-2
                h-[200px] sm:h-[320px] md:h-[320px] lg:h-[350px] xl:h-[450px]
                w-auto select-none object-contain
            "
            />

            {/* raya */}
            <img
            src={raya}
            alt=""
            aria-hidden="true"
            className="
                fixed
                h-[200px] sm:h-[220px] md:h-[320px] lg:h-[450px] xl:h-[600px]
                bottom-[700px] sm:bottom-[500px] md:bottom-[500px] lg:bottom-[450px] xl:bottom-80
                -left-[131px] sm:-left-[143px] md:-left-[208px] lg:-left-[292px] xl:-left-[390px]
                w-auto select-none object-contain
            "
            />

            {/* avatar */}
            <img
            src={avatar}
            alt=""
            aria-hidden="true"
            className="
                fixed bottom-0
                h-[220px] sm:h-[300px] md:h-[350px] lg:h-[650px] xl:h-[850px]
                right-[40px] sm:right-[28px] md:right-[35px] lg:-right-6 xl:-right-6
                w-auto select-none object-contain
            "
            />
        </>
      )}

      {/* minions */}
      {showMinions && (
        <img
          src={minions}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute top-[110px] right-[825px] -translate-x-1/2 h-[115px] w-auto select-none object-contain"
        />
      )}
    </div>
  );
}