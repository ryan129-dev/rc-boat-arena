# 晴湾观赏资产接入

当前首页只展示 Riva Aquarama 桃花心木经典游艇、水面和天空倒影，无船型切换、码头、山岸、植被或后台陈设下载。保留三种光照、五种镜头、连续巡游、暂停、水声、PNG 拍照和沉浸。旧 `/cove/`、`/swamp/`、生产 `/library/` 返回相同部署前缀的首页，保留查询参数与片段；本地 `/library/` 为素材工作台。

## 组合与所有权

| 入口 | 职责 |
| --- | --- |
| `createSunnyCoveScene` | 创建独立 Scene、camera 和子资产，不拥有 renderer、RAF、DOM 或音频 |
| `createSunnyCoveViewer` | 通过共享 Canvas 宿主管理 renderer、后处理、帧循环与水声 |
| `createViewingPage` | 页面首帧、失败重试、偏好、照片下载与来源弹窗 |
| `src/scene-assets/catalog.js` | 本地工作台纯元数据，不依赖 Three.js |

| 文件 | 职责 |
| --- | --- |
| `sunny-cove/index.js` | 单船组合、生命周期与 Canvas 入口 |
| `sunny-cove/environment.js` | 程序天空、雾、光照及环境反射，不加载外部场景模型 |
| `sunny-cove/water.js` | 天空与船体反射、波浪和船水尾流，不创建海床折射目标 |
| `sunny-cove/boat.js` | 加载 Riva，适配方向、尺寸、材质和水线，返回实测包围盒 |
| `config/boats.js` | Riva 配置、默认 ID 与严格 ID 查询，不依赖 Three.js |
| `config/tour.js` | 90 秒连续巡游和镜头时长 |
| `camera.js`、`navigation.js` | 船中心运镜与闭环巡游 |
| `boat-water-interaction/index.js` | CPU/GPU 共用波谱、浮态及尾流历史 |
| `presets.js` | `afternoon`、`sunset`、`bluehour` 的天空、水色与曝光 |

旧 `dock.js`、`coast.js`、`foliage.js` 及陈设配置保留为本地旧模块，正式组合不导入它们，生产不发布其模型。它们不构成当前页面能力。

## Canvas 接入

以下模块放在 `src/cove/`，HTML 位于首页并提供已经挂载、尺寸非零的 `#world` Canvas 和 `#sound` 按钮。

```js
import { createSunnyCoveViewer, COVE_TOUR } from '../scene-assets/sunny-cove/index.js';

const canvas = document.querySelector('#world');
const request = new AbortController();
const viewer = await createSunnyCoveViewer({
  canvas,
  assetBaseUrl: new URL('./assets/', document.baseURI).href,
  quality: 'balanced', signal: request.signal,
  mood: 'afternoon', cameraMode: 'auto', tour: COVE_TOUR,
  reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
});
viewer.setMood('bluehour');
viewer.setCamera('scenic');
document.querySelector('#sound').addEventListener('click', async () => {
  await viewer.setSound(!viewer.snapshot().sound);
});
function closePreview() {
  request.abort(); viewer.dispose(); canvas.remove();
}
```

`assetBaseUrl` 是公开 `assets/` 目录的绝对 URL，带结尾 `/`。首页使用 `./assets/`，本地 `/library/` 使用 `../assets/`，都保留静态宿主的部署前缀。不要按 JS 文件位置推算资源路径。

| 方法 | 用途 |
| --- | --- |
| `setMood(name)` | 选择光照；水面、天空和环境光平滑过渡 |
| `setCamera(name)` | `auto`、`waterline`、`follow`、`scenic`、`overview` |
| `setPaused(boolean)` | 暂停或继续巡游和动画 |
| `setSound(boolean)` | 异步启停水声，首次开启放在用户点击处理器中 |
| `reset()` | 重置巡游时间、位置和尾流，保留氛围与镜头 |
| `resize()` | 使用 Canvas 当前 CSS 尺寸；宿主也观察尺寸变化 |
| `capture()` | 返回 PNG Blob 的 Promise，由调用方保存 |
| `snapshot()` | 读取模型、巡游、相机、渲染及加载状态 |
| `dispose()` | 停止帧循环和音频，移除观察器、事件并释放所属资源 |

