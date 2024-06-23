# B站空降助手服务端

B站空降助手是一个帮你跳过视频中恰饭部分的浏览器插件。本项目是插件的服务端代码，移植自YouTube的[Sponsor Block](https://github.com/ajayyy/SponsorBlockServer)。更详细的展示和安装请参考 https://github.com/HanYaodong/BilibiliSponsorBlock。

本项目并没有对docker部署进行测试。

本项目（包括此文档）正在开发中，更多功能敬请期待。

# 客户端

浏览器插件客户端的项目地址: https://github.com/HanYaodong/BilibiliSponsorBlock

# 构建项目

0.  安装node，git，npm，熟悉命令行工具。

1.  执行 `npm install` 安装依赖。

2.  将 `config.json.example` 重命名为 `config.json`，并且调整里面的参数。记得删除所有的注释。

    如果您想要链接postgres数据库，需要在`config.json`文件中配置数据库地址；如果没有配置数据库，那么将会在`database`文件夹中自动创建一个sqlite数据库。

3.  执行 `npm run test` 运行所有测试，执行 `npm run start` 启动项目。

# 开发

使用命令 `npm run dev` 启动服务，可以在项目文件发生变化的时候自动重启服务。

# API 文档

移植部分的代码暂时没有接口文档，可以暂时参考[原项目文档](https://wiki.sponsor.ajay.app/index.php/API_Docs)

# 协议

本项目遵循 AGPL-3.0 开源协议。