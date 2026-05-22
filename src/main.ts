import { createApp } from 'vue'
import '@/assets/main.css'
import App from './App.vue'
import { ensureSyncMetadataMigration } from './db/db'

async function bootstrap() {
  await ensureSyncMetadataMigration()
  createApp(App).mount('#app')
}

void bootstrap()