场景不提供 `setBoat()`。旧 `boatId` 创建参数归一为 Riva，不能触发其他模型请求。`quality` 为 `balanced` 或 `low`；减少动态效果从暂停的固定镜头开始。`onFrame(snapshot)` 更新界面，`onError(error)` 处理渲染错误。必须处理创建 Promise 拒绝，关闭预览后仍应释放迟到的实例。

创建完成意味着 Riva 已解析和场景已组装；页面继续等待成功首帧才解除加载提示并启用操作，渲染失败提供重试。没有后台细节阶段；`detailReady` 为已完成 Promise，`snapshot().detailState.status` 为 `ready`，仅为共享宿主兼容保留。

## 船、巡游与本机偏好

`config/boats.js` 导出 `BOATS`、`DEFAULT_BOAT_ID`、`getBoatDefinition(id)`；仅包含 `riva-aquarama`。Riva 展示长度 2.4 米、吃水 0.11 米，配置包括原件路径、船首方向、材质处理及 `contact` 参数；这些是观赏设定，不是实艇规格。船体挂载后的实际 `length`、`beam`、`height`、`draft` 用于镜头和船水交互。

`COVE_TOUR.navigation` 使用 `continuous: true`、`travelDuration: 90`、`dwellDuration: 0`，全程 `phase` 为 `cruising`。开场进度 `.104` 保持前景位置；不归港、不停泊。`COVE_TOUR.camera` 定义机位停留 20 秒、过渡 12 秒。修改时复制嵌套对象：

```js
const tour = {
  ...COVE_TOUR,
  navigation: { ...COVE_TOUR.navigation, travelDuration: 100 },
};
const viewer = await createSunnyCoveViewer({ canvas, assetBaseUrl, tour });
```

独立 `createCoveNavigation()` 保留旧的航行/停靠默认行为用于本地复用，正式场景显式传入连续模式。`routeAtBerth()` 仅为旧独立导航兼容，不参与正式场景。改变路线后需重新验证全船构图、转向与尾流连续性。

页面 `sunny-cove.preferences.v1` 只读取与保存 `{ mood, cameraMode }`，忽略旧 `boatId`。未知值、损坏记录或存储不可用时回退默认；首次查看不写入，用户改氛围或镜头后才保存。暂停、水声不持久化，无服务器或跨设备同步。

## 接入已有 renderer

```js
import { createSunnyCoveScene } from '../scene-assets/sunny-cove/index.js';

const request = new AbortController();
const asset = await createSunnyCoveScene({
  renderer,
  assetBaseUrl: new URL('./assets/', document.baseURI).href,
  quality: 'balanced', signal: request.signal,
  mood: 'afternoon', cameraMode: 'auto',
});
asset.resize(canvas.clientWidth, canvas.clientHeight);
function renderCove(dt) {
  asset.update(dt);
  renderer.render(asset.scene, asset.camera);
}
function releaseCove() {
  // 先停止宿主调用 renderCove。
  request.abort(); asset.dispose();
}
```

返回 `scene`、`camera`、`boat`、`state`、`environment`、`water`、`boatVisual`、`interaction`、`detailReady`，以及 `update`、`setMood`、`setCamera`、`reset`、`resize`、`snapshot`、`dispose`。renderer 和 RAF 始终归宿主所有。场景需要光照、模型加载取消和明确的释放责任。

独立 `createCoveCamera(camera, { reducedMotion, dimensions })` 不加载模型或拥有相机。使用 `setMode()`、`resize()`、`snap(boat)`、`update(dt, elapsed, boat)` 和 `dispose()`；船提供 `x`、`z`、`heading`。`heading = 0` 朝 `-Z`，正角朝 `-X`。自动镜头依次经过 `waterline`、`scenic`、`follow`、`overview`，不偏向旧泊位。近观方向独立于船首方向，竖屏按完整船体尺寸退远。

