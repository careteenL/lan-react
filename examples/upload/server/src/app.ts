import express, { Request, Response, NextFunction } from 'express'
import path from 'path'
import fs from 'fs-extra'
import logger from 'morgan'
import cors from "cors"
import multiparty from 'multiparty'
import createError from 'http-errors'
import { INTERNAL_SERVER_ERROR } from 'http-status-codes'

import { mergeChunks, PUBLIC_DIR, TEMP_DIR } from './utils'

const app = express()

app.use(logger('dev'))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(cors())
app.use(express.static(PUBLIC_DIR))

app.post('/wholeuUpload', async (req: Request, res: Response, next: NextFunction) => {
  const form = new multiparty.Form()
  form.parse(req, async (err: any, fields, files) => {
    if (err) return next(err)
    const [name] = fields.name
    const [file] = files.file
    await fs.move(file.path, path.resolve(PUBLIC_DIR, name), { overwrite: true })
    res.json({
      code: 200,
      msg: 'success',
      data: true,
    })
  })
})

app.get('/verify/:fileName', async (req: Request, res: Response, _next: NextFunction) => {
  const { fileName } = req.params
  const filePath = path.resolve(PUBLIC_DIR, fileName)
  const existFile = await fs.pathExists(filePath)
  if (existFile) {
    res.json({
      code: 200,
      msg: 'success',
      data: {
        needUpload: false,
      },
    })
    return
  }
  const folderPath = path.resolve(TEMP_DIR, fileName)
  const existFolder = await fs.pathExists(folderPath)
  let uploadedList: any[] = []
  if (existFolder) {
    uploadedList = await fs.readdir(folderPath)
    uploadedList = await Promise.all(uploadedList.map(async (fileName: string) => {
      const stat = await fs.stat(path.resolve(folderPath, fileName))
      return {
        fileName,
        size: stat.size,
      }
    }))
  }
  res.json({
    code: 200,
    msg: 'success',
    data: {
      needUpload: true,
      uploadedList,
    }
  })
})

app.post('/partUpload/:fileName/:start/:chunkName', async (req: Request, res: Response, _next: NextFunction) => {
  const { fileName, chunkName, start } = req.params
  const folderPath = path.resolve(TEMP_DIR, fileName)
  const existFolder = await fs.pathExists(folderPath)
  if (!existFolder) {
    await fs.mkdirs(folderPath)
  }
  const filePath = path.resolve(folderPath, chunkName)
  const ws = fs.createWriteStream(filePath, {
    start: Number(start),
    flags: 'a',
  })
  req.on('end', () => {
    ws.close()
    res.json({
      code: 200,
      msg: 'success',
      data: true,
    })
  })
  req.on('error', () => {
    ws.close()
  })
  req.on('close', () => {
    ws.close()
  })
  req.pipe(ws)
})

app.get('/merge/:fileName', async (req: Request, res: Response, _next: NextFunction) => {
  const { fileName } = req.params
  try {
    await mergeChunks(fileName)
    res.json({
      code: 200,
      msg: 'success',
      data: true,
    })
  } catch (error) {
    res.json({
      code: 1,
      msg: 'error',
      data: false,
    })
  }
})

app.use((_req: Request, _res: Response, next: NextFunction) => {
  next(createError(404))
})

app.use((error: any, _req: Request, res: Response, _next: NextFunction) => {
  res.status(error.status || INTERNAL_SERVER_ERROR)
  res.json({
    code: 1,
    msg: 'error',
    data: error,
  })
})

export default app
