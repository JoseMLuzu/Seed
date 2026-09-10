# P0.2 — Cola incremental de sincronización

Seeds registra cada cambio autenticado en una cola local antes de enviarlo a Supabase. Editar una nota ya no activa la subida automática del jardín completo.

## Operaciones

La cola admite cuatro combinaciones:

- `note/upsert`: crear o actualizar una idea.
- `note/delete`: eliminar una idea.
- `planet/upsert`: crear o actualizar un jardín.
- `planet/delete`: eliminar un jardín y sus ideas remotas.

Las operaciones se guardan bajo `seed:v2:user:<id>:sync-queue-v1`. El modo invitado nunca crea una cola remota. Si una entidad cambia varias veces antes de sincronizarse, se conserva únicamente su intención más reciente.

## Flujo

1. React conserva el cambio en el almacenamiento local de la cuenta.
2. `diffSyncSnapshots` compara el estado anterior con el nuevo y produce operaciones ordenadas: jardines antes que sus ideas al crear; ideas antes que jardines al borrar.
3. `enqueueSyncMutations` reemplaza operaciones obsoletas de la misma entidad y persiste la cola de forma síncrona.
4. Después de 900 ms, `flushSyncQueue` toma la primera operación y llama al RPC autenticado `apply_seed_mutation` con su identificador y versión base.
5. Supabase bloquea el contador de esa cuenta, deduplica reintentos por `mutationId` y asigna una revisión monotónica. La operación local se retira únicamente después de recibir esa revisión. Una edición más reciente creada mientras la petición estaba en vuelo permanece pendiente y adopta la revisión confirmada como nueva base.
6. Ante un fallo, la operación sigue guardada y recibe un reintento exponencial con variación aleatoria, limitado a cinco minutos. Recuperar la conexión fuerza un nuevo intento.

El botón de Ajustes informa cuántos cambios faltan y permite forzar la sincronización. Al abrir una cuenta, Seeds envía primero la cola pendiente y luego reconcilia los datos locales con la nube.

## Garantías actuales

- La cola está aislada por cuenta.
- Dos disparadores de interfaz no procesan simultáneamente la misma cola.
- Cada `upsert` automático contiene una sola nota o jardín.
- Los borrados que fallan por falta de red permanecen pendientes.
- Los eventos Realtime recibidos no vuelven a entrar en la cola.
- Una respuesta antigua no elimina una edición local más reciente.
- El orden entre dispositivos lo determina una revisión del servidor, no la hora del teléfono.
- Un borrado confirmado crea un tombstone; la reconciliación descarta copias con una revisión anterior.
- Si la versión base no coincide, el servidor conserva la versión desplazada en `seed_sync_conflicts` antes de aplicar la última mutación recibida.

## Conflictos y retención

La política actual es **última mutación recibida por el servidor**, no “último reloj del dispositivo”. Una discrepancia de versión se marca como conflicto y conserva en el servidor tanto el valor desplazado como el entrante. La app informa que protegió un conflicto; una pantalla para inspeccionarlo o restaurarlo queda pendiente.

Los tombstones y registros idempotentes se conservan indefinidamente en esta etapa. No deben purgarse hasta registrar el cursor de cada dispositivo y definir qué ocurre con clientes que superen la ventana de retención.

## Límites pendientes

- Falta una interfaz para consultar y restaurar versiones archivadas en `seed_sync_conflicts`.
- La primera descarga y los tombstones todavía se solicitan completos; falta paginación y descarga por cursor.
- La caché local de notas aún escribe snapshots completos aunque el transporte remoto sea incremental.
- La cola usa almacenamiento local compactado; aún falta coordinación entre varias pestañas o procesos de la misma cuenta.
- La migración `20260909000100_versioned_sync_and_tombstones.sql` debe estar aplicada antes de ejecutar esta versión de la app contra Supabase.

## Validación

Ejecutar:

```bash
npm run lint
npm test
npm run build
```

Antes de ampliar la beta, comprobar manualmente en dos clientes:

- Crear y editar offline, cerrar la app, volver a abrir y reconectar.
- Editar varias veces la misma idea y confirmar una sola intención pendiente.
- Eliminar una idea y un jardín sin conexión y confirmar su envío posterior.
- Editar mientras una petición está en curso y confirmar que la versión nueva permanece en cola.
- Cambiar entre cuentas y verificar que cada una conserva solo sus operaciones.
