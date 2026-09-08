# Autenticación de Seeds

Seeds usa Supabase Auth con correo y contraseña. El cliente utiliza PKCE, conserva la sesión y acepta enlaces de confirmación y recuperación tanto en web como en la app iOS.

## Variables locales

Crea `.env.local` (no se versiona) con las credenciales públicas del proyecto:

```bash
VITE_SUPABASE_URL="https://PROJECT_REF.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="sb_publishable_..."
```

La clave `service_role` nunca debe incluirse en el frontend ni en una variable `VITE_*`.

## Supabase Dashboard

En **Authentication > URL Configuration** configura la URL pública de producción como `Site URL` y agrega estas Redirect URLs:

- `https://TU_DOMINIO/?auth=confirmation`
- `https://TU_DOMINIO/?auth=recovery`
- `http://localhost:3000/**` para desarrollo
- `http://127.0.0.1:3000/**` para desarrollo
- `seed://auth/**` para iOS

En **Authentication > Providers > Email** habilita Email y decide si el proyecto exigirá confirmación de correo. Si está habilitada, el usuario no entra hasta abrir el enlace recibido.

La configuración local versionada exige confirmación de correo y contraseñas con letras y números para aproximarse al comportamiento esperado en producción.

## Flujo

1. El registro envía al correo de confirmación de vuelta a `confirmation`.
2. “¿Olvidaste tu contraseña?” llama a `resetPasswordForEmail` con el destino `recovery`.
3. Web deja que Supabase intercambie automáticamente el código PKCE.
4. iOS abre el esquema `seed://`; `AppDelegate` entrega el enlace al cliente web y este intercambia el código.
5. El evento `PASSWORD_RECOVERY` muestra el formulario para elegir una contraseña nueva.
6. `updateUser` guarda la contraseña y abre el jardín de esa cuenta.

Antes de producción, prueba registro, confirmación y recuperación desde un dispositivo físico. Los enlaces deben abrir Seeds y no crear una semilla por accidente.

Referencia: [Supabase Native Mobile Deep Linking](https://supabase.com/docs/guides/auth/native-mobile-deep-linking).
