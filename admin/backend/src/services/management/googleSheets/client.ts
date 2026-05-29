import { google } from 'googleapis'
import * as fs from 'fs'
import * as path from 'path'
import axios, { AxiosInstance } from 'axios'
import https from 'https'

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets']

export async function getGoogleSheetsClient() {
  const keyPath = path.join(process.cwd(), 'credentials', 'my-sheets-app-464416-eb4173ebac92.json')

  if (!fs.existsSync(keyPath)) {
    throw new Error(`Google Sheets credentials file not found at ${keyPath}`)
  }

  const keyFile = JSON.parse(fs.readFileSync(keyPath, 'utf-8'))

  const auth = new google.auth.JWT({
    email: keyFile.client_email,
    key: keyFile.private_key,
    scopes: SCOPES,
  })

  const sheets = google.sheets({ version: 'v4', auth })
  return { sheets, auth }
}

export async function getGoogleSheetsClientReadOnly() {
  const keyPath = path.join(process.cwd(), 'credentials', 'my-sheets-app-464416-eb4173ebac92.json')

  if (!fs.existsSync(keyPath)) {
    throw new Error(`Google Sheets credentials file not found at ${keyPath}`)
  }

  const keyFile = JSON.parse(fs.readFileSync(keyPath, 'utf-8'))

  const auth = new google.auth.JWT({
    email: keyFile.client_email,
    key: keyFile.private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  })

  const sheets = google.sheets({ version: 'v4', auth })
  return { sheets, auth }
}

export async function getHttpClient(): Promise<AxiosInstance> {
  const caBundlePath = path.join(process.cwd(), 'cacert.pem')
  const verify = fs.existsSync(caBundlePath) ? caBundlePath : false

  const httpClient = axios.create({
    timeout: 30000,
    httpsAgent: new https.Agent({
      rejectUnauthorized: verify !== false,
      ca: verify !== false && typeof verify === 'string' ? fs.readFileSync(verify) : undefined,
    }),
  })

  return httpClient
}
