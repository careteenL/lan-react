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
