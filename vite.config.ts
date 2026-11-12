import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

// `npm run dev:https` sobe o servidor com HTTPS na rede local, para testar a
// câmera no celular (navegadores só liberam câmera em HTTPS ou localhost).
export default defineConfig(({ mode }) => ({
  plugins: mode === 'https' ? [basicSsl()] : [],
  build: {
    // three.js sozinho já passa de 500 kB
    chunkSizeWarningLimit: 900,
  },
}));
