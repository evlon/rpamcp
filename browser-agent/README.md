# 公众号留言采集器 - 完整使用指南

## 📋 项目概述

智能采集微信公众号后台留言中的公众号账号，支持拟人化操作、双重检测机制和完整的调试功能。

**当前版本**: v7.5 (2026-04-17) - 监听优化版（不刷新）

---

## 🎯 核心特性

### 1. **智能页面导航**
- 自动从首页点击"留言"菜单进入管理页
- 智能等待页面加载完成
- 验证关键元素是否存在

### 2. **双重新留言检测** ⭐
- **红点标记检测**: `span.article-list__item-badge` - 文章级别的新留言提示
- **"有更新(N条)"文本检测**: 筛选器下拉菜单提示 - 适用于第一个文章无红点的情况
- **适用场景**: 刷新后第一个文章红点消失但仍能检测

### 3. **第一个文章优化** 🆕 (v7.4+)
- **问题**: 刷新后第一个文章已默认加载详情，点击会导致更新提示消失
- **解决**: 检测到全局更新提示时，跳过点击直接采集
- **降级**: 如详情页未加载，自动执行点击流程

### 4. **智能数据采集**
- 只采集公众号账号（`isPublicAccount=true`）
- 自动去重（同一公众号只记录一次）
- 可限制每篇文章的采集数量

### 5. **拟人化行为**
- 随机延迟（1.5-3秒基础 + 额外思考时间）
- 模拟滚动浏览（60%概率，含反向滚动）
- 阅读停留时间（1.5-3秒）
- 文章间休息（2-4秒 + 偶尔额外停顿）

### 6. **完整的调试功能**
- **DEBUG_MODE**: 切换全量处理/仅新留言
- **MAX_ARTICLES_IN_DEBUG**: 限制处理文章数
- **MAX_COMMENTS_PER_ARTICLE**: 限制每篇采集留言数
- **DRY_RUN**: 空跑模式，只打印curl不发送

### 7. **智能监听模式** 🆕 (v7.5)
- 每5秒检查新留言
- 发现新留言时醒目通知 + 声音提醒
- 30秒防抖机制
- **不自动刷新页面**，保持日志可见性
- 自动重新点击"留言"菜单进入管理页

### 8. **优化的文章切换** 🆕 (v7.5)
- **无需返回按钮**：文章列表常驻左侧，直接点击下一篇文章
- **减少页面跳转**：提高采集效率
- **保持上下文**：避免丢失页面状态

### 9. **筛选状态智能判断** 🆕 (v7.5)
- **第一个文章**：通过筛选器状态判断（"有更新(N条)" vs "全部留言"）
- **其他文章**：依赖红点标记判断
- **准确识别**：区分新留言和已读留言

### 10. **健壮的错误处理**
- 重试机制（最多3次，递增延迟）
- 超时保护
- 降级策略
- 详细日志输出

---

## 🚀 快速开始

### 方式一：Tampermonkey 脚本（推荐）

