# P0.1 — Aislamiento de cuentas

## Alcance

Este bloque separa el jardín invitado de cada cuenta y protege los cambios de sesión. No completa toda la fase P0: todavía faltan la cola de sincronización incremental, la resolución de conflictos, los registros de eliminación y la paginación de la nube.

No cambia el diseño de acceso, no activa Google/Apple, no modifica las políticas SQL ni los identificadores de firma iOS.

## Archivos y responsabilidades

| Archivo | Responsabilidad |
| --- | --- |
| `src/accountScope.ts` | Identidad inmutable del almacenamiento y vida útil cancelable de una sesión. |
| `src/components/AccountBoundary.tsx` | Resuelve Auth antes de abrir un jardín, invalida el anterior y monta una instancia nueva de la interfaz. |
| `src/appStorage.ts` | Preferencias vinculadas explícitamente a un espacio; conserva helpers globales para datos no personales. |
| `src/storage.ts` | Bases IndexedDB independientes, respaldo local versionado y escrituras ordenadas por espacio. |
| `src/supabaseSync.ts` | Propietario explícito, token capturado, filtros por usuario y cancelación en todas las operaciones. |
| `src/supabase.ts` | Cliente real; la lectura opcional de variables permite importar la lógica en pruebas Node sin configurar una cuenta. |
| `src/legacyRecovery.ts` | Reserva de recuperación de datos anteriores y fusión que conserva registros existentes. |
| `src/native/accountPrivacy.ts` | Serializa efectos nativos y descarta los pendientes de la identidad anterior. |
| `src/native/widget.ts`, `liveActivity.ts`, `notifications.ts` | Integran esa cola; permiten limpieza estricta al cambiar de identidad. |
| `src/App.tsx` | Usa el espacio explícito, separa borradores de autenticación del perfil e incorpora recuperación manual. |
| `src/accountIsolation.test.ts`, `src/supabaseSync.test.ts` | Regresiones de almacenamiento, sesiones, recuperación, cola nativa y transporte simulado. |
| `package.json`, `package-lock.json` | Ejecutan todos los tests e incluyen fake-indexeddb solo como dependencia de desarrollo. |

## Flujo de datos

1. `AccountBoundary` espera la sesión inicial. Un fallo de Auth muestra un error recuperable, no abre silenciosamente el jardín invitado.
2. Crea `AccountLease`: propietario fijo, identificador de montaje y AbortController. Renovar el token de la misma cuenta no cambia el propietario ni reinicia la interfaz.
3. Antes de mostrar el espacio, limpia recordatorios pendientes/entregados de Seeds, termina Live Activities compatibles y reemplaza el widget por un resumen neutro. La limpieza se ordena detrás del trabajo nativo que ya comenzó.
4. `AccountWorkspace` se monta con una clave de lease nueva. Se reinician búsquedas, selección, formularios, foco y estado React de la identidad anterior.
5. Preferencias y notas se leen únicamente desde el espacio elegido. Ninguna cuenta hereda las claves antiguas sin propietario ni el jardín invitado.
6. Un cambio persiste en ese mismo espacio. Antes de iniciar/cerrar sesión se intenta guardar; al desmontar se conserva la última colección en su propietario anterior.
7. Cada petición captura propietario, token y señal. Los headers mantienen el token capturado aunque el cliente Auth cambie de cuenta. RLS sigue siendo la autoridad del servidor.
8. Al cambiar de identidad, el lease anterior se revoca inmediatamente: se abortan solicitudes, se impiden etapas posteriores y se ignoran callbacks Realtime antiguos. Una petición que el servidor ya confirmó puede haber escrito, pero solo con el propietario y token originales.

## Formato de almacenamiento

- Invitado: `seed:v2:guest:…`
- Cuenta: `seed:v2:user:<userId codificado>:…`
- Base IndexedDB por espacio: `<prefijo>db`, versión 1; stores `notes` y `metadata`.
- Respaldo en localStorage: `<prefijo>notes`, objeto `{ revision, notes }`.
- Preferencias: por ejemplo `<prefijo>seed-planets`, `<prefijo>seed-account` y `<prefijo>seed-daily-intention-YYYY-MM-DD`.

