import React from 'react';
import ReactDOM from 'react-dom';
import Tree from '../../../packages/tree';
import treeData from '../mock/tree';

ReactDOM.render(<Tree data={treeData} />, document.getElementById('root'));