import {db} from '../../db/db.ts'
import {getEffectiveUiConfig, normalizeUiConfig} from '../features/customizer/normalize.js'
import {UI_CONFIG_VERSION} from '../config/ui-config-defaults.js'

const WORKSPACE_ID_KEY = 'next_workspace_id'
const DEVICE_ID_KEY = 'next_device_id'

async function getOrCreateSetting(key) {
  const existing = await db.app_settings.get(key)
  if (existing?.value_json) {
    return JSON.parse(existing.value_json)
  }

  const value = crypto.randomUUID()
  await db.app_settings.put({
    key,
    value_json: JSON.stringify(value),
    updated_at: Date.now(),
  })
  return value
}

export async function getNextUiContext() {
  const [workspaceId, deviceId] = await Promise.all([
    getOrCreateSetting(WORKSPACE_ID_KEY),
    getOrCreateSetting(DEVICE_ID_KEY),
  ])

  return {
    workspace_id: workspaceId,
    device_id: deviceId,
  }
}

export async function loadUiConfigsByEntitySyncIds(entityType, entities) {
  if (!entities?.length) return new Map()

  const {workspace_id} = await getNextUiContext()
  const syncIds = entities
    .map((entity) => entity.sync_id)
    .filter(Boolean)

  if (!syncIds.length) return new Map()

  const keys = syncIds.map((syncId) => [workspace_id, syncId])
  const rows = await db.next_ui_config
    .where('[workspace_id+entity_sync_id]')
    .anyOf(keys)
    .toArray()

  const rowMap = new Map(rows.map((row) => [row.entity_sync_id, row]))

  return new Map(entities.map((entity) => {
    const row = rowMap.get(entity.sync_id)
    const effective = getEffectiveUiConfig(
      entityType,
      entity.type,
      row?.config,
    )

    return [entity.sync_id, effective]
  }))
}

export async function loadStoredUiConfigsByEntitySyncIds(entities) {
  if (!entities?.length) return new Map()

  const {workspace_id} = await getNextUiContext()
  const syncIds = entities
    .map((entity) => entity.sync_id)
    .filter(Boolean)

  if (!syncIds.length) return new Map()

  const keys = syncIds.map((syncId) => [workspace_id, syncId])
  const rows = await db.next_ui_config
    .where('[workspace_id+entity_sync_id]')
    .anyOf(keys)
    .toArray()

  const rowMap = new Map(rows.map((row) => [row.entity_sync_id, row]))

  return new Map(entities.map((entity) => {
    const row = rowMap.get(entity.sync_id)
    return [entity.sync_id, row?.config ?? null]
  }))
}

export async function upsertUiConfig({
  entityType,
  entitySubtype,
  entitySyncId,
  patch,
}) {
  const {workspace_id, device_id} = await getNextUiContext()

  return db.transaction('rw', db.next_ui_config, async () => {
    const existing = await db.next_ui_config
      .where('[workspace_id+entity_sync_id]')
      .equals([workspace_id, entitySyncId])
      .first()

    const mergedConfig = {
      behavior: {
        ...(existing?.config?.behavior ?? {}),
        ...(patch?.behavior ?? {}),
      },
      layout: {
        ...(existing?.config?.layout ?? {}),
        ...(patch?.layout ?? {}),
      },
      appearance: {
        ...(existing?.config?.appearance ?? {}),
        ...(patch?.appearance ?? {}),
      },
    }

    const normalizedConfig = normalizeUiConfig(entityType, entitySubtype, mergedConfig)

    const row = {
      ...(existing?.id ? {id: existing.id} : {}),
      workspace_id,
      device_id,
      entity_type: entityType,
      entity_subtype: entitySubtype,
      entity_sync_id: entitySyncId,
      version: UI_CONFIG_VERSION,
      preset_id: existing?.preset_id ?? null,
      config: normalizedConfig,
      updated_at: Date.now(),
    }

    await db.next_ui_config.put(row)

    return getEffectiveUiConfig(entityType, entitySubtype, normalizedConfig)
  })
}

export async function deleteUiConfig({
  entityType,
  entitySyncId,
  entitySubtype,
}) {
  const {workspace_id} = await getNextUiContext()

  return db.transaction('rw', db.next_ui_config, async () => {
    const existing = await db.next_ui_config
      .where('[workspace_id+entity_sync_id]')
      .equals([workspace_id, entitySyncId])
      .first()

    if (existing?.id) {
      await db.next_ui_config.delete(existing.id)
    }

    return getEffectiveUiConfig(entityType, entitySubtype, null)
  })
}
