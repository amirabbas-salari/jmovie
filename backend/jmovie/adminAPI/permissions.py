"""
سیستم سطح دسترسی پنل مدیریت
============================
مدل دسترسی بر پایه‌ی سیستم داخلی جنگو (Permission + Group) ساخته شده است:

* **سوپرادمین** (`is_superuser=True`): به همه‌چیز دسترسی دارد و تنها کسی است
  که می‌تواند نقش بسازد/حذف کند و برای بقیه‌ی ادمین‌ها سطح دسترسی تعیین کند.
* **ادمین‌های عادی** (`is_staff=True`): دسترسی‌شان از «نقش‌هایی» (Group)
  می‌آید که سوپرادمین به آن‌ها داده است. هر نقش مجموعه‌ای از مجوزهاست؛
  مثلاً نقش «مدیر محتوا» فقط مجوزهای فیلم/سریال را دارد.
* هر ویوست برای هر اکشن، مجوز متناظر همان مدل را چک می‌کند:
  مشاهده ← `view_<model>`، ساخت ← `add_<model>`، ویرایش ← `change_<model>`،
  حذف ← `delete_<model>` و اکشن‌های خاص (مثل تأیید کامنت) مجوز اختصاصی خودشان
  را دارند. این مجوزها را جنگو به‌صورت خودکار برای هر مدل می‌سازد.
"""
from rest_framework import permissions
from rest_framework.exceptions import PermissionDenied


class IsSuperAdmin(permissions.BasePermission):
    """فقط سوپرادمین — برای مدیریت نقش‌ها و سطوح دسترسی."""

    message = "فقط سوپرادمین به این بخش دسترسی دارد."

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.is_superuser)


class IsStaffMember(permissions.BasePermission):
    """حداقل شرط ورود به پنل: کاربر staff یا سوپرادمین باشد."""

    message = "دسترسی به پنل مدیریت ندارید."

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and (user.is_staff or user.is_superuser)
        )


# نگاشت اکشن‌های استاندارد DRF به فعل مجوز جنگو
ACTION_PERMISSION_VERBS = {
    "list": "view",
    "retrieve": "view",
    "create": "add",
    "update": "change",
    "partial_update": "change",
    "destroy": "delete",
}


class HasModelPermission(permissions.BasePermission):
    """
    مجوز ریزدانه بر اساس مدلِ ویوست و اکشن جاری.

    ویوست می‌تواند با `extra_action_permissions = {"approve": "change_comment"}`
    برای اکشن‌های سفارشی هم مجوز مشخص کند. سوپرادمین همیشه مجاز است.
    """

    message = "شما مجوز انجام این عملیات را ندارید."

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated):
            return False
        if user.is_superuser:
            return True
        if not user.is_staff:
            return False

        required = self._required_permission(request, view)
        if required is None:
            # اکشنی که مجوز مشخصی ندارد فقط برای سوپرادمین باز است.
            return False
        return user.has_perm(required)

    @staticmethod
    def _required_permission(request, view):
        extra = getattr(view, "extra_action_permissions", {}) or {}
        action = getattr(view, "action", None)
        if action in extra:
            return extra[action]

        verb = ACTION_PERMISSION_VERBS.get(action)
        model = None
        queryset = getattr(view, "queryset", None)
        if queryset is not None:
            model = queryset.model
        if model is None:
            serializer_class = getattr(view, "serializer_class", None)
            if serializer_class is not None:
                model = serializer_class.Meta.model
        if verb is None or model is None:
            return None
        meta = model._meta
        return f"{meta.app_label}.{verb}_{meta.model_name}"


def ensure_superuser_for_privilege_escalation(request, validated_data, instance=None):
    """
    جلوی ارتقای سطح دسترسی توسط ادمین عادی را می‌گیرد:
    فقط سوپرادمین می‌تواند is_staff / is_superuser / نقش‌های یک کاربر را عوض کند
    یا کاربرِ سوپرادمین را ویرایش کند.
    """
    user = request.user
    if user.is_superuser:
        return
    privileged_fields = {"is_staff", "is_superuser", "groups"}
    if privileged_fields & set(validated_data.keys()):
        raise PermissionDenied("تغییر سطح دسترسی فقط توسط سوپرادمین انجام می‌شود.")
    if instance is not None and instance.is_superuser:
        raise PermissionDenied("ویرایش حساب سوپرادمین فقط توسط خود سوپرادمین مجاز است.")


# سازگاری با ایمپورت قدیمی
IsStaffAdmin = IsStaffMember
