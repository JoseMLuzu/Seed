/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export function formatAuthError(message: string) {
  if (message.toLowerCase().includes("email rate limit exceeded")) {
    return "Se han solicitado demasiados correos. Espera unos minutos antes de volver a intentarlo.";
  }
  if (message.toLowerCase().includes("invalid login credentials"))
    return "El correo o la contraseña no son correctos.";
  if (message.toLowerCase().includes("email not confirmed"))
    return "Confirma tu correo antes de entrar. Revisa también la carpeta de spam.";
  if (message.toLowerCase().includes("user already registered"))
    return "Ya existe una cuenta con este correo. Puedes iniciar sesión.";

  return message;
}
