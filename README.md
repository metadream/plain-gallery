- slide 不用再open mask，直接append
- 放大后再滑动，滑动距离不够
- 第一张或最后一张 隐藏箭头
- 打开指定索引的图片

* 加载原图过渡
* 窗口大小变化之后，关闭画廊时定位错误
* 点击图片时偶尔无法放大图片
* 点击关闭时偶尔动画失效
* plain-gallery 移动端 左右滑动（箭头图标方向）、双指缩放；鼠标左右滑动

## 优化
* 事件委托
* 一次性设置样式减少回流和重绘；
* 先设置属性和样式再append；
* 多个元素批量append
* el.style.cssText =
* 原图下载完成后隐藏缩略图
* 临时变量减少获取布局信息的获取次数

style. -> css
Math.random()

## 功能点
- 没有外部CSS、压缩后大小
- 支持平滑开启、平滑切换
- 支持点击缩放、滚轮缩放
- 支持事件监听
- 支持缩略图自然过渡
- 支持自定义工具栏
- 支持图片分组
- 支持可视边界内拖动
- 支持自适应窗口