import React, { ChangeEvent, useState } from 'react';

import { Row, Col, Input, Button, message, Progress, Table } from 'antd';
import { request } from '../../utils/request';

interface UploadProps {
  width?: number;
  accept?: string[] | string;
}

interface CurrentFile {
  file: File;
  dataUrl?: string;
  type: string;
}

interface Part {
  chunk: Blob;
  size: number;
  fileName?: string;
  chunkName?: string;
  loaded?: number;
  percent?: number;
  xhr?: XMLHttpRequest;
}

interface Uploaded {
  fileName: string;
  size: number;
}

enum UploadType {
  WHOLE,
  PART,
}

enum UploadStatus {
  INIT,
  UPLOADING,
  PAUSE,
}

const DEAFULT_SIZE = 1024 * 1024 * 100;

const isImage = (type: string = ''): boolean => type.includes('image')

const checkSize = (size: number = 0, maxSize: number = 2 * 1024 * 1024 * 1024): boolean => {
  if (size > maxSize) {
    message.error(`文件大小不能超过2G`)
    return false
  }
  return true
}

const amendAccept = (accept: UploadProps['accept'], sep: string = ','): string => {
  if (Array.isArray(accept)) return accept.join(sep)
  return accept as string
}

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

const Upload: React.FC<UploadProps> = (props) => {
  const {
    width = 300,
    accept = ['image/jpg', 'image/jpeg', 'image/png', 'image/gif', 'video/mp4']
  } = props;

  const [currentFile, setCurrentFile] = useState<CurrentFile>();
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>(UploadStatus.INIT);
  const [hashPercent, setHashPercent] = useState<number>(0);
  const [totalPercent, setTotalPercent] = useState<number>(0);
  const [partList, setPartList] = useState<Part[]>([]);
  const [fileName, setFileName] = useState<string>('')

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
        console.log(file)
      });
      reader.readAsDataURL(file);
    }
  }

  const wholeUpload = async () => {
    const formData = new FormData()
    formData.append('file', currentFile?.file as File)
    formData.append('name', currentFile?.file.name as string)
    const res = await request({
      url: '/wholeuUpload',
      method: 'POST',
      data: formData,
    })
    console.log('res', res);
    if (res.code === 200) {
      message.success('上传成功');
    } else {
      message.error('上传失败，请重新上传~');
    }
  }

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
      setXhr: (xhr: XMLHttpRequest) => {
        part.xhr = xhr;
      },
      onProgress: (event: ProgressEvent) => {
        part.percent = Number(((part.loaded! + event.loaded) / part.chunk.size * 100).toFixed(2));
        console.log('part percent: ', part.percent)
        setPartList([...partList])
        setTotalPercent(partList.length > 0 
          ? partList.reduce((memo: number, curr: Part) => memo + curr.percent!, 0) / partList.length
          : 0)
      },
      data: part.chunk.slice(part.loaded),
    }))
  }

  const reset = () => {
    setTimeout(() => {
      setUploadStatus(UploadStatus.INIT)
      setHashPercent(0)
      setTotalPercent(0)
      setPartList([])
      setFileName('')
    }, 2000)
  }

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
      case UploadType.PART:
        partUpload()
        break;
    }
  }

  const onFilePause = () => {
    partList.forEach((part: Part) => part.xhr && part.xhr.abort())
    setUploadStatus(UploadStatus.PAUSE)
  }

  const onFileResume = async () => {
    await uploadParts(partList, fileName)
    setUploadStatus(UploadStatus.UPLOADING)
  }

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

  // const totalPercent = partList.length > 0 
  //   ? partList.reduce((memo: number, curr: Part) => memo + curr.percent!, 0) / partList.length
  //   : 0

  return (
    <div>
      <Row>
        <Col span={12}>
          <Input type="file" accept={amendAccept(accept)}  style={{ width: width }} onChange={onFileChange} />
          <Button type="primary" onClick={() => onFileUpload(UploadType.WHOLE)}>小文件整体上传</Button>
        </Col>
        <Col span={12}>
          { isImage(currentFile?.type) ? <img src={currentFile?.dataUrl} style={{ width: 100 }} alt={currentFile?.file.name} /> : null }
        </Col>
      </Row>
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
    </div>
  )
}
export default Upload;
