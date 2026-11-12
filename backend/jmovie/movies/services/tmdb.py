import requests
from django.conf import settings



BASE_URL = "https://api.themoviedb.org/3"
# BASE_URL = "https://api-themoviedb-org-4qzceuvp4jfp.curlhub.io/3"



class TMDBClient:

    def __init__(self):
        self.api_key = settings.TMDB_API_KEY
        self.timeout = 30
        self.session = requests.Session()
        
    
    def _get(self, endpoint, params=None):
        response = self.session.get(
            f"{BASE_URL}/{endpoint}",
            params={
                "api_key": self.api_key,
                **(params or {}),
            },
            timeout=self.timeout,
            # proxies=self.proxies,
        )

        response.raise_for_status()
        return response.json()

    def find_movie(self, imdb_id):

        response = requests.get(
            f"{BASE_URL}/find/{imdb_id}",
            params={
                "api_key": self.api_key,
                "external_source": "imdb_id",
            },
            timeout=30,
        )

        response.raise_for_status()

        data = response.json()

        if not data["movie_results"]:
            return None

        return data["movie_results"][0]["id"]


    def person_details(self, tmdb_id, language="en-US"):

        response = requests.get(
            f"{BASE_URL}/person/{tmdb_id}",
            params={
                "api_key": self.api_key,
                "language": language,
            },
            timeout=30,
        )

        response.raise_for_status()
        return response.json()



    def movie_details(self, tmdb_id, language="en-US"):

        response = requests.get(
            f"{BASE_URL}/movie/{tmdb_id}",
            params={
                "api_key": self.api_key,
                "language": language,
                # "append_to_response": "credits",
            },
            timeout=30,
        )

        response.raise_for_status()
        return response.json()
    
    
    def find_tv(self, imdb_id):
        data = self._get(
            "find/" + imdb_id,
            {
                "external_source": "imdb_id"
            }
        )

        results = data.get("tv_results", [])

        if not results:
            return None

        return results[0]["id"]
    
    
    def tv_details(self, tmdb_id, language="en-US"):
        return self._get(
            f"tv/{tmdb_id}",
            {
                "language": language,
                # "append_to_response": "credits,images,videos",
                # "include_image_language": "en,null"
            }
        )
    
    
    def get_genres(self, language="en-US"):

        response = requests.get(
            f"{BASE_URL}/genre/movie/list",
            params={
                "api_key": self.api_key,
                "language": language,
            },
            timeout=30,
        )

        response.raise_for_status()
        return response.json()["genres"]
    
    
    def movie_images(self, tmdb_id):

        response = requests.get(
            f"{BASE_URL}/movie/{tmdb_id}/images",
            params={
                "api_key": self.api_key,
            },
            timeout=30,
        )

        response.raise_for_status()

        return response.json()
    
    
    
    def tv_images(self, tmdb_id):

        response = requests.get(
            f"{BASE_URL}/tv/{tmdb_id}/images",
            params={
                "api_key": self.api_key,
            },
            timeout=30,
        )

        response.raise_for_status()

        return response.json()
    
    
    def season_details(self, tmdb_id, season_number):

        response = requests.get(
            f"{BASE_URL}/tv/{tmdb_id}/season/{season_number}",
            params={
                "api_key": self.api_key,
                "language": "en-US",
            },
            timeout=30,
        )

        response.raise_for_status()
        return response.json()
    
    
    
    def episode_details(
        self,
        tv_id,
        season_number,
        episode_number,
        language="fa-IR"
    ):

        response = requests.get(
            f"{BASE_URL}/tv/{tv_id}/season/{season_number}/episode/{episode_number}",
            params={
                "api_key": self.api_key,
                "language": language,
            },
            timeout=30,
        )

        response.raise_for_status()
        return response.json()
    
    
    
    def season_details(
        self,
        tv_id,
        season_number,
        language="en-US"
    ):

        response = requests.get(
            f"{BASE_URL}/tv/{tv_id}/season/{season_number}",
            params={
                "api_key": self.api_key,
                "language": language,
            },
            timeout=30,
        )

        response.raise_for_status()
        return response.json()

    # --- جزئیات کامل برای «دریافت خودکار» پنل مدیریت (همراه عوامل و آی‌دی‌های خارجی) ---
    # images هم گرفته می‌شود تا پنل بتواند تا ۵ تصویر برای گالری اثر پر کند.
    def movie_full_details(self, tmdb_id, language="fa-IR"):
        return self._get(
            f"movie/{tmdb_id}",
            {
                "language": language,
                "append_to_response": "credits,external_ids,images",
                "include_image_language": "en,null",
            },
        )

    def tv_full_details(self, tmdb_id, language="fa-IR"):
        return self._get(
            f"tv/{tmdb_id}",
            {
                "language": language,
                "append_to_response": "credits,external_ids,images",
                "include_image_language": "en,null",
            },
        )
