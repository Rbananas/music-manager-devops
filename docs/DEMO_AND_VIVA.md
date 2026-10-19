# Music Manager demonstration and viva guide

## Five-minute demonstration

1. **Show the architecture.** Point out the React/Vite web app, Express API, MongoDB, persistent upload volume, Prometheus, and Grafana in the Compose diagram in the README.
2. **Register.** Create a demonstration account in the app. Explain that bcrypt hashes the password before it reaches MongoDB; the API returns a signed JWT.
3. **Add audio.** Upload a small audio file and enter its title, artist, and album. Show the new track in the library.
4. **Use the library.** Search by title or artist, sort the results, start playback, pause, and seek using the player timeline.
5. **Create a playlist.** Create a named playlist, add a track from its row menu, open the playlist, rename it, and remove the track from the playlist.
6. **Explain privacy.** Mention that each request carries a bearer token and track/playlist database queries include the token's user ID. Playlist updates reject IDs for tracks owned by another user.
7. **Show operations.** Open `/api/health`, Prometheus targets at `/targets`, and the **Music Manager — API Overview** Grafana dashboard. Generate one or two requests first so the dashboard has live measurements to display.
8. **Show persistence.** Stop and restart with `docker compose down` followed by `docker compose up -d`; explain that named volumes preserve MongoDB records and uploaded files. Avoid `down -v` during the demo.

Use a small non-copyrighted or self-created audio sample for the upload demonstration. Keep demo accounts and credentials local to the presentation environment.

## Viva questions and concise answers

### Why use JWT?

The API is stateless between requests: it verifies the signed token and reads its subject as the account ID. The token is sent in the Authorization header, and the secret stays in the environment rather than source control.

### How are passwords protected?

The API hashes passwords with bcrypt using a work factor of 12. It stores only `passwordHash`, excludes that field from normal model reads, and compares login input with bcrypt rather than decrypting a password.

### How is user privacy enforced?

Authentication sets `req.userId`. Track reads, deletes, and streams query by both track ID and owner. Playlist reads and mutations query by playlist ID and owner; membership updates also verify that every track belongs to that owner.

### Why store metadata in MongoDB and audio on disk?

MongoDB stores searchable fields and ownership references. Multer writes the larger binary data to a persistent directory, which avoids putting audio blobs inside database documents. The database stores a generated filename and metadata pointing to the file.

### How does seeking work?

The stream route uses Express `sendFile`, which honors HTTP byte-range requests. The browser seeks by requesting the appropriate range from the same authorized stream endpoint.

### What does Docker Compose provide?

It starts MongoDB, the API, the web server, Prometheus, and Grafana on one network. Health checks gate dependent services; named volumes retain database and uploaded files after containers are recreated.

### What does Prometheus collect?

It scrapes `/metrics` from the API on a 15-second interval. Custom counters track request count by method, route, and status; a histogram records request duration. Default Node.js process metrics are also exported.

### How does CI help?

GitHub Actions installs locked dependencies, runs API and UI tests, creates a production frontend build, and builds both service images for every push or pull request to the configured branches.

### What is not intended for production use?

This is a demonstration project. It uses a simple local JWT session in the browser and single-node local file storage. A public deployment should add HTTPS, stronger operational secrets management, rate limiting, malware/content inspection, backups, and object storage for uploaded media.

## Troubleshooting during the demo

- **API says database unavailable:** check `docker compose ps` and `docker compose logs api mongo`; wait until MongoDB's health check passes.
- **Authentication is not configured:** set a non-placeholder `JWT_SECRET` in `.env`, then recreate the API with `docker compose up -d --force-recreate api`.
- **Grafana prompts for login:** use the values in `.env`; wait for Prometheus to report the API target as `UP`.
- **Dashboard has no time series yet:** create a few app/API requests and wait for one scrape interval. Prometheus does not invent data.
- **Audio upload fails:** confirm the selected file is an accepted audio MIME type and is below `MAX_UPLOAD_SIZE_MB`.
