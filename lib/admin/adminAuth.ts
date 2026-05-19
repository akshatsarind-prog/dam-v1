export function isValidAdminPassword(request: Request): boolean {
  const configuredPassword = process.env.ADMIN_PASSWORD

  if (!configuredPassword) {
    return false
  }

  const providedPassword = request.headers.get('x-admin-password')
  return providedPassword === configuredPassword
}
