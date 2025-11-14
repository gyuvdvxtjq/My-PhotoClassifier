# github获取某个库图片的MCP

## 🛠️ 如何使用

### 1. 前提条件

您需要确保系统上安装了以下工具：

* **Node.js 和 npm/npx:** 用于运行脚本和执行命令行工具。
* **Git:** 如果您需要克隆或与 GitHub 仓库进行更复杂的交互。


### 2. 命令参数说明

| 环境变量/参数           | 示例值                                                                                 | 说明                              |
|:------------------|:------------------------------------------------------------------------------------|:--------------------------------|
| `GITHUB_FILE_URL` | `https://raw.githubusercontent.com/yincongcyincong/PhotoClassifier/main/class.json` | **必填。** json文件                  |
| `GITHUB_TOKEN`    | `xxx`                                                                               | **选填。** 您的 GitHub 个人访问令牌 (PAT)。 |


### 3. 配置格式
```
{
  "性感": [
    "https://raw.githubusercontent.com/yincongcyincong/PhotoClassifier/main/photos/%E6%80%A7%E6%84%9F/0.jpg",
  ],
  "JK": [
    "https://raw.githubusercontent.com/yincongcyincong/PhotoClassifier/main/photos/JK/0.jpg",
  ]
}

```

### 测试

```
npx @modelcontextprotocol/inspector \
 -e GITHUB_FILE_URL="https://raw.githubusercontent.com/yincongcyincong/PhotoClassifier/main/class.json?v=1" \
 -e GITHUB_TOKEN="xxx" \
 node src/index.js

```

使用 http://localhost:6274?MCP_PROXY_FULL_ADDRESS=http://localhost:6277/api/v1/inspector/github/

## 🔑 GitHub Token 获取

请参阅 [GitHub 官方文档](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token)
创建 PAT。**在权限 (Scopes) 中，必须勾选 `repo` 权限，以确保程序有权限向您的仓库写入文件。**

## 上传npx

```
npm init

修改package.json的bin

npm login
npm publish

npm cache clean --force
npx photoclassifier@latest
```