[![Build Status](https://secure.travis-ci.org/leizongmin/connect-limit-requests.png?branch=master)](http://travis-ci.org/leizongmin/connect-limit-requests)

connect-limit-requests
=====================

HTTP请求限制 **预防攻击者对HTTP服务的恶意攻击** connect中间件


## 安装

```bash
npm install connect-limit-requests
```


## 使用

```javascript
var connect = require('connect');
var limitRequests = require('connect-limit-requests');

var app = connect();

var options = {
  interval:   30000,
  limit:      100
};
app.use(limitRequests(options));
```

配置（可选）：

* {Boolean} **proxy**              是否来自代理服务器，如果是，代理服务器必须传递请求头 X-Real-IP
                                   请求头来指定客户端的IP，默认为 **false**
* {Number} **interval**            限制同一IP的请求数量时间间隔，默认为 **30,000ms**
* {Number} **limit**               限制同一IP的请求数量请求数量，默认为 **1000**
* {Number} **failureLimit**        限制同一IP的错误请求数量（非200和304响应），默认为 **50** ， **设置为0关闭此功能**
* {Number} **refreshInterval**     同一页面检测刷新时间间隔，默认为 **1000ms** ， **设置为0关闭此功能**
* {Number} **connections**         限制同已IP的连接数量，默认为 **100**
* {Function} **callback**          当被检查为恶意刷新时的回调函数， **默认返回HTTP 429 Too Many Requests**
                                   格式：  `function (code, req, res, next) {}`

回调函数第一个参数代码：

* 1 - **OVER_REQUEST_LIMIT**       超过请求数量限制
* 2 - **OVER_CONNECTION_LIMIT**    超过连接数量限制
* 3 - **OVER_REFRESH_LIMIT**       恶意刷新
* 4 - **OVER_FAILURE_LIMIT**       超过出错数量限制


## 说明

* 配置 **limit** 参数可限制某IP客户端的请求频率，需要配合 **interval** 参数，
  用户正常的浏览行为，是会短时间内发出多个请求的（如加载资源文件等）；同时正常的
  浏览行为不会持续发出多个请求；

* 配置 **connections** 参数可限制客户端发起的连接数量，但若服务器前端使用了 Nginx
  来做反向代理，或者用户多来自某一局域网，此功能可能会工作不正常，因此需要将此项
  设置为足够大的数字；

* 配置 **refreshInterval** 参数可限制客户端刷新某一相同页面的时间间隔，其内部是根据
  IP地址来识别客户端的，因此若存在与 **connections** 类似的情况，需要将其设置为
  0以关闭此功能；

* 配置 **failureLimit** 参数可限制客户端发出不正常的请求的数量（服务器没有返回200或304
  状态码的请求），可避免客户端实施诸如遍历目录、探测页面路径等行为；

* 配置 **callback** 参数可自定义客户端被限制时触发的动作，默认是直接返回
  "Too Many Requests" 信息；


## TODO

* **IP白名单** 可取消对指定IP地址（范围）的限制（必须）

* **用户黑名单** 始终对某IP地址（范围）的用户进行访问限制，无论其是否超过配额限制
  （可通过防火墙之类的限制，这个不是必须）

* **自动检查恶意客户端** 自动分析某IP地址的异常行为，并将其添加到黑名单
  （如果能检测出某异常IP，而不用分析其他正常的IP，可以减少很多内存占用，
  提高运行效率等）

* **多进程下的解决方案**


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