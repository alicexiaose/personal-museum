import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    // 绑定 0.0.0.0，同一 WiFi 下其他设备可用「本机局域网 IP + 端口」访问
    host: true,
  },
});
