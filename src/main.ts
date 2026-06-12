import { createApp } from 'vue'
import '@/assets/main.css'
import App from './App.vue'
import { ensureSyncMetadataMigration } from './db/db'
import { db } from './db/db'
import { createSpeedtabI18n, resolveSupportedLocale, UI_LANGUAGE_SETTING_KEY } from './i18n'

async function bootstrap() {
  await ensureSyncMetadataMigration()
  const savedLanguageSetting = await db.app_settings.get(UI_LANGUAGE_SETTING_KEY)
  let initialLocale: string | null = null

  try {
    initialLocale = savedLanguageSetting?.value_json
      ? resolveSupportedLocale(JSON.parse(savedLanguageSetting.value_json))
      : null
  } catch {
    initialLocale = null
  }

  const app = createApp(App)
  app.use(await createSpeedtabI18n(initialLocale))
  app.mount('#app')
}

void bootstrap()
