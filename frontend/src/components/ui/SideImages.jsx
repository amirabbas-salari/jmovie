import deadpool from "../../assets/success_signup/deadpool.webp";
import raya from "../../assets/success_signup/raya.webp";
import avatar from "../../assets/success_signup/avatar.webp";
import minions from "../../assets/success_signup/minions.webp";

// تصاویر تزئینی کناری (کاراکترها) فقط دکور دسکتاپ هستند.
// قبلاً در موبایل هم به‌صورت fixed با ارتفاع زیاد پایین صفحه می‌نشستند و
// روی کارت‌ها، متن و ناوبری پایین می‌افتادند و لی‌اوت را خراب می‌کردند؛
// حالا زیر lg کاملاً مخفی‌اند و کانتینرشان هم overflow را می‌بندد تا
// هیچ اسکرول افقی‌ای ساخته نشود.
export default function SideImages({ showMinions = true, showOther = true }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 hidden select-none overflow-hidden lg:block"
    >
      {showOther && (
        <>
          {/* deadpool */}
          <img
            src={deadpool}
            alt=""
            className="absolute bottom-0 left-2 h-[320px] w-auto object-contain lg:h-[350px] xl:h-[450px]"
          />

          {/* raya */}
          <img
            src={raya}
            alt=""
            className="absolute bottom-[450px] -left-[208px] h-[320px] w-auto object-contain lg:-left-[292px] xl:bottom-80 xl:-left-[390px] xl:h-[600px]"
          />

          {/* avatar */}
          <img
            src={avatar}
            alt=""
            className="absolute bottom-0 right-[35px] h-[350px] w-auto object-contain lg:-right-6 lg:h-[650px] xl:h-[850px]"
          />
        </>
      )}

      {/* minions — قبلاً right-[825px] هاردکد بود و در صفحات باریک
          بیرون از کادر قرار می‌گرفت؛ حالا وسط‌چین و فقط در دسکتاپ است */}
      {showMinions && (
        <img
          src={minions}
          alt=""
          className="absolute left-1/2 top-[110px] h-[115px] w-auto -translate-x-1/2 object-contain"
        />
      )}
    </div>
  );
}
