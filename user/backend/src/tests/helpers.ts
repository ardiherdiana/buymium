import jwt from 'jsonwebtoken'

const JWT_SECRET = 'test-secret-key-for-unit-tests-minimum-32-chars'
process.env.JWT_SECRET = JWT_SECRET
process.env.GOOGLE_CLIENT_ID = 'test-google-client-id'
process.env.FRONTEND_URL = 'http://localhost:3000'

export const makeUserToken = (userId = 1) =>
  jwt.sign({ userId, email: 'user@test.com', roleId: 2 }, JWT_SECRET, { expiresIn: '1d' })

export const makeAdminToken = (userId = 99) =>
  jwt.sign({ userId, email: 'admin@test.com', roleId: 1 }, JWT_SECRET, { expiresIn: '1d' })
