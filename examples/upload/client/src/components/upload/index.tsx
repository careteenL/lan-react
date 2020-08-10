import React, { ChangeEvent, useState } from 'react';

import { Row, Col, Input, Button, message } from 'antd';
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

enum UploadType {
  WHOLE,
  PART,
}
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

const Upload: React.FC<UploadProps> = (props) => {
  const {
    width = 300,
    accept = ['image/jpg', 'image/jpeg', 'image/png', 'image/gif', 'video/mp4']
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
      url: '/upload',
      method: 'POST',
      data: formData,
    })
    console.log('res', res);
    message.success('上传成功');
  }
  const partUpload = () => {
    // TODO
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

  return (
    <div>
      <Row>
        <Col span={12}>
          <Input type="file" accept={amendAccept(accept)}  style={{ width: width }} onChange={onFileChange} />
          <Button type="primary" onClick={() => onFileUpload(UploadType.WHOLE)}>小文件整体上传</Button>
          <Button type="primary" onClick={() => onFileUpload(UploadType.PART)}>大文件分片上传</Button>
        </Col>
        <Col span={12}>
          { isImage(currentFile?.type) ? <img src={currentFile?.dataUrl} style={{ width: 100 }} alt={currentFile?.file.name} /> : null }
        </Col>
      </Row>
      <Row>
        <Col>TODO progress</Col>
      </Row>
    </div>
  )
}
export default Upload;
