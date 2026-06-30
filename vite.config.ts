import {defineConfig} from 'vite'
import {resolve} from 'path'
import react from '@vitejs/plugin-react'
import tailwindcss from 'tailwindcss'
import autoprefixer from 'autoprefixer'


// https://vite.dev/config/
// `base` makes the build work under a sub-path (GitHub Pages serves at
// https://<user>.github.io/<repo>/). Set VITE_BASE="/<repo>/" for project Pages,
// or leave "/" for a custom domain / user Pages.
export default defineConfig({
    base: process.env.VITE_BASE ?? '/',
    plugins: [react()],
    server: {
        port: 9001,
        host: "0.0.0.0",
        proxy: {
            '/user': {
                target: 'http://127.0.0.1:4523/m1/5862507-0-default',
                changeOrigin: true
            },
            "/samplebrain": {
                target: 'https://localhost:8080',
                changeOrigin: true
            }
        }
    },
    resolve: {
        alias: {
            '@': resolve(__dirname, './src')
        }
    },
    css: {
        postcss: {
            plugins: [
                tailwindcss,
                autoprefixer,
            ]
        }
    }
})
