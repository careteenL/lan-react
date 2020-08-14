## 如何实现类似于百度网盘大文件的断点续传

![cover](./assets/cover.jpg)

### 目录

- [背景](#背景)
- [实现小文件整体上传](#实现小文件整体上传)
  - [搭建前端环境](#搭建前端环境)
  - [搭建服务端环境](#搭建服务端环境)
- [如何实现大文件分片上传](#如何实现大文件分片上传)
  - [客户端实现分片](#客户端实现分片)
  - [客户端计算hash](#客户端计算hash)
  - [客户端上传分片](#客户端上传分片)
  - [服务端实现校验接口](#服务端实现校验接口)
  - [服务端实现分片上传接口](#服务端实现分片上传接口)
  - [服务端实现合并接口](#服务端实现合并接口)
  - [客户端实现暂停/恢复功能](#客户端实现暂停/恢复功能)
  - [客户端实现进度条功能](#客户端实现进度条功能)
  - [客户端实现文件秒传](#客户端实现文件秒传)
  - [bingo](#bingo)
- [总结](#总结)

### 背景

工作中如果有负责开放平台，那么往往会有上传文件的诉求。一般10M内大小的图片，我们能通过一个上传接口即可，但如果文件大小超过100M或者1G甚至更大，通过一个接口在人机交互上显然不友好，期望为用户提供进度条，实时告知上传进度；而且用户可以选择暂停，比如断网或上传了错误文件，用户也能随时恢复上传；若用户重复上传相同文件时，系统能提示秒传成功。也就是实现类似于百度网盘的上传功能。

- 小文件整体上传效果图
![whole-upload](./assets/whole-upload.gif)

- 大文件分片上传效果图
![part-upload](./assets/part-upload.gif)

下面将从零搭建前端和服务端，实现小文件上传再循序渐进到上传大文件。

技术栈主要是前端：`React、AntD、Typescript`；服务端：`TS-Node、Express...`。

> 文章首发于[@lan-react/upload](https://github.com/careteenL/lan-react/tree/master/packages/upload)，转载请注明来源。[客户端代码存放](https://github.com/careteenL/lan-react/tree/master/examples/upload/client)、[服务端代码存放](https://github.com/careteenL/lan-react/tree/master/examples/upload/server)。

### 实现小文件整体上传

#### 搭建前端环境

通过`create-react-app --template typescript`创建项目

引入antd`yarn add antd`然后`yarn start`运行项目

编写上传的组件
```tsx
import React, { ChangeEvent, useState, useEffect } from 'react';
import { Row, Col, Input } from 'antd';
interface UploadProps {
  width?: number;
}
interface CurrentFile {
  file: File;
  dataUrl?: string;
  type?: string;
}
const isImage = (type: string = ''): boolean => type.includes('image');
const Upload: React.FC<UploadProps> = (props) => {
  const {
    width = 300,
  } = props;
  const [currentFile, setCurrentFile] = useState<CurrentFile>();
  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file: File = event.target.files![0];
    if (file) {
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        setCurrentFile({
          file: file,
          dataUrl: reader.result as string,
          type: file.type,
        })
      });
      reader.readAsDataURL(file);
    }
  }
  return (
    <div>
      <Input type="file" style={{ width: width }} onChange={onFileChange} />
      { isImage(currentFile?.type) ? <img src={currentFile?.dataUrl} style={{ width: 100 }} alt={currentFile?.file.name} /> : null }
    </div>
  )
}
export default Upload;
```
小文件上传使用`FormData`

```diff
return (
  <div>
    <Input type="file" style={{ width: width }} onChange={onFileChange} />
+    <Button type="primary" onClick={() => onFileUpload(UploadType.WHOLE)}>小文件整体上传</Button>
  </div>
)
```

编写一个按钮然后处理上传
```tsx
// 上传类型
enum UploadType {
  WHOLE,
  PART,
}
// 大小检测
const checkSize = (size: number = 0, maxSize: number = 2 * 1024 * 1024 * 1024): boolean => {
  if (size > maxSize) {
    message.error(`文件大小不能超过2G`)
    return false
  }
  return true
}
const onFileUpload = (type: UploadType = UploadType.WHOLE) => {
  if (!currentFile?.file) {
    message.error('请选择文件~')
    return
  }
  if (!checkSize(currentFile?.file?.size)) return
  switch (type) {
    case UploadType.WHOLE:
      wholeUpload();
      break;
  }
}
// 整体上传
const wholeUpload = async () => {
  const formData = new FormData()
  formData.append('file', currentFile?.file as File)
  formData.append('name', currentFile?.file.name as string)
  const res = await request({
    url: '/wholeUpload',
    method: 'POST',
    data: formData,
  })
  message.success('上传成功');
}
```

然后简单封装下request
```ts
export interface Config {
  baseUrl?: string;
  url?: string;
  method?: string;
  headers?: any;
  data?: any;
}
export const request = (conf: Config): Promise<any> => {
  const config: Config = {
    method: 'GET',
    baseUrl: 'http://localhost:8000',
    headers: {},
    data: {},
    ...conf
  }
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(config.method as string, `${config.baseUrl}${config.url}`);
    for (const key in config.headers) {
      if (Object.prototype.hasOwnProperty.call(config.headers, key)) {
        const value = config.headers[key];
        xhr.setRequestHeader(key, value);
      }
    }
    xhr.responseType = 'json';
    xhr.onreadystatechange = () => {
      if (xhr.readyState === 4) {
        if (xhr.status === 200) {
          resolve(xhr.response);
        } else {
          reject(xhr.response);
        }
      }
    }
    xhr.send(config.data);
  })
}
```

#### 搭建服务端环境

使用`nodemon`和`ts-node`
```json
"scripts": {
  "dev": "cross-env PORT=8000 nodemon --exec ts-node --files ./src/www.ts"
},
```

借助`http`模块起服务编写`./src/www.ts`
```ts
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
```

然后编写`app.ts`
```ts
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
```

将文件存放到本地，即服务端项目根目录的`public`目录。

然后启动服务`npm run dev`

再如下操作，实现上传小文件。
![whole-upload](./assets/whole-upload.gif)

接下来将实现大文件的分片上传

### 如何实现大文件分片上传

大文件分片上传的思路

- 客户端将大文件进行分割。（这里粒度为10M，分割后文件按`fileName-${index}`进行排序以便服务端合并）
- 为了实现秒传功能，需要对文件内容计算出hash值。（计算hash比较耗时，借助worker实现，并提供进度条）
- 客户端对分割后的小文件依次调用接口上传。
- 服务端提供上传接口。（将所有小文件存放到临时目录）
- 客户端上传所有分片文件后，调用请求合并的接口。
- 服务端提供合并接口。（按上述已排序的文件名进行合并，合并成大文件后存放本地）
- 客户端提供暂停/恢复功能。（暂停即调用`xhr.abort()`，恢复即重新上传）
- 特别的：在上传之前客户端会调用校验接口。（得知文件是否已上传？文件上传了哪一部分？）
- 服务端提供校验接口。（根据文件名在临时目录下读取分片，如果有则将分片信息返回客户端）
- 客户端根据返回内容进行处理。（有成品文件即为秒传、有分片文件则只上传剩余部分）
- 上传完毕

上述大致实现思路，下面将介绍实现细节和注意点。

#### 客户端实现分片

```diff
const onFileUpload = (type: UploadType = UploadType.WHOLE) => {
  // ...
  switch (type) {
    case UploadType.WHOLE:
      wholeUpload();
      break;
+    case UploadType.PART:
+      partUpload()
+      break;
  }
}
```

```tsx
interface Part {
  chunk: Blob;
  size: number;
  fileName?: string;
  chunkName?: string;
  loaded?: number;
  percent?: number;
  xhr?: XMLHttpRequest;
}
const partUpload = async () => {
  setUploadStatus(UploadStatus.UPLOADING);
  // 1. 对文件进行分片
  // 2. 根据分片计算文件hash
  // 3. 分片上传
  const partList = createChunks(currentFile?.file as File);
  const fileHash = await generateHash(partList);
  console.log(fileHash, 'fileHash');
  const lastDotIdx = currentFile?.file.name.lastIndexOf('.');
  const extName = currentFile?.file.name.slice(lastDotIdx);
  const fileName = `${fileHash}${extName}`;
  partList.forEach((part: Part, index: number) => {
    part.fileName = fileName;
    part.chunkName = `${fileName}-${index}`;
    part.loaded = 0;
    part.percent = 0;
  })
  setFileName(fileName);
  setPartList(partList);
  await uploadParts(partList, fileName)
}
```

再依次实现`createChunks`和`generateHash`两个核心方法

```tsx
const createChunks = (file: File, size: number = DEAFULT_SIZE): Part[] => {
  let current: number = 0;
  const partList: Part[] = [];
  while (current < file.size) {
    const chunk: Blob = file.slice(current, current + size);
    partList.push({
      chunk,
      size: chunk.size,
    })
    current += size
  }
  return partList;
}
```

#### 客户端计算hash

```tsx
const generateHash = (partList: Part[]): Promise<any> => {
  return new Promise((resolve, reject) => {
    const worker = new Worker('/generateHash.js');
    worker.postMessage({ partList });
    worker.onmessage = (event) => {
      const { percent, hash } = event.data;
      setHashPercent(percent);
      if (hash) {
        resolve(hash);
      }
    }
    worker.onerror = error => {
      reject(error);
    }
  })
}
```

主要借助`Worker`在`public`下新建`generateHash.js`文件
```js
self.importScripts('https://cdn.bootcss.com/spark-md5/3.0.0/spark-md5.js');
self.onmessage = async (event) => {
  const { partList } = event.data;
  const spark = new self.SparkMD5.ArrayBuffer();
  let percent = 0;
  const perSize = 100 / partList.length;
  const buffers = await Promise.all(partList.map(({ chunk }) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsArrayBuffer(chunk);
    reader.onload = (e) => {
      percent += perSize;
      self.postMessage({ percent: Number(percent.toFixed(2)) });
      resolve(e.target.result);
    }
  })));
  buffers.forEach(buffer => spark.append(buffer));
  self.postMessage({ percent: 100, hash: spark.end() });
  self.close();
}
```

将每一个分片的计算进度`postMessage`给`generateHash`，然后实时同步进度`setHashPercent`

#### 客户端上传分片

```tsx
const uploadParts = async (partList: Part[], fileName: string) => {
  const res = await request({
    url: `/verify/${fileName}`,
  })
  if (res.code === 200) {
    if (!res.data.needUpload) {
      message.success('秒传成功');
      setPartList(partList.map((part: Part) => ({
        ...part,
        loaded: DEAFULT_SIZE,
        percent: 100,
      })))
      reset()
      return
    }
    try {
      const { uploadedList } = res.data
      const requestList = createRequestList(partList, uploadedList, fileName);
      const partsRes = await Promise.all(requestList);
      if (partsRes.every(item => item.code === 200)) {
        const mergeRes = await request({
          url: `/merge/${fileName}`,
        })
        if (mergeRes.code === 200) {
          message.success('上传成功');
          reset()
        } else {
          message.error('上传失败，请稍后重试~');
        }
      } else {
        message.error('上传失败，请稍后重试~');
      }
    } catch (error) {
      message.error('上传失败或暂停');
      console.error(error);
    }
  }
}
```

- 在上传之前客户端会调用校验接口。（得知文件是否已上传？文件上传了哪一部分？）
- 客户端对分割后的小文件依次调用接口上传。
- 客户端上传所有分片文件后，调用请求合并的接口。

#### 服务端实现校验接口

```ts
export const PUBLIC_DIR = path.resolve(__dirname, 'public')
export const TEMP_DIR = path.resolve(__dirname, 'temp')
const DEAFULT_SIZE = 1024 * 1024 * 10;
// ...
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
```

#### 服务端实现分片上传接口

```ts
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
```
- `fileName` 根据文件名创建临时目录存放分片文件
- `chunkName` 分片名，命名格式为`fileName-${index}`
- `start` 记录分片上传了多少

#### 服务端实现合并接口
```ts
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
```

与客户端相对应，合并规则与分割规则相反。
```ts
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
```
使用流而非直接写文件的方式

#### 客户端实现暂停/恢复功能

```tsx
<Row>
  <Col span={24}>
    {
      uploadStatus === UploadStatus.INIT && <Button type="primary" onClick={() => onFileUpload(UploadType.PART)}>大文件分片上传</Button>
    }
    {
      uploadStatus === UploadStatus.UPLOADING && <Button type="primary" onClick={() => onFilePause()}>暂停</Button>
    }
    {
      uploadStatus === UploadStatus.PAUSE && <Button type="primary" onClick={() => onFileResume()}>恢复</Button>
    }
  </Col>
</Row>
```
实现暂停即调用`xhr.abort`方法，需要先在`request.ts`中为其提供可挂载
```tsx
// request.ts
if (config.setXhr) {
  config.setXhr(xhr);
}
// upload.tsx
const onFilePause = () => {
  partList.forEach((part: Part) => part.xhr && part.xhr.abort())
  setUploadStatus(UploadStatus.PAUSE)
}
```

在此之前还需完善`createRequestList`方法
```tsx
const createRequestList = (partList: Part[], uploadedList: Uploaded[], fileName: string): Promise<any>[] => {
  return partList.filter((part: Part) => {
    const uploadedFile = uploadedList.find(item => item.fileName === part.chunkName);
    if (!uploadedFile) { // 此chunk还没上传过
      part.loaded = 0;
      part.percent = 0;
      return true;
    }
    if (uploadedFile.size < part.chunk.size) { // 此chunk上传了一部分
      part.loaded = uploadedFile.size;
      part.percent = Number((part.loaded / part.chunk.size * 100).toFixed(2));
      return true;
    }
    // 上传过了
    return false;
  }).map((part: Part) => request({
    url: `/partUpload/${fileName}/${part.loaded}/${part.chunkName}`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
    },
    setXhr: (xhr: XMLHttpRequest) => { // +挂载
      part.xhr = xhr;
    },
    onProgress: (event: ProgressEvent) => { // +进度条
      part.percent = Number(((part.loaded! + event.loaded) / part.chunk.size * 100).toFixed(2));
      console.log('part percent: ', part.percent)
      setPartList([...partList])
    },
    data: part.chunk.slice(part.loaded),
  }))
}
```

再实现恢复功能，即重新请求一次
```tsx
const onFileResume = async () => {
  await uploadParts(partList, fileName)
  setUploadStatus(UploadStatus.UPLOADING)
}
```

#### 客户端实现进度条功能

如上面的方法`createRequestList`代码，在`onProgress`中实时获取到上传进度
```tsx
const columns = [
  {
    title: '分片名',
    dataIndex: 'chunkName',
    key: 'chunkName',
    width: '20%',
  },
  {
    title: '进度条',
    dataIndex: 'percent',
    key: 'percent',
    width: '80%',
    render: (value: number) => {
      return <Progress percent={value} />
    }
  }
]

const totalPercent = partList.length > 0 
  ? partList.reduce((memo: number, curr: Part) => memo + curr.percent!, 0) / partList.length
  : 0
{ uploadStatus !== UploadStatus.INIT ? (
  <>
    <Row>
      <Col span={4}>
        Hash进度条
      </Col>
      <Col>
        <Progress percent={hashPercent} />
      </Col>
    </Row>
    <Row>
      <Col span={4}>
        Total进度条
      </Col>
      <Col>
        <Progress percent={totalPercent} />
      </Col>
    </Row>
    <Table 
      columns={columns}
      dataSource={partList}
      rowKey={row => row.chunkName as string}
    />
  </>
) : null }
```

#### 客户端实现文件秒传

在上面`uploadParts`方法中已经实现
```tsx
const uploadParts = async (partList: Part[], fileName: string) => {
  const res = await request({
    url: `/verify/${fileName}`,
  })
  if (res.code === 200) {
    if (!res.data.needUpload) {
      message.success('秒传成功');
      setPartList(partList.map((part: Part) => ({
        ...part,
        loaded: DEAFULT_SIZE,
        percent: 100,
      })))
      reset()
      return
    }
    // ...
  }
}
```

#### bingo

效果图如下

![part-upload](./assets/part-upload.gif)

### 总结

- 小文件上传使用[FormData](https://developer.mozilla.org/zh-CN/docs/Web/API/FormData)，大文件上传设置`'Content-Type': 'application/octet-stream'`。`FormData`可携带参数，`octet-stream`参数可设置在url中。
```ts
formData.append('file', currentFile?.file as File)
formData.append('name', currentFile?.file.name as string)

request({ url: `/partUpload/${fileName}/${part.loaded}/${part.chunkName}` })
```

- 由于[File](https://developer.mozilla.org/zh-CN/docs/Web/API/File)继承自`Blob`，客户端可使用[Blob.slice](https://developer.mozilla.org/zh-CN/docs/Web/API/Blob/slice)对大文件进行分割；服务端对分片文件存储，提供合并接口按切割顺序进行合并（使用`createWriteStream/createReadStream`）。

- 为了实现秒传功能，需要对文件进行唯一标识，服务端校验为已上传文件直接返回成功和访问地址。
  - 使用[Worker](https://developer.mozilla.org/zh-CN/docs/Web/API/Worker)创建后台任务计算大文件唯一标识，避免页面卡死。
  - 使用[Spark-md5](https://github.com/satazor/js-spark-md5)计算文件唯一标识`MD5`

- 提供进度条功能
  - 计算`MD5`时可借助`Worker.postMessage`按分片粒度通知前端计算进度
  - 上传分片可借助[xhr.upload.onprogress](https://developer.mozilla.org/zh-CN/docs/Web/API/XMLHttpRequest/upload)实时通知前端上传进度
  - 前端借助`Antd-Progress/Table`展示进度条

- 提供暂停/恢复功能
  - 暂停借助[xhr.abort()](https://developer.mozilla.org/zh-CN/docs/Web/API/XMLHttpRequest/abort)终止请求
  - 重新上传获取上传情况，再只上传未上传部分。在服务端读取上传分片情况，客户端上传时再次借助`Blob.slice(part.loaded)`。服务端存储时按`fs.createWriteStream(filePath, { start: Number(start), flags: 'a' })`进行追加文件。