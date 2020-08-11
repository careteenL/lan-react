import React from 'react';
import Upload from './components/Upload';
import 'antd/dist/antd.css'

const App = () => {
  return (
    <div className="app">
      <Upload accept={[]} />
    </div>
  )
}

export default App;
