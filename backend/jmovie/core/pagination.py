from rest_framework.pagination import PageNumberPagination


class StandardResultsSetPagination(PageNumberPagination):
    """صفحه‌بندی پیش‌فرض API عمومی.

    قبلاً page_size سقفی نداشت و هر کسی می‌توانست با
    ?page_size=100000 کل جدول را در یک پاسخ بگیرد (هم کند، هم بردار
    ساده‌ی DoS). حالا حداکثر ۱۰۰ آیتم در هر صفحه برمی‌گردد.
    """

    page_size = 24
    page_size_query_param = "page_size"
    max_page_size = 100
