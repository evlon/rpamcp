// ==UserScript==
// @name         公众号留言采集器
// @namespace    http://tampermonkey.net/
// @version      7.5
// @description  智能采集公众号留言 - v7.5 监听优化版（不刷新）
// @match        https://mp.weixin.qq.com/*
// @grant        GM_xmlhttpRequest
// @run-at       document-idle
// @require      https://cdn.jsdelivr.net/npm/jquery@3.7.1/dist/jquery.min.js
// ==/UserScript==

(function() {
    'use strict';

    const LOG_PREFIX = '[留言采集]';
    
    // rpamcp 服务器配置
    const RPAMCP_SERVER = 'http://localhost:3001';
    const API_ENDPOINT = `${RPAMCP_SERVER}/api/comments/submit`;

    // ========== 调试配置 ==========
    const DEBUG_CONFIG = {
        // 调试模式开关：true=处理所有文章，false=只处理有新留言的文章
        DEBUG_MODE: false,
        
        // 调试模式下最多处理的文章数量（0=不限制）
        MAX_ARTICLES_IN_DEBUG: 3,
        
        // 每篇文章最多采集的留言数量（0=不限制）
        MAX_COMMENTS_PER_ARTICLE: 5,
        
        // 是否跳过实际发送（仅打印curl命令）
        DRY_RUN: true
    };

    // 配置参数 - 增强拟人化延迟
    const CONFIG = {
        MIN_DELAY: 1500,           // ⬆️ 从800增加到1500
        MAX_DELAY: 3000,           // ⬆️ 从2000增加到3000
        CLICK_DELAY_MIN: 2500,     // ⬆️ 从1500增加到2500
        CLICK_DELAY_MAX: 4500,     // ⬆️ 从3500增加到4500
        PAGE_LOAD_TIMEOUT: 15000,  // ⬆️ 从10000增加到15000
        MAX_RETRIES: 3,
        RETRY_DELAY: 3000,         // ⬆️ 从2000增加到3000
        ELEMENT_CHECK_INTERVAL: 800, // ⬆️ 从500增加到800
        MAX_WAIT_FOR_ELEMENT: 12000  // ⬆️ 从8000增加到12000
    };

    // 判断当前页面
    const isCommentPage = window.location.href.includes('misc/appmsgcomment?action=list_latest_comment');
    const isHomePage = !isCommentPage;

    // ========== 工具函数 ==========

    function randomDelay(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    async function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async function humanDelay(baseMin = CONFIG.MIN_DELAY, baseMax = CONFIG.MAX_DELAY) {
        const delay = randomDelay(baseMin, baseMax);
        
        // 30% 概率添加额外的"思考"延迟（更频繁）
        if (Math.random() < 0.3) {
            const extraDelay = randomDelay(1000, 2500);  // ⬆️ 增加额外延迟范围
            console.log(LOG_PREFIX, `💭 额外思考延迟: ${extraDelay}ms`);
            await sleep(delay + extraDelay);
        } else {
            await sleep(delay);
        }
    }

    /**
     * 模拟人类滚动页面（增强版）
     */
    async function humanScroll(scrollAmount = null) {
        // 60% 概率滚动（从50%增加到60%）
        if (Math.random() < 0.6) {
            const scroll = scrollAmount || randomDelay(150, 600);  // ⬆️ 增加滚动范围
            
            // 偶尔反向滚动（模拟犹豫）
            if (Math.random() < 0.15) {
                console.log(LOG_PREFIX, '📜 犹豫性滚动...');
                window.scrollBy({ top: -scroll / 2, behavior: 'smooth' });
                await sleep(randomDelay(300, 800));
            }
            
            window.scrollBy({
                top: scroll,
                behavior: 'smooth'
            });
            await sleep(randomDelay(500, 1200));  // ⬆️ 滚动后等待更久
        }
    }

    async function waitForJQueryElement(selector, timeout = CONFIG.MAX_WAIT_FOR_ELEMENT) {
        const startTime = Date.now();
        
        while (Date.now() - startTime < timeout) {
            try {
                const $element = $(selector);
                if ($element && $element.length > 0) {
                    console.log(LOG_PREFIX, `✅ 找到jQuery元素: ${selector}`);
                    return $element;
                }
            } catch (e) {
                console.warn(LOG_PREFIX, `⚠️ jQuery 查询出错:`, e);
            }
            
            await sleep(randomDelay(CONFIG.ELEMENT_CHECK_INTERVAL - 200, CONFIG.ELEMENT_CHECK_INTERVAL + 200));
        }
        
        console.warn(LOG_PREFIX, `⚠️ 超时未找到jQuery元素: ${selector}`);
        return null;
    }

    async function humanClick($element, description = '元素') {
        if (!$element || $element.length === 0) {
            console.error(LOG_PREFIX, `❌ 无法点击: ${description} 不存在`);
            return false;
        }

        try {
            const element = $element[0];
            
            if (typeof element.click === 'function') {
                console.log(LOG_PREFIX, `🖱️ 点击: ${description}`);
                element.click();
            } else {
                console.log(LOG_PREFIX, `🖱️ 点击(jQuery): ${description}`);
                $element.click();
            }
            
            await humanDelay(CONFIG.CLICK_DELAY_MIN, CONFIG.CLICK_DELAY_MAX);
            return true;
        } catch (error) {
            console.error(LOG_PREFIX, `❌ 点击失败: ${description}`, error);
            return false;
        }
    }

    async function verifyPageLoaded(expectedSelectors, timeout = CONFIG.PAGE_LOAD_TIMEOUT) {
        console.log(LOG_PREFIX, '🔍 验证页面加载状态...');
        
        for (const selector of expectedSelectors) {
            const element = await waitForJQueryElement(selector, timeout);
            if (!element) {
                console.error(LOG_PREFIX, `❌ 关键元素未加载: ${selector}`);
                return false;
            }
        }
        
        console.log(LOG_PREFIX, '✅ 页面加载完成');
        return true;
    }

    async function retryOperation(operation, maxRetries = CONFIG.MAX_RETRIES, operationName = '操作') {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(LOG_PREFIX, `${operationName} - 尝试 ${attempt}/${maxRetries}`);
                const result = await operation();
                if (result) {
                    return result;
                }
                
                if (attempt < maxRetries) {
                    const retryDelay = CONFIG.RETRY_DELAY * attempt;
                    console.warn(LOG_PREFIX, `${operationName} 失败，${retryDelay}ms 后重试...`);
                    await sleep(retryDelay);
                }
            } catch (error) {
                console.error(LOG_PREFIX, `${operationName} 出错:`, error);
                if (attempt < maxRetries) {
                    await sleep(CONFIG.RETRY_DELAY * attempt);
                }
            }
        }
        
        console.error(LOG_PREFIX, `❌ ${operationName} 在 ${maxRetries} 次尝试后仍然失败`);
        return null;
    }

    // ========== 首页逻辑：进入留言管理 ==========
    if (isHomePage) {
        console.log(LOG_PREFIX, '📄 在首页，准备进入留言管理...');

        setTimeout(async () => {
            const pageLoaded = await verifyPageLoaded([
                'ul.weui-desktop-sub-menu',
                'li.weui-desktop-sub-menu__item'
            ]);
            
            if (!pageLoaded) {
                console.error(LOG_PREFIX, '❌ 页面未完全加载，中止操作');
                return;
            }
            
            const $commentMenu = await waitForJQueryElement(
                'ul.weui-desktop-sub-menu > li.weui-desktop-sub-menu__item span:contains("留言")'
            );
            
            if ($commentMenu && $commentMenu.length > 0) {
                console.log(LOG_PREFIX, `找到 ${$commentMenu.length} 个留言菜单项，点击第一个`);
                await humanClick($commentMenu.first(), '留言菜单');
            } else {
                console.log(LOG_PREFIX, '❌ 未找到留言菜单');
            }
        }, randomDelay(1500, 2500));
    }

    // ========== 留言页面逻辑：采集数据 ==========
    if (isCommentPage) {
        console.log(LOG_PREFIX, '💬 在留言管理页面，开始采集...');
        console.log(LOG_PREFIX, `🔧 调试模式: ${DEBUG_CONFIG.DEBUG_MODE ? '✅ 开启' : '❌ 关闭'}`);
        console.log(LOG_PREFIX, `📊 最大文章数: ${DEBUG_CONFIG.MAX_ARTICLES_IN_DEBUG || '无限制'}`);
        console.log(LOG_PREFIX, `💬 每篇最大留言数: ${DEBUG_CONFIG.MAX_COMMENTS_PER_ARTICLE || '无限制'}`);
        console.log(LOG_PREFIX, `🚀 Dry Run: ${DEBUG_CONFIG.DRY_RUN ? '✅ 是' : '❌ 否'}`);

        setTimeout(async () => {
            const pageLoaded = await verifyPageLoaded([
                'div.comment-articles',
                'div.comment-article-list'
            ]);
            
            if (!pageLoaded) {
                console.error(LOG_PREFIX, '❌ 留言页面未完全加载');
                startListeningWithoutAutoRefresh();
                return;
            }

            const allComments = [];
            const publicAccountSet = new Set();

            const $articles = await waitForJQueryElement('div.comment-articles div.comment-article-list div.article-list__item');
            
            if (!$articles || $articles.length === 0) {
                console.log(LOG_PREFIX, '⚠️ 未找到任何文章');
                startListeningWithoutAutoRefresh();
                return;
            }
            
            console.log(LOG_PREFIX, `📰 找到 ${$articles.length} 篇文章`);

            let articlesToProcess = [];
            
            if (DEBUG_CONFIG.DEBUG_MODE) {
                console.log(LOG_PREFIX, '🔧 调试模式：处理所有文章');
                
                $articles.each(function(index) {
                    if (DEBUG_CONFIG.MAX_ARTICLES_IN_DEBUG > 0 && index >= DEBUG_CONFIG.MAX_ARTICLES_IN_DEBUG) {
                        console.log(LOG_PREFIX, `已达到最大文章数限制 (${DEBUG_CONFIG.MAX_ARTICLES_IN_DEBUG})`);
                        return false;
                    }
                    
                    const $article = $(this);
                    const title = $article.find('div.article-list__item-title').text().trim();
                    const hasBadge = $article.find('span.article-list__item-badge').length > 0;
                    const badgeCount = hasBadge ? $article.find('span.article-list__item-badge span').text().trim() : '0';
                    
                    articlesToProcess.push({
                        index: index,
                        element: $article,
                        title: title,
                        newCount: badgeCount,
                        hasNewComments: hasBadge,
                        updateType: '调试模式'
                    });
                });
                
                console.log(LOG_PREFIX, `📋 将处理 ${articlesToProcess.length} 篇文章`);
            } else {
                console.log(LOG_PREFIX, '🎯 生产模式：只处理有新留言的文章');
                
                // 🔍 检查当前选中文章的留言筛选状态（仅用于第一个文章，因为它默认已打开）
                let firstArticleFilterStatus = 'unknown';
                let firstArticleUpdateCount = 0;
                
                try {
                    const $filterText = $('div.filter-bar li.comment-dropdown-item div.weui-desktop-tooltip__wrp span.weui-desktop-form__dropdown__value');
                    if ($filterText && $filterText.length > 0) {
                        const filterText = $filterText.html();
                        if (filterText) {
                            if (filterText.includes('有更新')) {
                                firstArticleFilterStatus = 'has_updates';
                                const updateMatch = filterText.match(/有更新\((\d+)条\)/);
                                if (updateMatch) {
                                    firstArticleUpdateCount = parseInt(updateMatch[1]);
                                    console.log(LOG_PREFIX, `🔍 第一个文章留言筛选状态: 有更新(${firstArticleUpdateCount}条)`);
                                }
                            } else if (filterText.includes('全部留言')) {
                                firstArticleFilterStatus = 'all_comments';
                                console.log(LOG_PREFIX, `🔍 第一个文章留言筛选状态: 全部留言（非新留言或已读）`);
                            } else {
                                console.log(LOG_PREFIX, `🔍 第一个文章留言筛选状态: ${filterText}`);
                            }
                        }
                    }
                } catch (e) {
                    console.warn(LOG_PREFIX, '⚠️ 检查第一个文章筛选状态失败:', e);
                }
                
                $articles.each(function(index) {
                    const $article = $(this);
                    const hasBadge = $article.find('span.article-list__item-badge').length > 0;
                    
                    // 🔍 判断逻辑：
                    // 1. 第一个文章：如果没有红点，通过留言筛选状态判断是否有新留言
                    // 2. 其他文章：有红点标记才处理
                    
                    let shouldProcess = false;
                    let updateType = '未知';
                    let newCount = '0';
                    
                    if (index === 0) {
                        // 第一个文章特殊处理
                        if (hasBadge) {
                            // 有红点，肯定是新留言
                            shouldProcess = true;
                            updateType = '红点标记';
                            newCount = $article.find('span.article-list__item-badge span').text().trim();
                        } else if (firstArticleFilterStatus === 'has_updates') {
                            // 没有红点，但筛选器显示"有更新"，说明是新留言
                            shouldProcess = true;
                            updateType = '筛选状态-有更新';
                            newCount = String(firstArticleUpdateCount);
                        } else if (firstArticleFilterStatus === 'all_comments') {
                            // 筛选器显示"全部留言"，说明不是新留言或已读
                            shouldProcess = false;
                            updateType = '已读或非新留言';
                        }
                    } else {
                        // 其他文章：只看红点标记
                        if (hasBadge) {
                            shouldProcess = true;
                            updateType = '红点标记';
                            newCount = $article.find('span.article-list__item-badge span').text().trim();
                        }
                    }
                    
                    if (shouldProcess) {
                        const title = $article.find('div.article-list__item-title').text().trim();
                        
                        articlesToProcess.push({
                            index: index,
                            element: $article,
                            title: title,
                            newCount: newCount,
                            hasNewComments: true,
                            updateType: updateType
                        });
                    }
                });
                
                console.log(LOG_PREFIX, `🆕 其中 ${articlesToProcess.length} 篇有新留言`);
                if (articlesToProcess.length > 0) {
                    articlesToProcess.forEach((article, idx) => {
                        console.log(LOG_PREFIX, `   ${idx + 1}. ${article.title.substring(0, 30)}... [${article.updateType}] (${article.newCount}条)`);
                    });
                }
            }

            if (articlesToProcess.length === 0) {
                console.log(LOG_PREFIX, '⚠️ 没有需要处理的文章，开始监听...');
                startListeningWithoutAutoRefresh();
                return;
            }

            /**
             * 处理需要点击的文章（正常流程）
             */
            async function processArticleWithClick(articleInfo) {
                // 🎭 拟人化：点击前犹豫一下
                await humanDelay(800, 1500);
                
                // 🎭 拟人化：偶尔先滚动到文章位置
                if (Math.random() < 0.4) {
                    console.log(LOG_PREFIX, '👀 浏览文章列表...');
                    await humanScroll(randomDelay(-50, 100));
                    await sleep(randomDelay(500, 1200));
                }

                const clickSuccess = await retryOperation(
                    async () => {
                        return await humanClick(
                            articleInfo.element.find('div.article-list__item-title'),
                            `文章: ${articleInfo.title.substring(0, 20)}...`
                        );
                    },
                    CONFIG.MAX_RETRIES,
                    '点击文章'
                );

                if (!clickSuccess) {
                    console.error(LOG_PREFIX, '⏭️ 跳过此文章，继续下一篇');
                    return false;
                }

                // 🎭 拟人化：等待页面加载时添加更多延迟
                console.log(LOG_PREFIX, '⏳ 等待详情页加载...');
                await sleep(randomDelay(1000, 2000));
                
                const detailPageLoaded = await verifyPageLoaded([
                    'div.comment-list__item-container',
                    'span.comment-nickname'
                ], CONFIG.PAGE_LOAD_TIMEOUT);

                if (!detailPageLoaded) {
                    console.warn(LOG_PREFIX, '⚠️ 详情页加载不完整，尝试继续采集...');
                }
                
                return true;
            }

            for (let i = 0; i < articlesToProcess.length; i++) {
                const articleInfo = articlesToProcess[i];
                console.log(LOG_PREFIX, `\n${'='.repeat(60)}`);
                console.log(LOG_PREFIX, `📝 处理第 ${i+1}/${articlesToProcess.length} 篇文章`);
                console.log(LOG_PREFIX, `📌 文章: ${articleInfo.title.substring(0, 50)}...`);
                console.log(LOG_PREFIX, `🆕 新留言: ${articleInfo.newCount}条 | 标记: ${articleInfo.hasNewComments ? '有' : '无'}`);
                console.log(LOG_PREFIX, `🔍 检测类型: ${articleInfo.updateType}`);
                console.log(LOG_PREFIX, '='.repeat(60));

                // 🎯 特殊处理：如果是第一个文章且筛选状态为"有更新"，说明已经默认加载了详情
                const isFirstArticleWithUpdate = (articleInfo.index === 0 && 
                    (articleInfo.updateType === '筛选状态-有更新' || articleInfo.updateType === '红点标记'));
                
                if (isFirstArticleWithUpdate) {
                    console.log(LOG_PREFIX, '✅ 第一个文章已默认加载详情，跳过点击步骤，直接采集...');
                    
                    // 🎭 拟人化：等待一下，模拟"阅读"状态
                    await humanDelay(1000, 2000);
                    
                    // 验证详情页是否已加载
                    const detailPageLoaded = await verifyPageLoaded([
                        'div.comment-list__item-container',
                        'span.comment-nickname'
                    ], CONFIG.PAGE_LOAD_TIMEOUT);
                    
                    if (!detailPageLoaded) {
                        console.warn(LOG_PREFIX, '⚠️ 详情页未加载，尝试点击文章...');
                        // 降级方案：如果详情页未加载，则执行正常的点击流程
                        const clickSuccess = await processArticleWithClick(articleInfo);
                        if (!clickSuccess) {
                            continue;
                        }
                    }
                } else {
                    // 🎭 其他文章：正常点击流程
                    console.log(LOG_PREFIX, '🖱️ 需要点击文章进入详情...');
                    const clickSuccess = await processArticleWithClick(articleInfo);
                    if (!clickSuccess) {
                        continue;
                    }
                }

                // 🎭 拟人化：进入详情页后先"阅读"一下（滚动查看）
                console.log(LOG_PREFIX, '👁️ 浏览留言内容...');
                await humanScroll(randomDelay(200, 500));
                await sleep(randomDelay(1500, 3000));
                
                if (Math.random() < 0.3) {
                    await humanScroll(randomDelay(100, 300));
                    await sleep(randomDelay(800, 1500));
                }

                const $nicknames = await waitForJQueryElement('div.comment-list__item-container span.comment-nickname');
                
                if ($nicknames && $nicknames.length > 0) {
                    console.log(LOG_PREFIX, `👥 找到 ${$nicknames.length} 个留言者`);
                    
                    let commentCount = 0;
                    $nicknames.each(function() {
                        if (DEBUG_CONFIG.MAX_COMMENTS_PER_ARTICLE > 0 && commentCount >= DEBUG_CONFIG.MAX_COMMENTS_PER_ARTICLE) {
                            console.log(LOG_PREFIX, `⏹️ 已达到每篇文章最大留言数限制 (${DEBUG_CONFIG.MAX_COMMENTS_PER_ARTICLE})`);
                            return false;
                        }
                        
                        try {
                            const $nicknameSpan = $(this);
                            const nickname = $nicknameSpan.find('span').first().html();
                            const isPublicAccount = $nicknameSpan.find('i.icon-public-account').length > 0;
                            
                            if (nickname && isPublicAccount) {
                                if (!publicAccountSet.has(nickname)) {
                                    publicAccountSet.add(nickname);
                                    allComments.push({
                                        nickname: nickname,
                                        articleTitle: articleInfo.title,
                                        isPublicAccount: true,
                                        collectedAt: new Date().toISOString()
                                    });
                                    commentCount++;
                                    console.log(LOG_PREFIX, `  ✓ 发现公众号: ${nickname}`);
                                }
                            }
                        } catch (e) {
                            console.warn(LOG_PREFIX, '⚠️ 处理留言者时出错:', e);
                        }
                    });
                } else {
                    console.warn(LOG_PREFIX, '⚠️ 未找到任何留言者');
                }

                // 🎭 拟人化：采集完成后，"思考"一下再处理下一篇
                console.log(LOG_PREFIX, '💭 浏览完毕，准备处理下一篇...');
                await humanDelay(1000, 2000);

                // 🎯 如果不是最后一篇文章，直接点击下一篇文章
                if (i < articlesToProcess.length - 1) {
                    const nextArticleInfo = articlesToProcess[i + 1];
                    console.log(LOG_PREFIX, `🖱️ 直接点击下一篇文章: ${nextArticleInfo.title.substring(0, 30)}...`);
                    
                    // 🎭 拟人化：点击前犹豫一下
                    await humanDelay(800, 1500);
                    
                    // 偶尔先滚动到文章位置
                    if (Math.random() < 0.4) {
                        console.log(LOG_PREFIX, '👀 浏览文章列表...');
                        await humanScroll(randomDelay(-50, 100));
                        await sleep(randomDelay(500, 1200));
                    }
                    
                    const clickSuccess = await retryOperation(
                        async () => {
                            return await humanClick(
                                nextArticleInfo.element.find('div.article-list__item-title'),
                                `下一篇文章: ${nextArticleInfo.title.substring(0, 20)}...`
                            );
                        },
                        CONFIG.MAX_RETRIES,
                        '点击下一篇文章'
                    );
                    
                    if (!clickSuccess) {
                        console.error(LOG_PREFIX, '❌ 点击下一篇文章失败，跳过');
                        continue;
                    }
                    
                    // 🎭 拟人化：等待新文章详情页加载
                    console.log(LOG_PREFIX, '⏳ 等待新文章详情页加载...');
                    await sleep(randomDelay(1000, 2000));
                    
                    const detailPageLoaded = await verifyPageLoaded([
                        'div.comment-list__item-container',
                        'span.comment-nickname'
                    ], CONFIG.PAGE_LOAD_TIMEOUT);
                    
                    if (!detailPageLoaded) {
                        console.warn(LOG_PREFIX, '⚠️ 新文章详情页加载不完整，尝试继续采集...');
                    }
                    
                    console.log(LOG_PREFIX, '☕ 休息一下，准备采集新文章留言...');
                    await humanDelay(2000, 4000);
                    
                    if (Math.random() < 0.2) {
                        const extraBreak = randomDelay(2000, 5000);
                        console.log(LOG_PREFIX, `📱 短暂休息: ${extraBreak}ms`);
                        await sleep(extraBreak);
                    }
                } else {
                    console.log(LOG_PREFIX, '✅ 所有文章已处理完毕');
                }
            }

            // 📊 打印完整的采集结果汇总
            console.log(LOG_PREFIX, '\n' + '='.repeat(80));
            console.log(LOG_PREFIX, '🎉 采集流程完成！');
            console.log(LOG_PREFIX, '='.repeat(80));
            console.log(LOG_PREFIX, `📈 处理文章数: ${articlesToProcess.length} 篇`);
            console.log(LOG_PREFIX, `👥 采集公众号数: ${allComments.length} 个`);
            console.log(LOG_PREFIX, `⏱️ 完成时间: ${new Date().toLocaleString('zh-CN')}`);
            console.log(LOG_PREFIX, '='.repeat(80));
            
            if (allComments.length > 0) {
                console.log(LOG_PREFIX, '\n📋 采集到的公众号列表:');
                console.table(allComments.map((item, index) => ({
                    '序号': index + 1,
                    '公众号名称': item.nickname,
                    '文章来源': item.articleTitle.substring(0, 30) + '...',
                    '采集时间': new Date(item.collectedAt).toLocaleString('zh-CN')
                })));
                
                console.log(LOG_PREFIX, '\n📤 准备发送数据到服务器...');
                await sendDataToRpamcp(allComments);
            } else {
                console.log(LOG_PREFIX, '\n⚠️ 本次未采集到新数据');
                console.log(LOG_PREFIX, '💡 可能原因:');
                console.log(LOG_PREFIX, '   1. 所有文章都没有公众号留言');
                console.log(LOG_PREFIX, '   2. 已开启 DEBUG_MODE=false，只处理有新留言的文章');
                console.log(LOG_PREFIX, '   3. 新留言的红点标记已被清除');
            }

            console.log(LOG_PREFIX, '\n' + '='.repeat(80));
            console.log(LOG_PREFIX, '👂 进入监听模式，等待新留言...');
            console.log(LOG_PREFIX, '💡 提示: 当有新留言时，脚本会自动重新进入留言管理页采集');
            console.log(LOG_PREFIX, '💡 重要: 不会自动刷新页面，您可以看到完整的日志输出');
            console.log(LOG_PREFIX, '='.repeat(80) + '\n');

            startListeningWithoutAutoRefresh();
        }, randomDelay(2000, 3000));
    }

    async function sendDataToRpamcp(data) {
        const timestamp = new Date().toISOString();
        const payload = {
            source: 'wechat-comments',
            timestamp: timestamp,
            data: data,
            count: data.length,
            debugMode: DEBUG_CONFIG.DEBUG_MODE
        };

        const jsonData = JSON.stringify(payload, null, 2);
        const curlCommand = generateCurlCommand(API_ENDPOINT, jsonData);
        
        console.log(LOG_PREFIX, '\n' + '='.repeat(60));
        console.log(LOG_PREFIX, '📤 CURL 调试命令:');
        console.log(curlCommand);
        console.log(LOG_PREFIX, '='.repeat(60) + '\n');

        if (DEBUG_CONFIG.DRY_RUN) {
            console.log(LOG_PREFIX, '⚠️  Dry Run 模式：跳过实际发送');
            console.log(LOG_PREFIX, '💡 提示: 您可以复制上面的 curl 命令手动测试\n');
            return;
        }

        console.log(LOG_PREFIX, '📤 正在发送数据到服务器...');

        try {
            await new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: 'POST',
                    url: API_ENDPOINT,
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    data: jsonData,
                    timeout: 10000,
                    onload: function(response) {
                        console.log(LOG_PREFIX, `📥 HTTP 状态码: ${response.status}`);
                        console.log(LOG_PREFIX, `📥 响应内容: ${response.responseText}`);
                        
                        if (response.status >= 200 && response.status < 300) {
                            console.log(LOG_PREFIX, '✅ 数据发送成功');
                            resolve(response);
                        } else {
                            console.error(LOG_PREFIX, `❌ 数据发送失败: ${response.status}`);
                            reject(new Error(`HTTP ${response.status}`));
                        }
                    },
                    onerror: function(error) {
                        console.error(LOG_PREFIX, '❌ 网络请求失败:', error);
                        reject(error);
                    },
                    ontimeout: function() {
                        console.error(LOG_PREFIX, '❌ 请求超时');
                        reject(new Error('Request timeout'));
                    }
                });
            });
        } catch (error) {
            console.error(LOG_PREFIX, '❌ 发送数据时出错:', error);
            console.log(LOG_PREFIX, '💡 请复制上面的 curl 命令手动执行进行调试\n');
        }
    }

    function generateCurlCommand(url, jsonData) {
        const escapedJson = jsonData.replace(/"/g, '\\"');
        
        const curlCmd = `curl -X POST "${url}" \\
  -H "Content-Type: application/json" \\
  -d "${escapedJson}"`;
        
        return curlCmd;
    }

    /**
     * 监听新留言（不自动刷新，检测到后重新点击"留言"菜单）
     */
    function startListeningWithoutAutoRefresh() {
        console.log(LOG_PREFIX, '👂 监听器已启动（每5秒检查一次，检测到新留言后重新进入留言管理页）');
        
        let lastNotificationTime = 0;
        const NOTIFICATION_COOLDOWN = 30000;
        let isProcessing = false; // 防止重复触发

        setInterval(async () => {
            if (isProcessing) {
                return; // 如果正在处理，跳过本次检查
            }

            try {
                const toast = document.querySelector('div.new-comment-toast');
                if (toast) {
                    const text = toast.textContent;
                    const match = text.match(/(\d+)条新留言/);
                    if (match) {
                        const newCount = parseInt(match[1]);
                        const now = Date.now();
                        
                        if (now - lastNotificationTime > NOTIFICATION_COOLDOWN) {
                            console.log(LOG_PREFIX, '\n' + '🔔'.repeat(20));
                            console.log(LOG_PREFIX, `🎉 发现 ${newCount} 条新留言！`);
                            console.log(LOG_PREFIX, '🔄 准备重新进入留言管理页采集...');
                            console.log(LOG_PREFIX, '🔔'.repeat(20) + '\n');
                            
                            isProcessing = true;
                            lastNotificationTime = now;
                            
                            // 播放提示音
                            try {
                                const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                                const oscillator = audioContext.createOscillator();
                                const gainNode = audioContext.createGain();
                                
                                oscillator.connect(gainNode);
                                gainNode.connect(audioContext.destination);
                                
                                oscillator.frequency.value = 800;
                                oscillator.type = 'sine';
                                gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
                                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
                                
                                oscillator.start(audioContext.currentTime);
                                oscillator.stop(audioContext.currentTime + 0.5);
                            } catch (e) {
                                // 忽略音频错误
                            }
                            
                            // 重新点击"留言"菜单进入管理页
                            await reEnterCommentPage();
                            
                            isProcessing = false;
                        }
                    }
                }
            } catch (e) {
                console.warn(LOG_PREFIX, '⚠️ 监听过程中出错:', e);
                isProcessing = false;
            }
        }, 5000);
    }

    /**
     * 重新进入留言管理页（通过点击"留言"菜单）
     */
    async function reEnterCommentPage() {
        console.log(LOG_PREFIX, '🔄 重新进入留言管理页...');
        
        try {
            // 查找并点击"留言"菜单
            const $commentMenu = await waitForJQueryElement(
                'ul.weui-desktop-sub-menu > li.weui-desktop-sub-menu__item span:contains("留言")',
                5000
            );
            
            if ($commentMenu && $commentMenu.length > 0) {
                console.log(LOG_PREFIX, '🖱️ 点击留言菜单...');
                await humanClick($commentMenu.first(), '留言菜单');
                
                // 等待页面跳转和加载
                console.log(LOG_PREFIX, '⏳ 等待留言管理页加载...');
                await sleep(3000);
                
                // 验证是否成功进入留言管理页
                const pageLoaded = await verifyPageLoaded([
                    'div.comment-articles',
                    'div.comment-article-list'
                ], 10000);
                
                if (pageLoaded) {
                    console.log(LOG_PREFIX, '✅ 成功进入留言管理页，重新开始采集流程...');
                    // 延迟后刷新页面以重新执行采集逻辑
                    await sleep(1000);
                    location.reload();
                } else {
                    console.error(LOG_PREFIX, '❌ 进入留言管理页失败');
                }
            } else {
                console.error(LOG_PREFIX, '❌ 未找到留言菜单');
            }
        } catch (error) {
            console.error(LOG_PREFIX, '❌ 重新进入留言管理页时出错:', error);
        }
    }

    /**
     * 监听新留言（旧版本，保留兼容）
     */
    function startListening() {
        console.log(LOG_PREFIX, '👂 开始监听新留言...');

        setInterval(() => {
            try {
                const toast = document.querySelector('div.new-comment-toast');
                if (toast) {
                    const text = toast.textContent;
                    const match = text.match(/(\d+)条新留言/);
                    if (match) {
                        console.log(LOG_PREFIX, `🔔 发现${match[1]}条新留言，刷新页面重新采集...`);
                        location.reload();
                    }
                }
            } catch (e) {
                console.warn(LOG_PREFIX, '⚠️ 监听过程中出错:', e);
            }
        }, 5000);
    }

    console.log(LOG_PREFIX, '🚀 公众号留言采集器已启动 v7.5 (监听优化版-不刷新)');
    console.log(LOG_PREFIX, `📍 当前页面: ${isCommentPage ? '留言管理页' : '首页'}`);

})();