## 独立船水模块

`createCoveEnvironment(scene, { renderer, quality, mood })` 生成天空、雾和光照，无 GLB 或天空贴图下载。调用 `update()`、`setMood()` 与 `dispose()`，不拥有宿主 renderer。环境贴图按氛围惰性生成，结束时统一释放。

`createCoveWater(scene, { quality, size })` 拥有反射纹理和波浪材质。调用 `update(time, boat)`、`resize(width, height)`、`setMood(preset)`、`setInteraction(interaction)` 和 `dispose()`。`sampleSurface(x, z, time)` 提供 CPU 水面高度与斜率，`setMood()` 支持 `waterClarity`、`waveStrength`。无需海床或折射纹理。

`createCoveBoat(scene, url, { signal, definition, length, draft })` 返回船体、实际尺寸及 `update()`/`dispose()`。默认 Riva 长度 2.4、吃水 .11，未覆盖吃水时随长度等比变化。模型 URL 必须与定义对应。

`createBoatWaterInteraction({ length, beam, draft, sampleSurface })` 提供浮态、船边压水和历史尾流，不创建模型、renderer、DOM 或 RAF。

| 接口 | 接入责任 |
| --- | --- |
| `interaction.update(dt, time, boat)` | 更新浮态和尾流；船提供位置、朝向、速度、可选转速 |
| `interaction.pose` | 传给 `boatVisual.update(dt, time, boat, interaction.pose)` |
| `water.setInteraction(interaction)` | 绑定 uniforms，水面不取得交互实例的释放责任 |
| `interaction.reset(time, boat)` | 重置位置后清尾迹并重新采样 |
| `interaction.snapshot()` / `dispose()` | 读状态 / 释放历史，重复释放安全 |

每帧依次更新导航、水面时间、船水交互、船体，再渲染。CPU 浮态与 GPU 水面使用同一波谱；不要从 `pose.heave` 再扣一次吃水。单独更换交互实例前先 `water.setInteraction(null)`，再释放旧实例。该模型是小尺度观赏近似，没有完整求解流体或船体排水。

## 资源与交付

模型通过 `loadGLTF(url, { delivery: 'scene' })` 选择登记的 Riva 运行变体，保留部署前缀、查询参数和片段。未登记的本地素材不重写路径；单模型工作台默认加载完整原件。共同文件只共享有界缓存内的不可变字节，不共享可修改场景。

生产清单只包含 Riva，保留其原始公开 URL、轻量运行模型和署名。其他本地模型和场景模块不进入发布白名单。Riva 作者 Anton Kovalev，CC BY 4.0；水面、天空和镜头为项目实现，组合标签不能替代船模署名。见 [晴湾来源](../../public/assets/cove/SOURCES.md) 和 [运行变体](../../public/assets/runtime/SOURCES.md)。

共享 viewer 拥有抗锯齿与后处理资源，`snapshot().render.antialias`、`samples` 可查看当前配置。独立场景不会创建这些管线。静态模型按需绘制，观赏在离屏、后台或暂停时停止持续更新；水声需显式开启且后台挂起。

## 验收

```sh
pnpm check:viewing
pnpm check:cove
pnpm check:contact
pnpm check:assets
pnpm check:delivery
pnpm build
pnpm check:bundle
pnpm check:routes
```

浏览器检查首次完整船体、无隐藏场景请求、旧船型偏好归一、三种光照、五种镜头、90 秒连续航行、暂停恢复、拍照、沉浸、水声与失败重试。重复打开/关闭独立场景后资源计数应稳定并正确释放。旧入口与本地工作台分别验收，窄屏模拟不能代替实体手机。构建、浏览器、推送、部署和公网速度分别记录。
