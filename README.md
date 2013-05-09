[![Build Status](https://secure.travis-ci.org/leizongmin/connect-limit-requests.png?branch=master)](http://travis-ci.org/leizongmin/connect-limit-requests)

connect-limit-requests
=====================

HTTP请求限制 connect中间件


## 安装

```bash
npm install connect-limit-requests
```


## 使用

```javascript
var requestLimit = require('connect-limit-requests');

connect.use(requestLimit(options));
```

配置（可选）：

* {Boolean} **proxy**           是否来自代理服务器，如果是，代理服务器必须传递请求头 X-Real-IP
                                请求头来指定客户端的IP，默认为false
* {Number} **interval**         限制同一IP的请求数量时间间隔，默认为30,000ms
* {Number} **limit**            限制同一IP的请求数量请求数量，默认为1000
* {Number} **failureLimit**     限制同已IP的错误请求数量（非200和304响应），默认为50，设置为0关闭此功能
* {Number} **refreshInterval**  同一页面检测刷新时间间隔，默认为1000ms，设置为0关闭此功能
* {Number} **connections**      限制同已IP的连接数量，默认为100
* {Function} **callback**       当被检查为恶意刷新时的回调函数，默认返回HTTP 429 Too Many Requests
                                格式：  function (code, req, res, next) {}

回调函数第一个参数代码：

* 1 - **OVER_REQUEST_LIMIT**      超过请求数量限制
* 2 - **OVER_CONNECTION_LIMIT**   超过连接数量限制
* 3 - **OVER_REFRESH_LIMIT**      恶意刷新
* 4 - **OVER_FAILURE_LIMIT**      超过出错数量限制


## 授权

```
Copyright (c) 2013 Lei Zongmin(雷宗民) <leizongmin@gmail.com>
http://ucdok.com

The MIT License

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```