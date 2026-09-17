import os
import uuid
from pathlib import Path
from fastapi import UploadFile
from typing import Optional

def trim_and_whiten_image(path: Path, padding: float = 0.03) -> bool:
    """Обрізає порожні поля навколо малюнка і вибілює світлий фон.

    Робиться на сервері, щоб браузер не витрачав час на canvas — інакше картинка
    встигала показатись із сірим фоном, а потім «перемальовувалась» у білу.
    Повертає True, якщо файл змінився.
    """
    try:
        from PIL import Image

        with Image.open(path) as src:
            img = src.convert("RGB")
            width, height = img.size
            if width < 8 or height < 8:
                return False

            # фон беремо з кута
            corner = img.getpixel((0, 0))
            corner_luma = 0.299 * corner[0] + 0.587 * corner[1] + 0.114 * corner[2]
            # темний фон = фото, його не чіпаємо
            if corner_luma < 210:
                return False
            whiten_threshold = corner_luma - 8
            limit = min(232, whiten_threshold)

            # межі малюнка (працюємо на зменшеній копії — швидко)
            probe_w = min(width, 420)
            probe_h = max(1, round(height * probe_w / width))
            probe = img.resize((probe_w, probe_h))
            px = probe.load()
            min_x, min_y, max_x, max_y = probe_w, probe_h, -1, -1
            for y in range(probe_h):
                for x in range(probe_w):
                    r, g, b = px[x, y]
                    luma = 0.299 * r + 0.587 * g + 0.114 * b
                    if luma < limit:
                        if x < min_x:
                            min_x = x
                        if y < min_y:
                            min_y = y
                        if x > max_x:
                            max_x = x
                        if y > max_y:
                            max_y = y
            if max_x < 0 or max_y < 0:
                return False

            pad_x = round(probe_w * padding)
            pad_y = round(probe_h * padding)
            min_x = max(0, min_x - pad_x)
            min_y = max(0, min_y - pad_y)
            max_x = min(probe_w - 1, max_x + pad_x)
            max_y = min(probe_h - 1, max_y + pad_y)

            scale = width / probe_w
            box = (
                int(min_x * scale),
                int(min_y * scale),
                int((max_x + 1) * scale),
                int((max_y + 1) * scale),
            )
            nothing_to_crop = (box[2] - box[0]) >= width * 0.96 and (box[3] - box[1]) >= height * 0.96
            already_white = corner_luma >= 250
            if nothing_to_crop and already_white:
                return False

            cropped = img.crop(box)
            # вибілюємо фон
            data = cropped.load()
            cw, ch = cropped.size
            for y in range(ch):
                for x in range(cw):
                    r, g, b = data[x, y]
                    luma = 0.299 * r + 0.587 * g + 0.114 * b
                    if luma >= whiten_threshold:
                        data[x, y] = (255, 255, 255)
            # Зберігаємо у ТОМУ Ж форматі, що й оригінал: інакше .jpg містив би
            # PNG-дані й сервер віддавав би неправильний Content-Type.
            if str(path).lower().endswith((".jpg", ".jpeg")):
                cropped.save(path, format="JPEG", quality=95, subsampling=0)
            else:
                cropped.save(path, format="PNG")
        return True
    except Exception as e:  # pragma: no cover
        print(f"Image trim skipped: {e}")
        return False


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
        
        # Return URL
        # Remove leading slash from base_url if present, and ensure folder path is correct
        # Картки каталогу: обрізаємо поля й вибілюємо фон одразу на сервері.
        # Креслення схем НЕ чіпаємо — координати точок прив'язані до оригіналу.
        if folder.endswith("categories") or folder.endswith("subcategories"):
            trim_and_whiten_image(file_path)

        base_url = self.base_url.rstrip("/")
        file_location = f"static/images/{folder}/{unique_filename}"
        return f"{base_url}/{file_location}"

# Create singleton instance
image_uploader = ImageUploader()

