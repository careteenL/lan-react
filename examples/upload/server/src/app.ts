import express, { Request, Response, NextFunction } from 'express'
import path from 'path'
import fs from 'fs-extra'
import logger from 'morgan'
import cors from "cors"
import multiparty from 'multiparty'
import createError from 'http-errors'
import { INTERNAL_SERVER_ERROR } from 'http-status-codes'

const app = express()

const PUBLIC_DIR = path.resolve(__dirname, 'public')

app.use(logger('dev'))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(cors())
app.use(express.static(PUBLIC_DIR))

app.post('/upload', async (req: Request, res: Response, next: NextFunction) => {
  const form = new multiparty.Form()
  form.parse(req, async (err: any, fields, files) => {
    if (err) return next(err)
    const name = fields.name[0]
    const file = files.file[0]
    await fs.move(file.path, path.resolve(PUBLIC_DIR, name), { overwrite: true })
    res.json({
      success: true
    })
  })
})

app.use((_req: Request, _res: Response, next: NextFunction) => {
  next(createError(404))
})

app.use((error: any, _req: Request, res: Response, _next: NextFunction) => {
  res.status(error.status || INTERNAL_SERVER_ERROR)
  res.json({
    succuess: false,
    error,
  })
})

export default app
