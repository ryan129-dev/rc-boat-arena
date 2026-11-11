# 晴湾场景交付模型

晴湾仅发布并加载 Riva Aquarama 桃花心木经典游艇运行变体。其他船型、码头、山体、岩岸与植被不在当前发布清单内；本地库存文件保留。完整船模位于 `/assets/library/riva-aquarama/model.glb`，运行加工未覆盖该文件。

## 当前运行文件

| 运行变体 | 字节 | 三角面 | 作者 | 许可 | 来源与记录 |
| --- | ---: | ---: | --- | --- | --- |
| [riva-aquarama](riva-aquarama.glb) | 240,228 | 4,458 | Anton Kovalev | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [原始来源](https://sketchfab.com/3d-models/riva-aquarama-lamborghini-9d5716a2ab6645b9a1452f1d6b0372ef) · [加工记录](../library/riva-aquarama/SOURCES.md) |

SHA-256：`0cd844da86902f4014d642c4affaf3e6aa5cd4a6bdc595342c07154b165c5456`。三张贴图均为 512×512，颜色图使用 WebP，ORM 与法线图使用 AVIF，内嵌图像合计 173,081 字节。完整字节、纹理格式、几何误差界限和来源见 [asset-manifest.json](asset-manifest.json)。

## 加工与质量边界

运行船模保留所用完整几何、节点、UV 与材质分区，未进行船体减面。2026-10-05 生成运行变体时，贴图降采样到 512，再经过有界 FLOAT 精度处理和 Meshopt 压缩。位置分量误差上限为 0.0002 个源模型单位、法线为 0.001、UV 为 1/4096；FLOAT 属性仍为 FLOAT。压缩数据由 Three.js 使用的 MeshoptDecoder 回读验证。

2026-10-22 对纹理重新编码：颜色图 PSNR 不低于 36 dB、ORM/法线图不低于 38 dB，阈值相对当时的 512 运行贴图计算；透明通道无损保存。移除材质未引用的 TANGENT；三角形拓扑与船体尺寸未变。AVIF/WebP 通过 `EXT_texture_avif`、`EXT_texture_webp` 声明，需要支持对应格式的浏览器，未内嵌 JPEG 回退副本。

2026-11-11 单船水面收窄：保留当前 240,228 字节运行文件，SHA-256 不变。零误差顶点与原图像字节的重新压缩未进一步缩小文件；不为减少少量字节继续降低木纹分辨率或船体几何质量。减少的主要传输与渲染成本来自移除其他船型和岸景依赖。

上述误差校验不表示贴图降采样无损，也不代表实际浏览器加载耗时。船首方向、显示尺寸、吃水与接触参数由场景配置，材质处理见 [晴湾组合记录](../cove/SOURCES.md)。

## 重建与校验

历史初始变体由 `tools/assets/build-startup-models.mjs` 从完整库文件生成；纹理重编码流程见 `tools/assets/optimize-cove-runtime.mjs`。旧批处理脚本适用于本地素材库存，不用于恢复已移除的场景依赖。调整运行模型后需同步本清单、来源记录与加载映射，再运行 `pnpm check:delivery`。

本轮无损重编码实验保存在本机 `tools/local/riva-2026-11-11/`，不发布；最终运行文件未替换。原作者许可和署名要求保持不变。
