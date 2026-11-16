# Medios del prototipo

- `portada.jpg`: miniatura del video, versionada.
- `leccion-demo.mp4`: video vertical de demostración (720×1280, 27 s, con audio). No se versiona por peso; está en `.gitignore`.

Para regenerarlo desde el original:

```bash
ffmpeg -i avatar-mas-nivia-9x16.mp4 -vf scale=720:-2 -c:v libx264 -preset slow -crf 24 -pix_fmt yuv420p -c:a aac -b:a 128k -movflags +faststart leccion-demo.mp4
ffmpeg -ss 1 -i leccion-demo.mp4 -frames:v 1 -vf scale=360:-2 -q:v 4 portada.jpg
```
