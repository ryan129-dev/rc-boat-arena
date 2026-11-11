# 晴湾 · Sunny Cove

基于 Three.js / WebGL2 的桃花心木经典游艇观赏页。只展示 Riva Aquarama、开阔水面和天空倒影，打磨船体材质、尾流与镜头。取消船型切换、山岸、植被和码头，不再后台下载场景陈设。

首页 `/` 为晴湾；`/cove/`、`/swamp/` 和生产 `/library/` 兼容旧链接并返回首页。素材工作台仅供本地开发。

## 运行与检查

需要 Node.js 22 或更新版本，以及 `package.json` 指定的 pnpm 版本。

```sh
corepack pnpm install --frozen-lockfile
pnpm dev
```

本地入口：<http://127.0.0.1:5177/>。本地素材工作台：<http://127.0.0.1:5177/library/>。

```sh
pnpm check:cove         # 连续巡游、闭环、时间步长与独立导航兼容
pnpm check:viewing      # 横竖屏完整船体构图、镜头平滑与水声
pnpm check:contact      # 船水浮态、尾迹、暂停与独立释放
pnpm check:assets       # 请求去重、取消、缓存、资源释放与像素预算
pnpm check:tools        # 发布失败时不留下半套模型/清单
pnpm check:delivery     # GLB、来源、单船清单、映射与250 KB模型预算
pnpm build             # 首页和白名单资源输出到 dist/
pnpm check:routes      # 旧入口兼容、路径前缀、模型MIME与发布白名单
pnpm check:bundle      # 单入口、共享引擎与4 MB发布预算
pnpm serve             # 本地预览构建产物
```

开发服务下的 `/tools/checks/cove/startup-browser.html` 检查首帧、失败和重试。`/tools/checks/cove/browser.html` 使用实际 GLB/WebGL 验证单船下载、旧船型归一、连续巡游、失败恢复和重复打开释放；不替代实体手机验收。

## 观赏与配置

`src/scene-assets/sunny-cove/config/boats.js` 只配置 Riva Aquarama 的朝向、展示长度、吃水、材质处理和船水接触参数；展示尺寸不是实艇工程数据。`config/tour.js` 定义 90 秒连续巡游，不再靠泊等待。

页面保留午后、日落、暮色、五种镜头、暂停、拍照、沉浸和手动开启水声。空格暂停或继续，`H` 切换沉浸，`Esc` 恢复界面。氛围和镜头只保存在当前浏览器；旧船型偏好不触发其他模型下载。

## 项目组织

| 目录 | 用途 |
| --- | --- |
| `src/cove/` | 首页组装与样式 |
| `src/scene-assets/sunny-cove/` | Riva、水面、程序天空、镜头与巡游 |
| `src/scene-assets/boat-water-interaction/` | 船体浮态、波谱和尾流 |
| `src/library/` | 本地素材收藏、筛选和异步预览 |
| `src/shared/` | 模型加载、资源释放、像素预算和观赏宿主 |
| `public/assets/` | 素材与来源；仅当前生产清单进入发布包 |
| `tools/checks/`、`tools/assets/` | 检查、发布白名单与素材加工 |
| `docs/`、`artifacts/` | 文档与本地验收证据 |

详见 [目录职责](docs/PROJECT-STRUCTURE.md)、[AGENTS.md](AGENTS.md) 和 [观赏资产接入](docs/design/VIEWING-ASSETS.md)。

## 模型与发布

运行时仅下载 Riva 的轻量 GLB；天空和水面由代码生成，无额外模型或贴图请求。生产清单只保留 Riva，兼容其原件 URL 与来源文件。其他已存在的素材留在本地工作台中，生产不发布、不预加载。

`tools/assets/cove-public-assets.mjs` 严格检查单船清单并生成发布白名单，Vite 不整目录复制 `public/`。模型加载使用有限容量字节缓存，不同场景各自拥有可变材质、几何和释放责任。运行纹理使用 AVIF/WebP；来源、许可与加工记录见 [晴湾来源](public/assets/cove/SOURCES.md) 和 [运行资源](public/assets/runtime/SOURCES.md)。

性能预算为完整场景 GLB ≤ 250,000 B、含兼容原件的发布目录 ≤ 4,000,000 B。体积通过不等于公网秒开，加载时间需包含代码、模型、解析与第一帧；历史与本轮证据分开记录在 [性能记录](docs/PERFORMANCE.md)。

网站无需后端或环境变量。GitHub `main` 推送经 Vercel Git 集成发布，见 [部署说明](docs/DEPLOYMENT.md)。本地实现、构建、浏览器验收、Git 推送和生产部署分别确认。

## 本地资料

项目位于 `/Users/linzhiqiang/code/connected-repos/my-repos/rc-boat-arena`。本轮截图、测速放 `artifacts/<主题>/<日期>/`；早期截图和实验归档于 `/Users/linzhiqiang/Documents/RC-Boat-Archive/2026-10-13`。历史设计中的四船、靠泊、山岸和竞速描述不代表当前范围。Git 历史及用户未跟踪文件保留。
