declare namespace Express {
  interface Request {
    user?: {
      userId: number
      email: string
      roleName: string
      roleId: number
    }
  }
}
