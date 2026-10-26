import os
import uuid
from pathlib import Path
from fastapi import UploadFile
from typing import Optional

# Максимальна сторона для прев'ю на сайті. ОРИГІНАЛ ЗАВЖДИ лишається на диску —
# у WebP іде лише копія, на яку посилається БД (так і працює optimize_images.py
# для наявних 900 МБ). Схеми/EPC беруть більший запас, бо їх збільшують.
FOLDER_MAX_SIDE = {"schematics": 2400}


def optimize_to_webp(file_path: Path, max_side: int = 1600, quality: int = 82) -> Optional[str]:
    """Створює <name>.webp поруч з оригіналом і повертає його назву, якщо вигідно.

    Навіщо: на завантаження потрапляли файли до 6.9 МБ / 4000×4000, які сайт
    показує у картці 300–480 px. Вимикається з IMAGE_ORIGINALS_ONLY=1.
    """
    if os.getenv("IMAGE_ORIGINALS_ONLY") == "1":
        return None
    if file_path.suffix.lower() == ".webp":
        return None
    try:
        from PIL import Image

        Image.MAX_IMAGE_PIXELS = 200_000_000
        with Image.open(file_path) as im:
            im.load()
            orig_bytes = file_path.stat().st_size
            if orig_bytes <= 150 * 1024 and max(im.size) <= max_side:
                return None
            work = im.copy()
            if max(work.size) > max_side:
                work.thumbnail((max_side, max_side), Image.LANCZOS)
            if work.mode not in ("RGB", "RGBA"):
                work = work.convert("RGBA" if "A" in work.getbands() else "RGB")
            target = file_path.with_suffix(".webp")
            work.save(target, format="WEBP", quality=quality, method=4)
        if target.stat().st_size >= orig_bytes * 0.95:
            target.unlink(missing_ok=True)
            return None
        return target.name
    except Exception as exc:  # noqa: BLE001 — оптимізація ніколи не має ламати завантаження
        print(f"optimize_to_webp: {exc}")
        return None


