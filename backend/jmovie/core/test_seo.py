from django.core.cache import cache
from django.test import TestCase, override_settings

from movies.models import Movie
from series.models import Series


@override_settings(CACHES={"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}})
class SeoEndpointsTest(TestCase):
    def setUp(self):
        cache.clear()
        Movie.objects.create(
            title="رستگاری در شاوشنک", slug="the-shawshank-redemption",
            imdb_id="tt0111161", runtime=142,
        )
        Series.objects.create(
            title="برکینگ بد", slug="breaking-bad", imdb_id="tt0903747",
        )

    def test_sitemap_contains_static_and_media_urls(self):
        res = self.client.get("/sitemap.xml")
        self.assertEqual(res.status_code, 200)
        self.assertIn("application/xml", res["Content-Type"])
        body = res.content.decode()
        self.assertIn("/movie/the-shawshank-redemption", body)
        self.assertIn("/series/breaking-bad", body)
        self.assertIn("/movies", body)
        self.assertIn("<lastmod>", body)

    def test_robots_points_to_sitemap_and_blocks_admin(self):
        res = self.client.get("/robots.txt")
        self.assertEqual(res.status_code, 200)
        body = res.content.decode()
        self.assertIn("Sitemap: ", body)
        self.assertIn("/sitemap.xml", body)
        self.assertIn("Disallow: /admin/", body)