1. **安装 Tampermonkey**
   - Chrome: [Chrome Web Store](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
   - Edge: [Edge Add-ons](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd)

2. **安装脚本**
   - 打开 Tampermonkey 仪表盘
   - 点击 "+" 创建新脚本
   - 复制 [`wechat-liuyan.js`](wechat-liuyan.js) 的全部内容
   - 粘贴并保存（Ctrl+S）

3. **访问公众号后台**
   - 打开 https://mp.weixin.qq.com/
   - 扫码登录
   - 脚本会自动运行

4. **查看结果**
   - 按 F12 打开控制台
   - 观察采集日志
   - 复制生成的 curl 命令测试

---

### 方式二：控制台直接运行（快速测试）

1. **登录公众号后台**
2. **进入留言管理页**
3. **按 F12 打开控制台**
4. **复制以下简化代码并粘贴**:

```
// 简化版 - 直接在控制台运行
(async function() {
    const LOG_PREFIX = '[快速采集]';
    console.log(LOG_PREFIX, '🚀 开始采集...');
    
    // 等待jQuery加载
    while (typeof $ === 'undefined') {
        await new Promise(r => setTimeout(r, 100));
    }
    
    // 获取所有文章
    const $articles = $('div.comment-articles div.comment-article-list div.article-list__item');
    console.log(LOG_PREFIX, `📰 找到 ${$articles.length} 篇文章`);
    
    const publicAccounts = new Set();
    
    // 遍历前3篇文章
    for (let i = 0; i < Math.min(3, $articles.length); i++) {
        const $article = $articles.eq(i);
        const title = $article.find('div.article-list__item-title').text().trim();
        console.log(LOG_PREFIX, `📝 处理: ${title.substring(0, 30)}...`);
        
        // 点击文章
        $article.find('div.article-list__item-title').click();
        await new Promise(r => setTimeout(r, 3000));
        
        // 采集公众号
        $('div.comment-list__item-container span.comment-nickname').each(function() {
            const nickname = $(this).find('span').first().html();
            const isPublic = $(this).find('i.icon-public-account').length > 0;
            
            if (nickname && isPublic && !publicAccounts.has(nickname)) {
                publicAccounts.add(nickname);
                console.log(LOG_PREFIX, `  ✓ ${nickname}`);
            }
        });
        
        // 返回
        $('.back-btn, .weui-desktop-btn_back').first().click();
        await new Promise(r => setTimeout(r, 3000));
    }
    
    console.log(LOG_PREFIX, `\n🎉 共发现 ${publicAccounts.size} 个公众号:`);
    console.log(Array.from(publicAccounts));
})();
```

---

## ⚙️ 配置说明

### 调试配置 (DEBUG_CONFIG)

```javascript
const DEBUG_CONFIG = {
    // 调试模式：true=处理所有文章，false=只处理有新留言的文章
    DEBUG_MODE: true,
    
    // 调试模式下最多处理的文章数量（0=不限制）
    MAX_ARTICLES_IN_DEBUG: 3,
    
    // 每篇文章最多采集的留言数量（0=不限制）
    MAX_COMMENTS_PER_ARTICLE: 5,
    
    // Dry Run模式：true=只打印curl不发送，false=实际发送
    DRY_RUN: true
};
```

### 配置建议

| 场景 | DEBUG_MODE | MAX_ARTICLES | MAX_COMMENTS | DRY_RUN | 说明 |
|------|-----------|--------------|--------------|---------|------|
| 首次测试 | true | 3 | 5 | true | 快速验证逻辑 |
| 完整测试 | true | 0 | 0 | true | 处理所有数据 |
| 生产环境 | false | - | - | false | 只处理新留言 |
| 调试验证 | true | 1 | 2 | true | 最小化测试 |

---

## 📊 工作流程

### 1. 首页阶段
```
启动脚本 → 检测页面 → 等待加载 → 点击"留言"菜单 → 跳转
```

### 2. 留言管理页阶段
```
验证加载 → 获取文章列表 → 双重检测新留言 → 遍历处理
```

#### 文章处理流程 (v7.5 优化)
```
┌─────────────────────┐
│ 判断文章类型         │
└──────────┬──────────┘
           │
    ┌──────┴──────┐
    │             │
第一个文章？   其他文章
           │             │
    ├─有红点      ├─有红点
    ├─筛选器显示   └─无红点→跳过
    │ "有更新"
    └─以上皆无→跳过
           │
           ▼
    第一个文章已默认加载
    其他文章需要点击
           │
           ▼
    验证详情页加载
           │
           ▼
    拟人化浏览
           │
           ▼
    采集公众号
           │
           ▼
    直接点击下一篇文章 🆕
    (无需返回按钮)
           │
           ▼
    文章间休息
```

### 3. 结果输出阶段
```
打印汇总报告 → 显示表格 → 生成curl → 发送数据(可选)
```

### 4. 监听阶段 (v7.5 优化)
```
启动监听器 → 每5秒检查 → 发现新留言 → 醒目通知 + 声音
                                    ↓
                            自动点击"留言"菜单
                                    ↓
                            重新进入管理页采集
                                    ↓
                            不刷新页面，保持日志可见 🆕
```

---

## 🔍 关键技术点

### 双重检测机制

```javascript
// 1. 检查全局"有更新(N条)"提示（仅用于第一个文章）
const $filterText = $('div.filter-bar li.comment-dropdown-item div.weui-desktop-tooltip__wrp span.weui-desktop-form__dropdown__value');
const filterStatus = filterText.includes('有更新') ? 'has_updates' : 'all_comments';

// 2. 检查文章红点标记（用于所有文章）
const hasBadge = $article.find('span.article-list__item-badge').length > 0;

// 3. 综合判断
if (index === 0) {
    // 第一个文章：红点 OR 筛选器显示"有更新"
    shouldProcess = hasBadge || (filterStatus === 'has_updates');
} else {
    // 其他文章：只看红点
    shouldProcess = hasBadge;
}
```

**重要说明**: 
- 筛选器状态是针对**当前选中文章的留言筛选**，不是对所有文章的筛选
- 只有第一个文章默认已打开，能看到它的筛选器状态
- 其他文章需要点击后才能看到筛选器，所以只能通过红点判断

### 第一个文章优化

```javascript
const isFirstArticleWithGlobalUpdate = (
    articleInfo.index === 0 && 
    articleInfo.updateType === '全局更新提示'
);

if (isFirstArticleWithGlobalUpdate) {
    // 跳过点击，直接验证并采集
    await verifyPageLoaded([...]);
    // 采集逻辑...
} else {
    // 正常点击流程
    await processArticleWithClick(articleInfo);
}
```

### 拟人化延迟

```javascript
async function humanDelay(baseMin = 1500, baseMax = 3000) {
    const delay = randomDelay(baseMin, baseMax);
    
    // 30% 概率添加额外思考时间
    if (Math.random() < 0.3) {
        const extraDelay = randomDelay(1000, 2500);
        await sleep(delay + extraDelay);
    } else {
        await sleep(delay);
    }
}
```

---

## 📝 日志示例

### 成功采集 (v7.5)
```
[留言采集] 🚀 公众号留言采集器已启动 v7.5 (监听优化版-不刷新)
[留言采集] 📍 当前页面: 留言管理页
[留言采集] 💬 在留言管理页面，开始采集...
[留言采集] 🔧 调试模式: ✅ 开启
[留言采集] 📰 找到 10 篇文章
[留言采集] 🔍 第一个文章留言筛选状态: 有更新(2条)
[留言采集] 🔧 调试模式：处理所有文章
[留言采集] 📋 将处理 3 篇文章

[留言采集] ============================================================
[留言采集] 📝 处理第 1/3 篇文章
[留言采集] 📌 文章: 中国 6 亿人近视！这 5 种...
[留言采集] 🆕 新留言: 2条 | 标记: 有
[留言采集] 🔍 检测类型: 筛选状态-有更新
[留言采集] ============================================================
[留言采集] ✅ 第一个文章已默认加载详情，跳过点击步骤，直接采集...
[留言采集] 💭 额外思考延迟: 1523ms
[留言采集] 🔍 验证页面加载状态...
[留言采集] ✅ 页面加载完成
[留言采集] 👁️ 浏览留言内容...
[留言采集] 📜 犹豫性滚动...
[留言采集] 👥 找到 15 个留言者
[留言采集]   ✓ 发现公众号: 阿牛云舍
[留言采集]   ✓ 发现公众号: 四氧化三铁18
[留言采集] 💭 浏览完毕，准备处理下一篇...
[留言采集] 🖱️ 直接点击下一篇文章: 如何保护视力...
[留言采集] ⏳ 等待新文章详情页加载...
[留言采集] ☕ 休息一下，准备采集新文章留言...

[留言采集] ================================================================================
[留言采集] 🎉 采集流程完成！
[留言采集] ================================================================================
[留言采集] 📈 处理文章数: 3 篇
[留言采集] 👥 采集公众号数: 11 个
[留言采集] ⏱️ 完成时间: 2026/4/17 23:50:00
[留言采集] ================================================================================

[留言采集] 👂 进入监听模式，等待新留言...
[留言采集] 💡 提示: 当有新留言时，脚本会自动重新进入留言管理页采集
[留言采集] 💡 重要: 不会自动刷新页面，您可以看到完整的日志输出
```

### 监听模式检测到新留言
```
🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔
[留言采集] 🎉 发现 3 条新留言！
[留言采集] 🔄 准备重新进入留言管理页采集...
🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔

[留言采集] 🔄 重新进入留言管理页...
[留言采集] 🖱️ 点击留言菜单...
[留言采集] ⏳ 等待留言管理页加载...
[留言采集] ✅ 成功进入留言管理页，重新开始采集流程...
```

### 新留言通知
```
[留言采集] 🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔
[留言采集] 🎉 发现 5 条新留言！
[留言采集] 💡 您可以:
[留言采集]    1. 手动刷新页面重新采集
[留言采集]    2. 继续等待更多留言
[留言采集] 🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔🔔
```

---

## 🛠️ 故障排查

### 问题1: 脚本不运行
**原因**: Tampermonkey 未启用或脚本被禁用  
**解决**: 
1. 检查 Tampermonkey 图标是否显示数字
2. 确认脚本开关已打开
3. 刷新页面

### 问题2: 找不到"留言"菜单
**原因**: 页面未完全加载  
**解决**: 
1. 等待页面加载完成
2. 手动刷新页面
3. 检查是否有权限访问留言功能

### 问题3: 采集不到公众号
**原因**: 文章中没有公众号留言  
**解决**: 
1. 确认文章确实有公众号留言
2. 检查 `isPublicAccount` 判断逻辑
3. 查看控制台是否有错误信息

### 问题4: 速度太快/太慢
**调整**: 修改 `CONFIG` 中的延迟参数
```
const CONFIG = {
    MIN_DELAY: 1000,  // 减小加快，增大减慢
    MAX_DELAY: 2000,
    // ...
};
```

### 问题5: 第一个文章被跳过
**原因**: 详情页未加载且点击失败  
**解决**: 
1. 检查网络连接
2. 增加 `PAGE_LOAD_TIMEOUT`
3. 查看控制台错误日志

---

## 📂 文件说明

- **[wechat-liuyan.js](wechat-liuyan.js)** - 主脚本文件（v7.5）
- **[xpath.txt](xpath.txt)** - CSS选择器参考文档
- **[README.md](README.md)** - 本使用指南
- **[CHANGELOG.md](CHANGELOG.md)** - 版本更新日志
- **[HUMANIZATION_ENHANCEMENTS.md](HUMANIZATION_ENHANCEMENTS.md)** - 拟人化行为详解
- **[V7.4_UPDATE_NOTES.md](V7.4_UPDATE_NOTES.md)** - v7.4 更新说明

---

## 🔄 版本历史

### v7.5 (2026-04-17) - 监听优化版（不刷新）
- ✅ **监听时不刷新页面**：检测到新留言后重新点击"留言"菜单进入管理页
- ✅ **直接点击下一篇文章**：文章列表常驻左侧，无需返回按钮，提高效率
- ✅ **筛选状态智能判断**：第一个文章通过筛选器状态判断（"有更新" vs "全部留言"）
- ✅ **保持日志可见性**：采集完成后不自动刷新，方便查看完整日志
- ✅ **防重复触发**：添加 `isProcessing` 标志，避免并发问题
- ✅ **优化代码结构**：移除不必要的返回逻辑，简化流程

### v7.4 (2026-04-17) - 第一个文章优化版
- ✅ 第一个文章（全局更新提示）跳过点击直接采集
- ✅ 避免点击导致更新提示消失
- ✅ 添加降级机制（详情页未加载时自动点击）

### v7.3 (2026-04-17) - 双重检测增强版
- ✅ 同时检测红点标记和"有更新(N条)"文本
- ✅ 使用精确的XPath选择器
- ✅ 详细日志显示检测类型

### v7.2 (2026-04-17) - 结果输出优化版
- ✅ 完整的采集结果汇总报告
- ✅ 格式化表格展示
- ✅ 监听模式不自动刷新
- ✅ 声音提醒 + 防抖机制

### v7.1 (2026-04-17) - 拟人化增强版
- ✅ 延迟时间全面提升
- ✅ 智能"思考"行为
- ✅ 滚动浏览增强
- ✅ 更多拟人化场景

### v7.0 (2026-04-17) - MCP测试通过版
- ✅ 通过MCP Edge DevTools端到端测试
- ✅ 成功采集11个公众号账号
- ✅ 完整的功能验证

---

## 💡 最佳实践

1. **首次使用**: 开启 `DRY_RUN: true` 测试
2. **调试阶段**: 设置 `MAX_ARTICLES_IN_DEBUG: 3` 加快速度
3. **生产环境**: 关闭 `DEBUG_MODE`，只处理新留言
4. **监控日志**: 关注 emoji 日志了解执行状态
5. **定期检查**: 查看控制台是否有错误警告

---

## 📞 支持与反馈

如有问题或建议，请：
1. 查看控制台日志
2. 检查 [xpath.txt](xpath.txt) 中的选择器是否有效
3. 参考 [CHANGELOG.md](CHANGELOG.md) 了解版本特性

---

*最后更新: 2026-04-17 v7.4*
