import React from 'react';
import './index.less';
import { TreeData } from '../typings';
import TreeNode from './tree-node';
interface Props {
  data: TreeData
}
interface State {
  data: TreeData
}
interface KeyNodeMap {
  [key: string]: TreeData
}
class Tree extends React.Component<Props, State> {
  keyNodeMap: KeyNodeMap;
  constructor(props: Props) {
    super(props);
    this.state = { data: this.props.data };
    this.buildKeyMap();
  }
  buildKeyMap = (): void => {
    let data = this.state.data;
    this.keyNodeMap = {};
    this.keyNodeMap[data.key] = data;
    if (data.children && data.children.length > 0) {
      this.walk(data.children, data);
    }

  }
  walk = (children: TreeData[], parent: TreeData): void => {
    children.forEach((item: TreeData) => {
      item.parent = parent;
      this.keyNodeMap[item.key] = item;
      if (item.children && item.children.length > 0) {
        this.walk(item.children, item);
      }
    });
  }
  onCollapse = (key: string) => {
    let data = this.keyNodeMap[key];
    if (data) {
      let { children } = data;
      if (children) {
        data.collapsed = !data.collapsed;
        data.children = data.children || [];
        this.setState({ data: this.state.data });
      } else { // 如果没有children属性，则说明儿子未加载，需要加载
        data.loading = true;
        this.setState({ data: this.state.data });
        setTimeout(() => {
          data.children = [
            {
              name: data.name + '的儿子1',
              key: `${data.key}-1`,
              type: 'folder',
              collapsed: true
            },
            {
              name: data.name + '的儿子2',
              key: `${data.key}-2`,
              type: 'folder',
              collapsed: true
            }
          ]
          data.loading = false;
          data.collapsed = false;
          this.buildKeyMap();
          this.setState({ data: this.state.data });
        }, 2000);
      }

    }
  }
  onCheck = (key: string) => {
    let data = this.keyNodeMap[key];
    if (data) {
      data.checked = !data.checked;
      if (data.checked) {
        this.checkChildren(data.children, true);
        this.checkParent(data.parent);
      } else {
        this.checkChildren(data.children, false);
        this.checkParent(data.parent);
      }
      this.setState({ data: this.state.data });
    }

  }
  checkParent = (parent: TreeData) => {
    while (parent) {
      parent.checked = parent.children.every((item: TreeData) => item.checked);
      parent = parent.parent;
    }
  }
  checkChildren = (children: TreeData[] = [], checked: boolean) => {
    children.forEach((item: TreeData) => {
      item.checked = checked;
      this.checkChildren(item.children, checked);
    });
  }
  render() {
    return (
      <div className="lan-tree">
        <div className="lan-tree-nodes">
          <TreeNode
            onCollapse={this.onCollapse}
            onCheck={this.onCheck}
            data={this.props.data}
          />
        </div>
      </div>
    )
  }
}
export default Tree;