export function isOperatorOnly(roleNames: string[]): boolean {
  if (!roleNames.length) return false;
  return roleNames.every((name) => name === "ATTENDANCE_OPERATOR" || name === "FOOD_OPERATOR");
}

export function isContentEditorOnly(roleNames: string[]): boolean {
  return roleNames.length > 0 && roleNames.every((name) => name === "CONTENT_EDITOR");
}

export function isDelegateAffairsOnly(roleNames: string[]): boolean {
  return roleNames.length > 0 && roleNames.every((name) => name === "DELEGATE_AFFAIRS");
}

export function isViewerOnly(roleNames: string[]): boolean {
  return roleNames.length > 0 && roleNames.every((name) => name === "VIEWER");
}

export function hasFullAdminRole(roleNames: string[]): boolean {
  return roleNames.some((role) =>
    role === "SUPER_ADMIN" || role === "ADMIN" || role === "PAYMENT_ADMIN" || role === "REGISTRATION_ADMIN",
  );
}
