"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.1/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from django.conf.urls.static import static
from django.conf import settings
from rest_framework.routers import DefaultRouter
from drf_spectacular.views import (
    SpectacularAPIView, 
    SpectacularSwaggerView, 
    SpectacularRedocView    
)
from rest_framework_simplejwt.views import (
    TokenRefreshView,
)
from rest_framework.permissions import IsAdminUser

from accounts.views import ThrottledTokenObtainPairView
from search.views import GlobalSearchView
from .seo_views import robots_view, sitemap_view


# from movies.views import AdminMovieViewSet



# router = DefaultRouter()
# router.register("admin/movies", AdminMovieViewSet, basename="admin-movies")


urlpatterns = [
    # path('', include(router.urls)),

    # SEO: سایت‌مپ داینامیک همه‌ی فیلم‌ها/سریال‌ها و robots
    path('sitemap.xml', sitemap_view, name='sitemap'),
    path('robots.txt', robots_view, name='robots'),

    # admin panels
    path('django-admin/', admin.site.urls),
    path('admin/', include('adminAPI.urls')),

    # apps
    path('accounts/', include('accounts.urls')),
    path('search/', include('search.urls')),
    path('movies/', include('movies.urls')),
    path('series/', include('series.urls')),
    path('genres/', include('genres.urls')),
    path('comments/', include('comments.urls')),
    path('people/', include('people.urls')),
    path('collections/', include('collection.urls')),
    
    # ai
    path("ai/", include("ai.urls")),

    # ایجنت محتوای خودکار (پنل ادمین)
    path("agent/", include("content_agent.urls")),

    # فرم‌های صفحه‌ی حمایت/پشتیبانی (ثبت پیام عمومی)
    path("support/", include("core.urls")),
    
    # search
    path("search/", GlobalSearchView.as_view(), name="global-search"),

    # token
    path('api/token/', ThrottledTokenObtainPairView.as_view()),
    path('api/token/refresh/', TokenRefreshView.as_view()),


    # path('api/', include('core.urls')),

    # swagger — مستندات کامل API (نقشه‌ی همه‌ی endpointها) فقط برای
    # ادمین‌های لاگین‌کرده؛ نمایش عمومی آن کار مهاجم را راحت می‌کند.
    path('api/schema/', SpectacularAPIView.as_view(permission_classes=[IsAdminUser]), name='schema'),
    path('swagger/', SpectacularSwaggerView.as_view(url_name='schema', permission_classes=[IsAdminUser]), name='swagger-ui'),
    path('api/redoc/', SpectacularRedocView.as_view(url_name='schema', permission_classes=[IsAdminUser]), name='redoc'),

]

# urls.py
from django.conf import settings
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

# urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)




