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
        console.log(file)
      });
      reader.readAsDataURL(file);
    }
  }

  return (
    <div>
      <Input type="file" style={{ width: width }} onChange={onFileChange} />
      {/* <Row>
        <Col span={12}>
          <Input type="file" style={{ width: width }} onChange={onFileChange} />
        </Col>
        <Col span={12}>
          aa
        </Col>
      </Row> */}
    </div>
  )
}
export default Upload;
