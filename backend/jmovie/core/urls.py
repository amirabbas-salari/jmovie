from django.urls import path
from .views import SupportMessageCreateView, test_api

urlpatterns = [
    path('test/', test_api),
    # فرم‌های صفحه‌ی حمایت/پشتیبانی
    path('messages/', SupportMessageCreateView.as_view(), name='support-messages'),
]
