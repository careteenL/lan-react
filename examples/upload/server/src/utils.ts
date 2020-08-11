import path from 'path'
import fs, { WriteStream } from 'fs-extra'

export const PUBLIC_DIR = path.resolve(__dirname, 'public')
export const TEMP_DIR = path.resolve(__dirname, 'temp')
const DEAFULT_SIZE = 1024 * 1024 * 10;

const getIndex = (str: string) => {
  const matched = str.match(/-(\d{1,})$/)
  return matched ? Number(matched[1]) : 0
}

const pipeStream = (filePath: string, ws: WriteStream) => new Promise((resolve, _reject) => {
  const rs = fs.createReadStream(filePath)
  rs.on('end', async () => {
    await fs.unlink(filePath)
    resolve()
  })
  rs.pipe(ws)
})

export const mergeChunks = async (fileName: string, size: number = DEAFULT_SIZE) => {
  const filePath = path.resolve(PUBLIC_DIR, fileName)
  const folderPath = path.resolve(TEMP_DIR, fileName)
  const folderFiles = await fs.readdir(folderPath)
  folderFiles.sort((a, b) => getIndex(a) - getIndex(b))
  await Promise.all(folderFiles.map((chunk: string, index: number) => pipeStream(
    path.resolve(folderPath, chunk),
    fs.createWriteStream(filePath, {
      start: index * size
    })
  )))
  await fs.rmdir(folderPath)
}
