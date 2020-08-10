import app from './app'
import http from 'http'

const port = process.env.PORT || 8000
const server = http.createServer(app)

const onError = (error: any) => {
  console.error(error)
}
const onListening = () => {
  console.log(`Listening on port ${port}`)
}

server.listen(port)
server.on('error', onError)
server.on('listening', onListening)
