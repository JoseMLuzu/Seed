export const passwordRequirements = [
  { label: 'Al menos 6 caracteres', test: (value: string) => value.length >= 6, error: 'La contraseña debe tener al menos 6 caracteres.' },
  { label: 'Una letra mayúscula', test: (value: string) => /[A-ZÁÉÍÓÚÑ]/.test(value), error: 'La contraseña debe incluir al menos una mayúscula.' },
  { label: 'Un número', test: (value: string) => /\d/.test(value), error: 'La contraseña debe incluir al menos un número.' },
];

export function passwordPolicyError(password: string) {
  return passwordRequirements.find(requirement => !requirement.test(password))?.error || '';
}
