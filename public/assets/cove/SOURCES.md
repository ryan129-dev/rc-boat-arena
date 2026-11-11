# Sunny Cove asset sources

晴湾仅使用 Riva Aquarama 桃花心木经典游艇。水面、天空、巡游、运镜与水声由本项目程序生成，不加载山体、岸景、植被、码头或其他船型。此记录描述当前素材范围，不代表部署状态。

## 素材与署名

| 素材 | 作者 | 许可 | 原始来源 | 完整来源记录 |
| --- | --- | --- | --- | --- |
| Riva Aquarama · 经典木质快艇 | Anton Kovalev | [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) | [原始来源](https://sketchfab.com/3d-models/riva-aquarama-lamborghini-9d5716a2ab6645b9a1452f1d6b0372ef) | [riva-aquarama](../library/riva-aquarama/SOURCES.md) |

署名：Riva Aquarama by Anton Kovalev, licensed under CC BY 4.0.

## 船模与加工

共享加载器使用 [runtime 派生文件](../runtime/SOURCES.md)，文件为 **240,228 字节、4,458 三角面**，包含三张 512×512 贴图。船体完整所用几何、节点、UV 和材质分区保持不变，未进行船体减面。已进行贴图降采样、纹理编码、有界 FLOAT 精度处理和 Meshopt 压缩；这些加工不表示贴图无损。

源船首 +X 旋转至场景 -Z，等比缩放为 2.4 米，默认吃水 0.11 米；尺寸与水线为观赏设置。保留木纹与原 ORM 分区，运行时为木材增加清漆，调整镀铬、皮革与独立风挡。船水接触和巡游沿用本项目实现。

2026-11-11 重新核查资源体积后，保留已压缩的船模和贴图，移除其他船型及岸景的运行依赖。单船 GLB 不再降贴图分辨率或减少面数；已存在的完整库文件及其公开路径保持不变。此前使用的其他本地库素材保留用于工作台，不属于当前晴湾发布清单。

机器可读清单：[asset-manifest.json](asset-manifest.json) 描述完整库文件；[runtime 清单](../runtime/asset-manifest.json) 描述实际运行变体。字节和面数不等于浏览器实际加载时间或单帧绘制量。再次分发或接入时保留作者、原始链接、许可与加工说明。