La revisión local permite escoger la copia más reciente si IndexedDB falla y se guarda en el respaldo. No es una versión distribuida para resolver conflictos entre dispositivos. Las escrituras todavía reemplazan la colección completa; esa optimización corresponde al siguiente bloque.

`seed-pending-action` continúa siendo una clave global porque la escribe el puente nativo para abrir Hoy o crear una nota; no contiene texto de notas ni un perfil.

## Datos anteriores: recuperación explícita

Las claves antiguas (`seed-notes`, `seed-planets`, `seed-account`, etc.) y `seed-db` se conservan. No podemos deducir su propietario con seguridad.

Para recuperar notas y jardines: abrir **Ajustes → Cuenta y datos → Recuperar datos de la versión anterior**. Confirmar que pertenecen al usuario y elegir el destino al abrir previamente esa cuenta o el modo invitado. Si el destino es una cuenta, se advierte que podrán subirse a ella.

La recuperación conserva notas/jardines ya existentes con el mismo ID, incorpora anotaciones antiguas de foco y no copia el perfil ni preferencias personales de la versión anterior. `seed-legacy-recovery-owner-v2` reserva el destino confirmado: otros espacios no pueden reclamar esa copia desde esta función. Se puede reintentar en el mismo destino sin reemplazar registros existentes. Los originales no se borran.

El invitado tampoco se fusiona automáticamente al iniciar sesión. Un traslado intencional puede hacerse mediante exportación/importación con confirmación; una interfaz dedicada de fusión queda pendiente.

## Funciones importantes

- `accountScope`, `scopedStorageKey`: construyen nombres inequívocos; un usuario cuyo ID sea `guest` no colisiona con el invitado.
- `AccountLease.refresh`, `syncAccess`, `revoke`: renuevan credenciales de la misma identidad, capturan acceso para una operación y lo invalidan.
- `createAccountStorage`: devuelve helpers enlazados a un propietario, sin variable global de cuenta activa.
- `loadNotesFromDb`, `saveNotesToDb`: exigen un espacio; no admiten lecturas/escrituras implícitas de notas globales.
- `loadLegacyNotes`, `reserveLegacyRecovery`, `mergeLegacyGarden`: recuperación intencional, conservación del origen y fusión no destructiva.
- `runNativeAccountTask`, `invalidateNativeAccountTasks`: ordenan los efectos externos a React al cambiar de sesión.
- Las funciones de `supabaseSync` requieren `SyncAccess`; las subidas también exigen `OwnedSyncSnapshot.ownerId` coincidente. El cliente opcional permite pruebas aisladas sin una cuenta real.

## Validación y límites

Ejecutar `npm run lint`, `npm test` y `npm run build`. Los tests de IndexedDB usan una implementación en memoria; los tests de transporte no llaman a Supabase real. El test de lógica anterior se mantiene.

Comprobaciones manuales antes de ampliar la beta:

- Cuenta A → cuenta B → invitado → A: notas, jardines, perfil e intención no se mezclan.
- Cambiar de cuenta con una descarga en curso y recibir un evento anterior: no aparecen datos viejos en la nueva vista.
- Recuperar una copia antigua: requiere confirmación, conserva los originales y no la asigna después a otra cuenta.
- Simular fallo de cierre de sesión: se conserva el espacio actual y aparece el error.
- Cambiar de cuenta inmediatamente después de editar y volver: se conserva la última edición local.
- En iPhone real, verificar widget, recordatorios entregados/pendientes y Live Activities. En iOS sin ese plugin, la ausencia de Live Activities no bloquea el arranque.

Este aislamiento no cifra las bases ni protege contra una persona con acceso a los archivos del dispositivo o código malicioso en el mismo origen. Cerrar sesión conserva la copia privada local para volver a usarla al autenticarse; no es un borrado seguro del dispositivo.

La coordinación de escritura es por instancia JavaScript: todavía hay que definir conflictos entre varias pestañas de la misma cuenta y serialización entre procesos. No afirmar colaboración multiusuario, consistencia distribuida completa ni que los datos estén sincronizados solo porque se guardaron localmente.
