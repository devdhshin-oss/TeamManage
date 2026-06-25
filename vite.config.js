import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  // 🚨 GitHub Pages 배포를 위한 경로 설정 (레포지토리 이름)
  base: '/TeamManage/',
})