class ImageUploader:
    def __init__(self):
        self.base_url = os.getenv("BACKEND_URL", "http://127.0.0.1:8000")
        self.cloudinary_cloud_name = os.getenv("CLOUDINARY_CLOUD_NAME")
        self.cloudinary_api_key = os.getenv("CLOUDINARY_API_KEY")
        self.cloudinary_api_secret = os.getenv("CLOUDINARY_API_SECRET")
        
        # Check if Cloudinary is configured
        self.use_cloudinary = all([
            self.cloudinary_cloud_name,
            self.cloudinary_api_key,
            self.cloudinary_api_secret
        ])
        
        if self.use_cloudinary:
            try:
                import cloudinary
                import cloudinary.uploader
                cloudinary.config(
                    cloud_name=self.cloudinary_cloud_name,
                    api_key=self.cloudinary_api_key,
                    api_secret=self.cloudinary_api_secret
                )
            except ImportError:
                self.use_cloudinary = False
    
    async def upload_image(self, file: UploadFile, folder: str = "tesla-parts") -> Optional[str]:
        """
        Upload an image file and return its URL.
        
        Args:
            file: FastAPI UploadFile object
            folder: Folder path for organization (e.g., "tesla-parts/products")
        
        Returns:
            URL string of the uploaded image, or None if upload fails
        """
        if not file.filename:
            return None
        
        try:
            if self.use_cloudinary:
                return await self._upload_to_cloudinary(file, folder)
            else:
                return await self._upload_to_local(file, folder)
        except Exception as e:
            print(f"Error uploading image: {e}")
            return None
    
    async def _upload_to_cloudinary(self, file: UploadFile, folder: str) -> str:
        """Upload image to Cloudinary."""
        import cloudinary.uploader
        
        # Read file content
        contents = await file.read()
        
        # Upload to Cloudinary
        result = cloudinary.uploader.upload(
            contents,
            folder=folder,
            public_id=file.filename.rsplit('.', 1)[0] if '.' in file.filename else file.filename
        )
        
        return result.get("secure_url") or result.get("url")
    
    async def upload_from_url(self, url: str, folder: str = "tesla-parts") -> Optional[dict]:
        """Завантажує зображення за посиланням і зберігає ОРИГІНАЛ.

        Так зручно тягнути великі креслення прямо з EPC Tesla: файл лягає на диск
        без стиснення, тож на сайті його можна глибоко наближати без розмиття.
        """
        if not url or not url.lower().startswith(("http://", "https://")):
            return None

        try:
            import httpx

            headers = {
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36",
                "Accept": "image/avif,image/webp,image/png,image/jpeg,*/*",
            }
            async with httpx.AsyncClient(
                follow_redirects=True, timeout=45.0, headers=headers
            ) as client:
                response = await client.get(url)
                response.raise_for_status()
                content = response.content
                content_type = (response.headers.get("content-type") or "").split(";")[0].strip().lower()
        except Exception as e:
            print(f"Error downloading image by url: {e}")
            return None

        # Обмеження: тільки картинки й не більше 30 МБ
        if content_type and not content_type.startswith("image/"):
            print(f"Not an image: {content_type}")
            return None
        if len(content) > 30 * 1024 * 1024:
            print("Image too large")
            return None

        guessed_ext = ".png" if "png" in content_type else ".jpg" if ("jpeg" in content_type or "jpg" in content_type) else ""
        if not guessed_ext:
            path_ext = os.path.splitext(url.split("?")[0])[1].lower()
            guessed_ext = path_ext if path_ext in (".png", ".jpg", ".jpeg", ".webp", ".gif") else ".png"

        upload_dir = Path("static") / "images" / folder
        upload_dir.mkdir(parents=True, exist_ok=True)
        unique_filename = f"{uuid.uuid4()}{guessed_ext}"
        file_path = upload_dir / unique_filename
        with open(file_path, "wb") as f:
            f.write(content)

        optimized = optimize_to_webp(
            file_path, max_side=FOLDER_MAX_SIDE.get(folder, 1600)
        )
        if optimized:
            unique_filename = optimized
            file_path = file_path.with_name(optimized)

        base_url = self.base_url.rstrip("/")
        return {
            "image_url": f"{base_url}/static/images/{folder}/{unique_filename}",
            "bytes": len(content),
            "content_type": content_type or None,
        }

    async def _upload_to_local(self, file: UploadFile, folder: str) -> str:
        """Upload image to local storage."""
        # Create directory structure
        upload_dir = Path("static") / "images" / folder
        upload_dir.mkdir(parents=True, exist_ok=True)
        
        # Generate unique filename
        file_ext = Path(file.filename).suffix if file.filename else ".jpg"
        unique_filename = f"{uuid.uuid4()}{file_ext}"
        file_path = upload_dir / unique_filename
        
        # Save file
        contents = await file.read()
        with open(file_path, "wb") as f:
            f.write(contents)

        # Поруч з оригіналом кладемо стиснений WebP і віддаємо в БД його:
        # оригінал лишається (для друку/збільшення), а сайт не тягне 6 МБ.
        optimized = optimize_to_webp(
            file_path, max_side=FOLDER_MAX_SIDE.get(folder, 1600)
        )
        if optimized:
            unique_filename = optimized
        
        # Картинку зберігаємо ЯК Є — без обрізання полів.
        # Автоматичне обрізання пробували: воно визначає межі малюнка по темних
        # пікселях, тому світло-сірі частини креслення (друга туманка, тонкі
        # лінії, бліді деталі) приймались за фон і ВИРІЗАЛИСЬ разом із полями.
        # Тому обробку вимкнено: на сайті показується рівно той файл, який
        # завантажив адмін.
        base_url = self.base_url.rstrip("/")
        file_location = f"static/images/{folder}/{unique_filename}"
        return f"{base_url}/{file_location}"

# Create singleton instance
image_uploader = ImageUploader()

