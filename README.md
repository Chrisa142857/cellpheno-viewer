


## System setup
1. Confirm npm
```
npm --version && node --version
```

2. Install pnpm
```
npm install -g pnpm
```

## Frontend is for local use

3. Git clone
```
git clone https://github.com/Chrisa142857/cellpheno-frontend.git
cd cellpheno-frontend
```

4. Install dependencies
```
pnpm install
```

5. Run
```
pnpm run dev
```

6. Build
```
pnpm build
```

## Host on GitHub Pages + connect to your backend

The viewer is a static SPA, so it can be served from GitHub Pages while the data
backend (the `nis_ondemand_viewer` zoom service and/or MinIO) runs on your own
node.

- **Deploy:** the included workflow `.github/workflows/deploy-pages.yml` builds and
  publishes to Pages on push to `main`. It builds with `VITE_BASE=/cellpheno-frontend/`
  (the project-site sub-path); set it to `/` for a custom domain or user/org site.
  Routing uses a hash (`/#/preview`) so deep links and refresh work without a
  server-side fallback.
- **Connect:** the deployed build ships with **no backend baked in**. Click
  **Connect to server** in the header and enter your node's origins:
  - *On-demand zoom service* — `nis_ondemand_viewer`, e.g. `http://localhost:8090`
    (leave blank to use pre-built MinIO cubes),
  - *MinIO origin* + *bucket* — for the brain list and density maps.
  Values are saved in the browser (`localStorage`); **Test connection** pings
  `/healthz`. CORS is already open on the zoom service.
- **⚠️ Mixed content:** a Pages site is served over **HTTPS**, and browsers block it
  from fetching a plain-**HTTP** backend. To connect to an HTTP backend either
  (a) SSH-tunnel it to `http://localhost:<port>` (localhost HTTP is allowed from
  HTTPS), or (b) put the backend behind HTTPS. A locally served frontend
  (`pnpm dev`, HTTP) can reach an HTTP backend directly.

## Prepare data

7. Convert NIS results as MinIO S3 bucket 

To let zoom-in view can real-time display, chunk NIS results into small chunks using `prepare_nis_to_aws.py`. Usage example: `prepare_nis_to_aws_cmd.sh`.

8. Host the local S3 via Docker

Init container:
```
docker load -i ./minio_docker_container.tar
docker run -d -p 9090:9090 -p 8080:9000   -e "MINIO_ROOT_USER=admin"   -e "MINIO_ROOT_PASSWORD=admin123"   -v /path/to/cellpheno_minio_database:/data   --name minio   minio_img:latest server /data --console-address ":9090"
```

Start container
`docker start -a /minio`

## Project Technologies
This project uses:
- React 18.3.1 as the UI library
- TypeScript for type safety
- Vite as the build tool and development server
- TailwindCSS for styling
- Ant Design (antd) for UI components
- React Router for routing
- Axios for HTTP requests
- zustand for state management
- ESLint for code linting