# 每个世界的阅读页背景

把图片放进这个目录，文件名取世界 id，构建时会自动生效，不需要改代码。

| 文件名 | 世界 |
|---|---|
| `modern_city` | 都市 |
| `entertainment` | 娱乐圈 |
| `hongkong_circle` | 港圈 |
| `campus` | 校园 |
| `esports` | 电竞 |
| `overseas` | 海外 |
| `historical_court` | 古代宫廷 |
| `republican_era` | 民国 |
| `fantasy` | 仙侠奇幻 |
| `apocalypse` | 末世 |

支持 `.jpg` `.jpeg` `.png` `.webp` `.avif`，例如 `hongkong_circle.jpg`。

没有放图的世界沿用默认底图 `public/figma/6-7-img.png`。

当前状态：除港圈外的九个世界都已放图（`.webp`，每张 100–180KB）。港圈刻意留空，沿用默认底图。

源图为 941×1672 的 PNG，各约 2.3MB，已按 quality=80 转成 WebP，总体积从 21MB 降到 1.1MB。若要替换某张，放同名文件即可，扩展名不必一致（同名多份会都被扫到，请先删旧的）。

建议：竖构图，短边不小于 1080px，压到 500KB 以内（`.webp` 最省）。
画面会被正文盖住大半，选对比不要太强、中间不要有主体脸部的图。
