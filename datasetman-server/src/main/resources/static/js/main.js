document.addEventListener('DOMContentLoaded', function() {
    // 0. 用户认证和登录状态管理
    function checkLoginStatus() {
        if (window.AppConfig.isLoggedIn()) {
            const username = window.AppConfig.getUsername();
            const usernameEl = document.getElementById('username');
            const logoutBtn = document.getElementById('logoutBtn');
            
            if (usernameEl) {
                usernameEl.textContent = username || '已登录';
                usernameEl.title = `当前用户: ${username || '已登录'}`;
            }
            if (logoutBtn) {
                logoutBtn.style.display = 'inline-block';
            }
        } else {
            // 未登录，跳转到登录页
            window.location.href = '/login.html';
        }
    }

    // 登出功能
    function logout() {
        window.AppConfig.logout();
    }

    // 页面加载时检查登录状态
    checkLoginStatus();

    // 绑定登出按钮
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            logout();
        });
    }

    // 全局变量：跟踪当前选中的数据源
    let selectedDataSource = null;
    
    // 隐藏所有组件的函数
    function hideAllComponents() {
        console.log('🔄 隐藏所有组件');

        // 隐藏所有可能的组件
        const components = [
            'registerEmbedded',
            'modelUpload',
            'modelDownload',
            'modelEdit',
            'parsingRules',
            'associationRules',
            'databaseTable',
            'dataVisualization',
            'modelDetail',
            'dataSourceList',
            'importData',
            'userManagement',
            'permissionManagement',
            'datasetHistory',
            'transformJob',
            'transformCompare',
            'transformManagement',
            'udfManagement',
            'fileSystemBrowser',
            'keyValueViewer',
            'semiStructuredViewer'
        ];
        
        components.forEach(componentId => {
            const component = document.getElementById(componentId);
            if (component) {
                // 只调用组件的hide方法，让组件自己管理隐藏逻辑
                if (typeof component.hide === 'function') {
                    component.hide();
                    console.log(`✅ 已隐藏组件: ${componentId}`);
                } else {
                    // 如果没有hide方法，使用基本的隐藏方式
                    component.removeAttribute('show');
                    component.setAttribute('hidden', '');
                    console.log(`✅ 已隐藏组件(基本方式): ${componentId}`);
                }
            }
        });
        
        // 额外清理：移除所有可能残留的动态创建的组件
        const workspace = document.querySelector('.workspace-content');
        if (workspace) {
            // 查找所有动态创建的组件并移除
            const dynamicComponents = workspace.querySelectorAll('visual-analysis, data-visualization');
            dynamicComponents.forEach(comp => {
                console.log(`🗑️ 移除动态组件: ${comp.tagName}`);
                comp.remove();
            });
        }
    }
    
    // 初始化时隐藏所有组件
    console.log('🏁 页面加载完成，初始化组件状态');
    hideAllComponents();
    
    // 将hideAllComponents暴露到全局作用域
    window.hideAllComponents = hideAllComponents;
    
    // 全局Loading功能
    window.showGlobalLoading = function(message = '正在加载...') {
        console.log('显示全局loading:', message);
        
        // 获取工作区容器
        const workspaceContent = document.querySelector('.workspace-content');
        if (!workspaceContent) {
            console.error('找不到workspace-content容器');
            return;
        }
        
        // 确保工作区容器有相对定位
        if (getComputedStyle(workspaceContent).position === 'static') {
            workspaceContent.style.position = 'relative';
        }
        
        // 检查是否已存在loading元素
        let loadingEl = workspaceContent.querySelector('.global-loading-overlay');
        if (!loadingEl) {
            loadingEl = document.createElement('div');
            loadingEl.className = 'global-loading-overlay';
            loadingEl.innerHTML = `
                <div class="global-loading-spinner">
                    <div class="global-spinner"></div>
                    <div class="global-loading-text">${message}</div>
                </div>
            `;
            workspaceContent.appendChild(loadingEl);
        } else {
            // 更新loading文字
            const textEl = loadingEl.querySelector('.global-loading-text');
            if (textEl) {
                textEl.textContent = message;
            }
        }
    };
    
    window.hideGlobalLoading = function() {
        console.log('隐藏全局loading');
        
        // 从工作区容器中移除loading元素
        const workspaceContent = document.querySelector('.workspace-content');
        if (workspaceContent) {
            const loadingEl = workspaceContent.querySelector('.global-loading-overlay');
            if (loadingEl) {
                loadingEl.remove();
            }
        }
    };
    
    // 0. 动态加载数据源树
    loadDataSourceTree();
    
    // 1. 明暗模式切换
    const themeToggle = document.getElementById('themeToggle');
    const html = document.documentElement;

    themeToggle.addEventListener('click', function() {
        if (html.classList.contains('light-mode')) {
            html.classList.remove('light-mode');
            html.classList.add('dark-mode');
        } else {
            html.classList.remove('dark-mode');
            html.classList.add('light-mode');
        }
    });

    // 2.5. 右侧数据集库树形节点点击事件
    const rightSidebarTree = document.querySelector('.right-sidebar .tree');
    if (rightSidebarTree) {
        const rightTreeNodes = rightSidebarTree.querySelectorAll('.tree-node');
        rightTreeNodes.forEach(node => {
            node.addEventListener('click', function(e) {
                e.stopPropagation();
                
                // 确保只处理右侧的节点
                if (!this.closest('.right-sidebar')) {
                    return;
                }
                
                // 先清除所有选中状态（仅限右侧）
                rightSidebarTree.querySelectorAll('.tree-node.active').forEach(n => n.classList.remove('active'));
                
                // 设置当前选中
                this.classList.add('active');
                
                // 展开收起（如果有子节点）
                if (this.querySelector('.tree-children')) {
                    this.classList.toggle('expanded');
                }
            });
        });
    }

    // 3. 顶部选项卡切换
    const topTabs = document.querySelectorAll('.nav-tabs .tab:not(.dropdown)');
    topTabs.forEach(tab => {
        tab.addEventListener('click', function(e) {
            e.stopPropagation();
            topTabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
        });
    });

    // 4. 二级选项卡切换
    const subTabs = document.querySelectorAll('.sub-tab-bar .sub-tab');
    subTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            subTabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
        });
    });

    // 5. 下拉菜单
    const dataSourceDropdown = document.getElementById('dataSourceDropdown');
    const datasetDropdown = document.getElementById('datasetDropdown');
    const jobDropdown = document.getElementById('jobDropdown');
    const functionDropdown = document.getElementById('functionDropdown');
    const toolDropdown = document.getElementById('toolDropdown');
    const settingsDropdown = document.getElementById('settingsDropdown');
    const helpDropdown = document.getElementById('helpDropdown');
    const userDropdown = document.getElementById('userDropdown');

    const allDropdowns = [dataSourceDropdown, datasetDropdown, jobDropdown, functionDropdown, toolDropdown, helpDropdown, userDropdown, settingsDropdown];

    function closeAllDropdowns(except = null) {
        allDropdowns.forEach(dropdown => {
            if (dropdown && dropdown !== except) {
                dropdown.classList.remove('active');
            }
        });
    }

    dataSourceDropdown.addEventListener('click', function(e) {
        e.stopPropagation();
        closeAllDropdowns(this);
        this.classList.toggle('active');
    });

    datasetDropdown.addEventListener('click', function(e) {
        e.stopPropagation();
        closeAllDropdowns(this);
        this.classList.toggle('active');
    });

    jobDropdown.addEventListener('click', function(e) {
        e.stopPropagation();
        closeAllDropdowns(this);
        this.classList.toggle('active');
    });

    functionDropdown.addEventListener('click', function(e) {
        e.stopPropagation();
        closeAllDropdowns(this);
        this.classList.toggle('active');
    });

    toolDropdown.addEventListener('click', function(e) {
        e.stopPropagation();
        closeAllDropdowns(this);
        this.classList.toggle('active');
    });

    helpDropdown.addEventListener('click', function(e) {
        e.stopPropagation();
        closeAllDropdowns(this);
        this.classList.toggle('active');
    });

    userDropdown.addEventListener('click', function(e) {
        e.stopPropagation();
        closeAllDropdowns(this);
        this.classList.toggle('active');
    });

    settingsDropdown.addEventListener('click', function(e) {
        e.stopPropagation();
        closeAllDropdowns(this);
        this.classList.toggle('active');
    });

    // 绑定字体大小子菜单点击事件
    document.querySelectorAll('.dropdown-menu .submenu li[data-scale]').forEach(li => {
        li.addEventListener('click', function(e) {
            e.stopPropagation();
            e.stopImmediatePropagation(); // Prevent other event handlers from firing
            const scale = this.dataset.scale;
            applyFontScale(scale);
            closeAllDropdowns();
        });
    });

    document.addEventListener('click', function() {
        closeAllDropdowns();
    });

    const menuItems = document.querySelectorAll('.dropdown-menu li');
    menuItems.forEach(item => {
        item.addEventListener('click', function(e) {
            e.stopPropagation();

            // Skip font size submenu items - they are handled separately
            if (this.hasAttribute('data-scale')) {
                return;
            }

            // Skip submenu parents (has-submenu class) - they don't have actions
            if (this.classList.contains('has-submenu')) {
                return;
            }

            const menuId = this.id;
            console.log(`菜单项被点击: ${menuId}`);

            // 根据菜单ID获取对应的动作
            const action = getMenuAction(menuId);
            
            if (action) {
                // 根据动作类型执行相应操作
                switch (action) {
                    case 'showDataSourceList':
                        console.log('数据源管理菜单被点击');
                        showComponent('dataSourceList');
                        break;
                    case 'console.log':
                        console.log('数据源管理被点击');
                        break;
                    case 'showRegisterEmbedded':
                        console.log('注册异构数据源菜单被点击');
                        showComponent('registerEmbedded');
                        break;
                    case 'showImportData':
                        console.log('导入数据菜单被点击');
                        showComponent('importData');
                        break;
                    case 'showModelUpload':
                        console.log('上传模型文件菜单被点击');
                        showComponent('modelUpload');
                        break;
                    case 'handleDownload':
                        console.log('下载模型文件菜单被点击');
                        const selectedModel = getSelectedModel();
                        showComponent('modelDownload', selectedModel);
                        break;
                    case 'handleDeleteModel':
                        console.log('移除数据集菜单被点击');
                        const selectedModelDelete = getSelectedModel();
                        if (selectedModelDelete) {
                            showDeleteConfirmDialog(selectedModelDelete);
                        } else {
                            showWorkspaceMessage('请先选择要移除的数据集', 'warning');
                        }
                        break;
                    case 'handleEditModel':
                        console.log('编辑元模型档案菜单被点击');
                        const selectedModelEdit = getSelectedModel();
                        if (selectedModelEdit && selectedModelEdit.version) {
                            showComponent('modelEdit', selectedModelEdit);
                        } else {
                            showWorkspaceMessage('请先选择要编辑的模型版本', 'warning');
                        }
                        break;
                    case 'showDatasetCreate':
                        console.log('创建数据集菜单被点击');
                        const datasetDialogCreate = document.getElementById('datasetDialog');
                        if (datasetDialogCreate) {
                            datasetDialogCreate.showCreate();
                        }
                        break;
                    case 'showDatasetEdit':
                        console.log('编辑数据集菜单被点击');
                        const selectedDatasetEdit = getSelectedDataset();
                        if (selectedDatasetEdit) {
                            const datasetDialogEdit = document.getElementById('datasetDialog');
                            if (datasetDialogEdit) {
                                datasetDialogEdit.showEdit({ storagePath: selectedDatasetEdit });
                            }
                        } else {
                            showWorkspaceMessage('请先选择要编辑的数据集', 'warning');
                        }
                        break;
                    case 'handleDeleteDataset':
                        console.log('删除数据集菜单被点击');
                        const selectedDatasetDelete = getSelectedDataset();
                        if (selectedDatasetDelete) {
                            showDeleteDatasetConfirmDialog({ storagePath: selectedDatasetDelete });
                        } else {
                            showWorkspaceMessage('请先选择要删除的数据集', 'warning');
                        }
                        break;
                    case 'showParsingRules':
                        console.log('配置解析规则菜单被点击');
                        showComponent('parsingRules');
                        break;
                    case 'showAssociationRules':
                        console.log('关联规则配置菜单被点击');
                        showComponent('associationRules');
                        break;
                    case 'showTransformOrchestrate':
                        console.log('编排Transform作业菜单被点击');
                        showComponent('transformCompare');
                        break;
                    case 'showTransformJobManagement':
                        console.log('Transform任务管理菜单被点击');
                        showComponent('transformJob');
                        break;
                    case 'showVisualAnalysis':
                        console.log('数值与曲线分析菜单被点击');
                        // 先清空工作区
                        clearWorkspace();
                        showVisualAnalysis();
                        return;
                    case 'clearWorkspace':
                        console.log('清空工作区菜单被点击');
                        clearWorkspace();
                        return;
                    case 'setLightMode':
                        console.log('明亮模式菜单被点击');
                        const html = document.documentElement;
                        html.classList.remove('dark-mode');
                        html.classList.add('light-mode');
                        break;
                    case 'setDarkMode':
                        console.log('暗黑模式菜单被点击');
                        const htmlDark = document.documentElement;
                        htmlDark.classList.remove('light-mode');
                        htmlDark.classList.add('dark-mode');
                        break;
                    case 'showUserManual':
                        console.log('用户手册菜单被点击');
                        if (typeof window.showUserManual === 'function') {
                            window.showUserManual();
                        }
                        break;
                    case 'showAbout':
                        console.log('关于菜单被点击');
                        showAbout();
                        break;
                    default:
                        console.warn(`未知的菜单动作: ${action}`);
                }
            } else {
                // 处理特殊菜单项（用户管理和修改密码）
                if (menuId === 'userManagementMenuItem') {
                    console.log('用户管理菜单被点击');
                    showComponent('userManagement');
                } else if (menuId === 'permissionManagementMenuItem') {
                    console.log('权限管理菜单被点击');
                    showComponent('permissionManagement');
                } else if (menuId === 'changePasswordMenuItem') {
                    console.log('修改密码菜单被点击');
                    const changePasswordComponent = document.querySelector('change-password');
                    if (changePasswordComponent) {
                        changePasswordComponent.show();
                    }
                } else if (menuId === 'menu-transform-management') {
                    console.log('Transform管理菜单被点击');
                    showComponent('transformManagement');
                } else if (menuId === 'menu-udf-management') {
                    console.log('UDF管理菜单被点击');
                    showComponent('udfManagement');
                } else if (this.dataset && this.dataset.scale) {
                    document.documentElement.classList.remove('font-scale-1', 'font-scale-1-15', 'font-scale-1-3', 'font-scale-1-5');
                    const scaleClassMap = {
                        '1': 'font-scale-1',
                        '1.15': 'font-scale-1-15',
                        '1.3': 'font-scale-1-3',
                        '1.5': 'font-scale-1-5'
                    };
                    document.documentElement.classList.add(scaleClassMap[this.dataset.scale] || 'font-scale-1');
                    document.querySelectorAll('.dropdown-menu .submenu li[data-scale]').forEach(li => li.classList.remove('active'));
                    this.classList.add('active');
                    localStorage.setItem('fontScale_' + (window.AppConfig.getUsername() || 'default'), this.dataset.scale);
                } else {
                    console.warn(`未找到菜单ID ${menuId} 的对应动作`);
                }
            }
        });
    });

    // 获取当前选中的模型
    function getSelectedModel() {
        const rightSidebarTree = document.querySelector('.right-sidebar .tree');
        if (!rightSidebarTree) return null;
        
        const activeNode = rightSidebarTree.querySelector('.tree-node.active');
        if (!activeNode) return null;
        
        const span = activeNode.querySelector('span');
        if (!span) return null;
        
        const nodeName = span.textContent.trim();
        console.log('选中的节点名称:', nodeName);
        
        // 排除明显的路径节点
        if (nodeName === 'filesystem' || nodeName === 'models') {
            console.log('选中的是路径节点，不是有效的模型节点');
            return null;
        }
        
        // 检查是否是最后一级叶子节点（没有子节点的节点）
        const childrenContainer = activeNode.querySelector('.tree-children');
        if (!childrenContainer || childrenContainer.children.length === 0) {
            // 如果是最后一级叶子节点，获取其直接父节点的模型名称
            const parentNode = activeNode.closest('.tree-children')?.parentElement;
            const parentSpan = parentNode?.querySelector('span');
            if (parentSpan) {
                const modelName = parentSpan.textContent.trim();
                // 再次检查父节点也不是路径节点
                if (modelName !== 'filesystem' && modelName !== 'models') {
                    console.log('找到模型名称（最后一级叶子节点的父节点）:', modelName, '版本号（最后一级叶子节点）:', nodeName);
                    return {
                        name: modelName,
                        version: nodeName
                    };
                }
            }
        } else {
            // 如果是模型名称节点，检查是否有最后一级叶子节点子节点
            if (childrenContainer && childrenContainer.children.length > 0) {
                // 检查子节点是否包含最后一级叶子节点
                const childNodes = childrenContainer.querySelectorAll('.tree-node');
                let hasLeafChild = false;
                
                childNodes.forEach(childNode => {
                    const childChildrenContainer = childNode.querySelector('.tree-children');
                    if (!childChildrenContainer || childChildrenContainer.children.length === 0) {
                        hasLeafChild = true;
                    }
                });
                
                if (hasLeafChild) {
                    // 如果有最后一级叶子节点子节点，返回模型名称（表示删除所有版本，不显示版本号）
                    console.log('找到模型名称（有最后一级叶子节点子节点）:', nodeName, '将删除所有版本');
                    return {
                        name: nodeName,
                        version: null // null表示删除所有版本
                    };
                } else {
                    // 如果没有最后一级叶子节点子节点，不返回有效信息
                    console.log('找到模型名称但无最后一级叶子节点子节点:', nodeName, '不是有效的模型结构');
                    return null;
                }
            } else {
                // 如果没有子节点，不返回有效信息
                console.log('找到模型名称但无子节点:', nodeName, '不是有效的模型结构');
                return null;
            }
        }
        
        console.log('未找到有效的模型信息');
        return null;
    }

    // 获取当前选中的数据集
    function getSelectedDataset() {
        const rightSidebarTree = document.querySelector('.right-sidebar .tree');
        if (!rightSidebarTree) return null;
        
        const activeNode = rightSidebarTree.querySelector('.tree-node.active');
        if (!activeNode) return null;
        
        const span = activeNode.querySelector('span');
        if (!span) return null;
        
        const nodeName = span.textContent.trim();
        console.log('选中的数据集节点名称:', nodeName);
        
        // 排除路径节点
        if (nodeName === '数据集库' || nodeName === 'filesystem') {
            console.log('选中的是路径节点，不是有效的数据集节点');
            return null;
        }
        
        // 获取全路径
        const fullPath = activeNode.getAttribute('data-full-path');
        console.log('选中的数据集全路径:', fullPath);
        
        // 返回全路径
        return fullPath;
    }

    // 显示数据集删除确认对话框
    async function showDeleteDatasetConfirmDialog(dataset) {
        // 如果是字符串路径，包装成对象
        if (typeof dataset === 'string') {
            dataset = { storagePath: dataset };
        }

        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;

        const datasetName = dataset.name || dataset.datasetName || dataset.storagePath || '未命名';
        const version = dataset.version || 'v1.0.0';
        
        overlay.innerHTML = `
            <div style="
                background: white;
                border-radius: 8px;
                padding: 24px;
                min-width: 400px;
                max-width: 500px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            ">
                <div style="font-size: 18px; font-weight: 600; margin-bottom: 16px; color: #1f2937;">确认删除数据集</div>
                <div style="margin-bottom: 24px; color: #595959; line-height: 1.6;">
                    确定要删除数据集 <span style="color: #ff4d4f; font-weight: 600;">${datasetName}</span> 吗？<br>
                    版本: ${version}<br><br>
                    <strong>此操作不可恢复，删除后将无法找回！</strong>
                </div>
                <div style="display: flex; justify-content: flex-end; gap: 12px;">
                    <button class="btn-cancel" style="
                        padding: 8px 16px;
                        border-radius: 4px;
                        border: none;
                        cursor: pointer;
                        font-size: 14px;
                        background: #f0f0f0;
                        color: #595959;
                    ">取消</button>
                    <button class="btn-confirm-delete" style="
                        padding: 8px 16px;
                        border-radius: 4px;
                        border: none;
                        cursor: pointer;
                        font-size: 14px;
                        background: #ff4d4f;
                        color: white;
                    ">确认删除</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        const cancelBtn = overlay.querySelector('.btn-cancel');
        const confirmBtn = overlay.querySelector('.btn-confirm-delete');

        cancelBtn.addEventListener('click', () => {
            document.body.removeChild(overlay);
        });

        confirmBtn.addEventListener('click', async () => {
            confirmBtn.disabled = true;
            confirmBtn.textContent = '删除中...';

            try {
                const path = dataset.storagePath;
                console.log('准备删除数据集, path:', path);

                const result = await window.AppConfig.delete('dataset', 'delete', { path });

                if (result.success) {
                    showToast('数据集删除成功', 'success');

                    // 刷新右侧树
                    const datasetTree = document.querySelector('.right-sidebar .tree');
                    if (datasetTree) {
                        const activeNode = datasetTree.querySelector('.tree-node.active');
                        if (activeNode) {
                            activeNode.remove();
                        }
                    }
                } else {
                    throw new Error(result.message || '删除失败');
                }

            } catch (error) {
                console.error('删除数据集失败:', error);
                showToast('删除失败: ' + error.message, 'error');
            } finally {
                if (overlay.parentNode) {
                    document.body.removeChild(overlay);
                }
            }
        });

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                document.body.removeChild(overlay);
            }
        });
    }

    // 5. 右侧树节点单击事件 - 显示模型详情或数据集详情
    document.querySelectorAll('.right-sidebar .tree-node').forEach(node => {
        node.addEventListener('click', function() {
            console.log('单击节点:', this);
            
            // 尝试获取选中的数据集
            const selectedDataset = getSelectedDataset();
            if (selectedDataset) {
                console.log('显示数据集详情:', selectedDataset);
                const datasetHistory = document.getElementById('datasetHistory');
                if (datasetHistory) {
                    clearWorkspace();
                    datasetHistory.show(selectedDataset);
                }
                return;
            }
            
            // 尝试获取选中的模型（向后兼容）
            const selectedModel = getSelectedModel();
            const modelDetail = document.getElementById('modelDetail');
            if (selectedModel && selectedModel.version && modelDetail) {
                console.log('显示模型详情:', selectedModel);
                showComponent('modelDetail', selectedModel);
            } else {
                console.log('未获取到有效信息、点击的是父节点或模型组件不存在');
            }
        });
    });

    // 6. 功能按钮点击事件 - 使用ID绑定而非文本绑定
    const addBtns = document.querySelectorAll('.func-btn, .ribbon-btn');
    console.log('找到的功能按钮数量:', addBtns.length);
    
    addBtns.forEach((btn, index) => {
        const btnId = btn.id;
        console.log(`按钮 ${index}: "${btnId}"`);
        
        // 根据按钮ID获取对应的动作
        const action = getButtonAction(btnId);
        
        if (action) {
            console.log(`✅ 找到按钮 ${btnId}，绑定事件`);
            btn.addEventListener('click', function() {
                console.log(`${btnId} 按钮被点击`);
                
                // 根据动作类型执行相应操作
                switch (action) {
                    case 'showVisualAnalysis':
                        // 先清空工作区
                        clearWorkspace();
                        showVisualAnalysis();
                        break;
                    case 'showRegisterEmbedded':
                        showComponent('registerEmbedded');
                        break;
                    case 'showModelUpload':
                        showComponent('modelUpload');
                        break;
                    case 'showImportData':
                        showComponent('importData');
                        break;
                    case 'handleDownload':
                        const selectedModel = getSelectedModel();
                        if (selectedModel) {
                            showComponent('modelDownload', selectedModel);
                        } else {
                            showWorkspaceMessage('请先选择要下载的模型版本', 'warning');
                        }
                        break;
                    case 'handleDeleteModel':
                        try {
                            const selectedModel = getSelectedModel();
                            console.log('选中的模型:', selectedModel);
                            if (selectedModel) {
                                showDeleteConfirmDialog(selectedModel);
                            } else {
                                showWorkspaceMessage('请先选择要删除的数据集', 'warning');
                            }
                        } catch (error) {
                            console.error('删除按钮点击出错:', error);
                        }
                        break;
                    case 'handleRemoveDataSource':
                        handleRemoveDataSource();
                        break;
                    case 'showDataSourceList':
                        showComponent('dataSourceList');
                        break;
                    case 'handleEditModel':
                        try {
                            const selectedModel = getSelectedModel();
                            console.log('选中的模型:', selectedModel);
                            if (selectedModel && selectedModel.version) {
                                showComponent('modelEdit', selectedModel);
                            } else {
                                showWorkspaceMessage('请先选择要编辑的模型版本', 'warning');
                            }
                        } catch (error) {
                            console.error('编辑按钮点击出错:', error);
                        }
                        break;
                    case 'showDatasetCreate':
                        console.log('创建数据集按钮被点击');
                        const datasetDialogCreate = document.getElementById('datasetDialog');
                        if (datasetDialogCreate) {
                            datasetDialogCreate.showCreate();
                        }
                        break;
                    case 'showDatasetEdit':
                        console.log('编辑数据集按钮被点击');
                        const selectedDatasetEdit = getSelectedDataset();
                        if (selectedDatasetEdit) {
                            const datasetDialogEdit = document.getElementById('datasetDialog');
                            if (datasetDialogEdit) {
                                datasetDialogEdit.showEdit({ storagePath: selectedDatasetEdit });
                            }
                        } else {
                            showWorkspaceMessage('请先选择要编辑的数据集', 'warning');
                        }
                        break;
                    case 'handleDeleteDataset':
                        console.log('删除数据集按钮被点击');
                        const selectedDatasetDelete = getSelectedDataset();
                        if (selectedDatasetDelete) {
                            showDeleteDatasetConfirmDialog({ storagePath: selectedDatasetDelete });
                        } else {
                            showWorkspaceMessage('请先选择要删除的数据集', 'warning');
                        }
                        break;
                    case 'showParsingRules':
                        showComponent('parsingRules');
                        break;
                    case 'showAssociationRules':
                        showComponent('associationRules');
                        break;
                    case 'showTransformOrchestrate':
                        showComponent('transformCompare');
                        break;
                    case 'showTransformJobManagement':
                        showComponent('transformJob');
                        break;
                    case 'showTransformManagement':
                        showComponent('transformManagement');
                        break;
                    case 'showUdfManagement':
                        showComponent('udfManagement');
                        break;
                    default:
                        console.warn(`未知的按钮动作: ${action}`);
                }
            });
        } else {
            console.warn(`未找到按钮ID ${btnId} 的对应动作`);
        }
    });

    // 6.5 监听 dataset-history 和 dataset-dialog 组件的事件
    const datasetHistory = document.getElementById('datasetHistory');
    const datasetDialog = document.getElementById('datasetDialog');

    if (datasetHistory) {
        // 监听编辑事件
        datasetHistory.addEventListener('edit-dataset', function(e) {
            console.log('详情页编辑按钮被点击:', e.detail);
            if (datasetDialog && e.detail) {
                datasetDialog.showEdit(e.detail);
            }
        });

        // 监听删除事件
        datasetHistory.addEventListener('dataset-deleted', function(e) {
            console.log('详情页删除按钮被点击，数据集已删除:', e.detail);
            // 刷新右侧树
            const rightSidebarTree = document.querySelector('.right-sidebar .tree');
            if (rightSidebarTree) {
                const activeNode = rightSidebarTree.querySelector('.tree-node.active');
                if (activeNode) {
                    activeNode.remove();
                }
            }
            // 隐藏详情页
            datasetHistory.hide();
        });
    }

    if (datasetDialog) {
        // 监听保存成功事件
        datasetDialog.addEventListener('dataset-saved', function(e) {
            console.log('数据集保存成功:', e.detail);
            showToast(e.detail.mode === 'create' ? '数据集创建成功' : '数据集保存成功', 'success');
            // 刷新数据源树以更新右侧数据集列表
            if (window.loadDataSourceTree) {
                window.loadDataSourceTree();
            }
        });
    }

    // 7. 监听内嵌页面提交事件
    const embedded = document.getElementById('registerEmbedded');
    if (embedded) {
        embedded.addEventListener('submit-success', function(e) {
            console.log('数据源注册成功:', e.detail);
            
            // 在工作区显示成功消息，但保留组件
            const workspaceContent = document.querySelector('.workspace-content');
            if (workspaceContent) {
                const successMsg = document.createElement('div');
                successMsg.style.cssText = `
                    padding: 20px;
                    background: #f0f9ff;
                    border: 1px solid #bfdbfe;
                    border-radius: 6px;
                    color: #1e40af;
                    margin: 20px;
                    text-align: center;
                `;
                successMsg.innerHTML = `
                    <h4 style="margin: 0 0 8px 0;">✅ 数据源注册成功</h4>
                    <p style="margin: 0; color: #64748b;">数据源 "${e.detail.formData.alias}" 已成功注册</p>
                `;
                
                // 在工作区开头插入成功消息，不清空整个工作区
                workspaceContent.insertBefore(successMsg, workspaceContent.firstChild);
                
                setTimeout(() => {
                    if (successMsg.parentNode) {
                        successMsg.remove();
                    }
                }, 5000);
            }
        });
    }

    // 监听模型上传成功事件
    const modelUpload = document.getElementById('modelUpload');
    if (modelUpload) {
        modelUpload.addEventListener('upload-success', function(e) {
            console.log('模型上传成功:', e.detail);
            
            // 只使用公共的toast提示，不在工作区显示HTML提示
            // 上传组件内部已经调用了showMessage，这里不需要重复显示
        });
    }

    // 监听模型下载成功事件
    const modelDownload = document.getElementById('modelDownload');
    if (modelDownload) {
        modelDownload.addEventListener('download-success', function(e) {
            console.log('模型下载成功:', e.detail);
            
            // 在工作区显示成功消息
            const workspaceContent = document.querySelector('.workspace-content');
            if (workspaceContent) {
                const successMsg = document.createElement('div');
                successMsg.style.cssText = `
                    padding: 20px;
                    background: #f0fdf4;
                    border: 1px solid #bbf7d0;
                    border-radius: 6px;
                    color: #166534;
                    margin: 20px;
                    font-size: 14px;
                `;
                successMsg.innerHTML = `
                    <strong>模型下载成功！</strong><br>
                    模型名称: ${e.detail.modelName}<br>
                    版本号: ${e.detail.modelVersion}
                `;
                
                // 在工作区开头插入成功消息，不清空整个工作区
                workspaceContent.insertBefore(successMsg, workspaceContent.firstChild);
                
                setTimeout(() => {
                    if (successMsg.parentNode) {
                        successMsg.remove();
                    }
                }, 5000);
            }
        });
    }

    // 显示删除确认对话框
    function showDeleteConfirmDialog(selectedModel) {
        // 创建对话框HTML
        const dialogHtml = `
            <div class="delete-confirm-dialog" style="
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 2000;
            ">
                <div class="dialog-content" style="
                    background: white;
                    border-radius: 8px;
                    padding: 24px;
                    max-width: 400px;
                    width: 90%;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
                ">
                    <h3 style="margin: 0 0 16px 0; font-size: 18px; color: #1f2329;">确认删除</h3>
                    <p style="margin: 0 0 24px 0; color: #646a73; line-height: 1.5;">
                        ${selectedModel.version ? 
                            `确定要删除数据集 <strong>${selectedModel.name}</strong> (版本: ${selectedModel.version}) 吗？` :
                            `确定要删除数据集 <strong>${selectedModel.name}</strong> 及其所有版本吗？`
                        }<br><br>
                        <span style="color: #f5222d;">此操作不可恢复！</span>
                    </p>
                    <div class="dialog-actions" style="display: flex; gap: 12px; justify-content: flex-end;">
                        <button class="cancel-btn" style="
                            padding: 8px 16px;
                            border: 1px solid #c9cdd4;
                            border-radius: 4px;
                            background: white;
                            color: #1f2329;
                            cursor: pointer;
                            font-size: 14px;
                        ">取消</button>
                        <button class="confirm-btn" style="
                            padding: 8px 16px;
                            border: 1px solid #f5222d;
                            border-radius: 4px;
                            background: #f5222d;
                            color: white;
                            cursor: pointer;
                            font-size: 14px;
                        ">确认删除</button>
                    </div>
                </div>
            </div>
        `;
        
        // 创建对话框元素
        const dialog = document.createElement('div');
        dialog.innerHTML = dialogHtml;
        document.body.appendChild(dialog);
        
        // 绑定事件
        const cancelBtn = dialog.querySelector('.cancel-btn');
        const confirmBtn = dialog.querySelector('.confirm-btn');
        
        const closeDialog = () => {
            document.body.removeChild(dialog);
        };
        
        cancelBtn.addEventListener('click', closeDialog);
        
        confirmBtn.addEventListener('click', () => {
            closeDialog();
            deleteModelAsset(selectedModel);
        });
        
        // 点击遮罩关闭
        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) {
                closeDialog();
            }
        });
        
        // ESC键关闭
        const handleEsc = (e) => {
            if (e.key === 'Escape') {
                closeDialog();
                document.removeEventListener('keydown', handleEsc);
            }
        };
        document.addEventListener('keydown', handleEsc);
    }

    // 删除数据集
    window.deleteModelAsset = async function(selectedModel) {
        try {
            console.log('删除数据集:', selectedModel);
            
            // 构建查询参数
            const params = new URLSearchParams({
                name: selectedModel.name
            });
            
            // 如果有版本号，添加版本参数
            if (selectedModel.version) {
                params.append('version', selectedModel.version);
            }
            
            // 使用新的API配置
            const result = await window.AppConfig.delete('model', 'delete', {
                name: selectedModel.name,
                version: selectedModel.version
            });
            
            console.log('删除响应:', result);
            
            if (result.success) {
                showWorkspaceMessage(`数据集 "${selectedModel.name}" 删除成功`, 'success');
                
                // 从右侧树中移除该节点
                removeModelFromTree(selectedModel);
                
                // 清除选中状态
                const rightSidebarTree = document.querySelector('.right-sidebar .tree');
                if (rightSidebarTree) {
                    const activeNodes = rightSidebarTree.querySelectorAll('.tree-node.active');
                    activeNodes.forEach(node => node.classList.remove('active'));
                }
            } else {
                showWorkspaceMessage(result.message || '删除失败', 'error');
            }
        } catch (error) {
            console.error('删除数据集失败:', error);
            showWorkspaceMessage('删除失败，请稍后重试', 'error');
        }
    }

    // 从树中移除模型节点
    function removeModelFromTree(selectedModel) {
        const rightSidebarTree = document.querySelector('.right-sidebar .tree');
        if (!rightSidebarTree) return;
        
        const allNodes = rightSidebarTree.querySelectorAll('.tree-node');
        
        allNodes.forEach(node => {
            const span = node.querySelector('span');
            if (span) {
                const nodeName = span.textContent.trim();
                
                // 如果匹配要删除的模型名称，删除整个模型（包括所有版本）
                if (nodeName === selectedModel.name) {
                    node.remove();
                }
                // 如果只匹配版本号，只删除该版本节点
                else if (selectedModel.version && nodeName === selectedModel.version) {
                    node.remove();
                }
            }
        });
    }

    // 其他功能函数...

    // 删除数据源的处理函数
    function handleRemoveDataSource() {
        if (!selectedDataSource) {
            showWorkspaceMessage('请先选择要删除的数据源', 'warning');
            return;
        }

        // 获取最父级数据源名称
        const parentDataSource = getParentDataSource(selectedDataSource);
        
        showConfirmDialog(
            `确定要删除数据源 "${parentDataSource}" 吗？`,
            '删除后无法恢复，请谨慎操作。',
            () => {
                removeDataSource(parentDataSource);
            }
        );
    }

    // 获取最父级数据源名称（仅限左侧数据资源库）
    function getParentDataSource(selectedNode) {
        const leftSidebarTree = document.querySelector('.left-sidebar .tree');
        if (!leftSidebarTree) return selectedNode;
        
        const activeNode = leftSidebarTree.querySelector('.tree-node.active');
        if (!activeNode) return selectedNode;
        
        // 向上遍历找到最顶层的父节点
        let parentNode = activeNode;
        while (parentNode.parentElement && parentNode.parentElement.classList.contains('tree-children')) {
            parentNode = parentNode.parentElement.parentElement;
        }
        
        const parentText = parentNode.querySelector('span')?.textContent?.trim();
        return parentText || selectedNode;
    }

    // 显示确认对话框
    function showConfirmDialog(title, message, onConfirm) {
        // 移除已存在的对话框
        const existingDialog = document.querySelector('.confirm-dialog-overlay');
        if (existingDialog) {
            existingDialog.remove();
        }

        const overlay = document.createElement('div');
        overlay.className = 'confirm-dialog-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            opacity: 0;
            transition: opacity 0.3s ease;
        `;

        const dialog = document.createElement('div');
        dialog.className = 'confirm-dialog';
        dialog.style.cssText = `
            background: white;
            border-radius: 8px;
            padding: 24px;
            max-width: 400px;
            width: 90%;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
            transform: scale(0.9);
            transition: transform 0.3s ease;
        `;

        dialog.innerHTML = `
            <h3 style="margin: 0 0 12px 0; font-size: 18px; font-weight: 600; color: #1f2329;">${title}</h3>
            <p style="margin: 0 0 24px 0; color: #646a73; line-height: 1.5;">${message}</p>
            <div style="display: flex; justify-content: flex-end; gap: 12px;">
                <button class="confirm-btn cancel" style="
                    padding: 8px 16px;
                    border: 1px solid #c9cdd4;
                    border-radius: 4px;
                    background: white;
                    color: #1f2329;
                    cursor: pointer;
                    font-size: 14px;
                    transition: all 0.2s;
                ">取消</button>
                <button class="confirm-btn confirm" style="
                    padding: 8px 16px;
                    border: 1px solid #f53f3f;
                    border-radius: 4px;
                    background: #f53f3f;
                    color: white;
                    cursor: pointer;
                    font-size: 14px;
                    transition: all 0.2s;
                ">确认删除</button>
            </div>
        `;

        overlay.appendChild(dialog);
        document.body.appendChild(overlay);

        // 动画显示
        setTimeout(() => {
            overlay.style.opacity = '1';
            dialog.style.transform = 'scale(1)';
        }, 10);

        // 绑定事件
        const cancelBtn = dialog.querySelector('.cancel');
        const confirmBtn = dialog.querySelector('.confirm');

        cancelBtn.addEventListener('click', () => {
            closeDialog();
        });

        confirmBtn.addEventListener('click', () => {
            closeDialog();
            onConfirm();
        });

        // 点击遮罩关闭
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                closeDialog();
            }
        });

        // ESC键关闭
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                closeDialog();
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);

        function closeDialog() {
            overlay.style.opacity = '0';
            dialog.style.transform = 'scale(0.9)';
            setTimeout(() => {
                if (overlay.parentNode) {
                    overlay.remove();
                }
            }, 300);
        }
    }

    // 删除数据源的API调用
    async function removeDataSource(alias) {
        try {
            console.log('开始删除数据源:', alias);
            
            // 获取当前选中的数据源节点信息
            const leftSidebarTree = document.querySelector('.left-sidebar .tree');
            const activeNode = leftSidebarTree?.querySelector('.tree-node.active');
            
            if (!activeNode) {
                showWorkspaceMessage('请先选择要删除的数据源', 'warning');
                return;
            }
            
            // 构建请求体数据
            const dataSourceInfo = {
                id: activeNode.dataset.id || 0,
                ip: activeNode.dataset.ip || '',
                port: parseInt(activeNode.dataset.port) || 0,
                type: parseInt(activeNode.dataset.type) || 0,
                schemaPrefix: null,
                dataPrefix: null
            };
            
            console.log('发送删除请求:', dataSourceInfo);
            
            // 使用新的API配置 - 后端接口是POST，需要传JSON body
            const result = await window.AppConfig.post('datasource', 'remove', dataSourceInfo);
            
            console.log('删除响应:', result);

            if (result.success) {
                showWorkspaceMessage(`数据源 "${alias}" 删除成功`, 'success');
                // 重新加载数据源树
                loadDataSourceTree();
                // 清除选中状态
                selectedDataSource = null;
                if (leftSidebarTree) {
                    leftSidebarTree.querySelectorAll('.tree-node.active').forEach(node => node.classList.remove('active'));
                }
            } else {
                showWorkspaceMessage(result.message || '删除失败', 'error');
            }
        } catch (error) {
            console.error('删除数据源失败:', error);
            showWorkspaceMessage('删除失败，请稍后重试', 'error');
        }
    }

    // 在工作区显示消息提示
    function showWorkspaceMessage(message, type = 'info') {
        if (window.CommonUtils && window.CommonUtils.showToast) {
            // 使用统一的 showToast
            window.CommonUtils.showToast(message, type);
        } else {
            // 回退实现
            console.warn(`[${type}] ${message}`);
        }
    }

    // 全局变量存储选中的测点
window.selectedDataPoints = new Set();

// 清空工作区
    function clearWorkspace() {
        console.log('🧹 清空工作区');
        
        // 隐藏所有可能显示的组件
        hideAllComponents();
        
        // 清除选中的测点
        if (window.selectedDataPoints) {
            window.selectedDataPoints.clear();
        }
        
        // 不清除导航树选中状态，只重置工作区相关的数据源
        // selectedDataSource = null; // 注释掉，保留数据源选择
        
        console.log('✅ 工作区已清空');
    }

// 显示数值与曲线分析
function showVisualAnalysis() {
    console.log('🚀 showVisualAnalysis() 函数被调用');
    
    // 创建并添加visual-analysis组件
    const visualAnalysis = document.createElement('visual-analysis');
    console.log('创建visual-analysis组件:', visualAnalysis);
    
    const workspace = document.querySelector('.workspace-content');
    if (workspace) {
        workspace.appendChild(visualAnalysis);
        console.log('组件已添加到工作区');
    } else {
        console.error('❌ 未找到工作区元素');
        return;
    }
    
    // 显示组件
    setTimeout(() => {
        console.log('调用visual-analysis.show()');
        visualAnalysis.show();
    }, 100);
    
    // 添加关闭事件监听
    visualAnalysis.addEventListener('close', () => {
        workspace.removeChild(visualAnalysis);
    });
    
    // 滚动到工作区
    workspace.scrollIntoView({ behavior: 'smooth' });
}

// 显示数据可视化
    function showDataVisualization(dataSource) {
        console.log('显示数据可视化:', dataSource);

        // 获取或创建数据可视化组件
        let dataViz = document.getElementById('dataVisualization');
        let isFirstLoad = false;

        // 检查当前显示的组件是否是 data-visualization
        const currentActiveComponent = document.querySelector('.workspace-content > [show]:not([hidden])');
        const isCurrentDataViz = currentActiveComponent && currentActiveComponent.id === 'dataVisualization';
        console.log('当前活动组件:', currentActiveComponent?.id, '是否为data-visualization:', isCurrentDataViz);
        
        if (!dataViz) {
            // 先清空工作区
            clearWorkspace();

            dataViz = document.createElement('data-visualization');
            dataViz.id = 'dataVisualization';
            const workspaceContent = document.querySelector('.workspace-content');
            if (workspaceContent) {
                workspaceContent.appendChild(dataViz);
                console.log('创建了新的数据可视化组件');
                isFirstLoad = true;
                console.log('🚀 第一次加载，isFirstLoad设置为:', isFirstLoad);
            } else {
                console.error('找不到workspace-content容器');
                return;
            }
        } else {
            console.log('使用现有的数据可视化组件');
            // 只有从其他组件切换过来时才清空工作区
            if (!isCurrentDataViz) {
                clearWorkspace();
                console.log('从其他组件切换，清空工作区');
            } else {
                console.log('在data-visualization组件内切换，不清空工作区');
            }
            // 隐藏databaseTable组件
            const databaseTable = document.getElementById('databaseTable');
            if (databaseTable) {
                if (typeof databaseTable.hide === 'function') {
                    databaseTable.hide();
                } else {
                    databaseTable.removeAttribute('show');
                    databaseTable.setAttribute('hidden', '');
                }
                console.log('✅ 已隐藏databaseTable组件');
            }
            // 检查是否是清空工作区后的第一次操作（没有选中的测点）
            if (window.selectedDataPoints.size === 0) {
                console.log('🎯 检测到清空工作区后的第一次操作，设置为首次加载');
                isFirstLoad = true;
            }
            console.log('🔄 后续切换，isFirstLoad保持为:', isFirstLoad);
        }
        
        // 只有真正的测点才添加到已选测点列表
        console.log('检查节点是否为测点:', dataSource);
        const isDataPoint = isActualDataPoint(dataSource);
        console.log('是否为测点:', isDataPoint);
        
        if (isDataPoint) {
            // 直接替换为当前点击的测点，不累积
            window.selectedDataPoints.clear();
            window.selectedDataPoints.add(dataSource);
            console.log('设置当前测点:', dataSource);
            // 每次切换测点都重新设置筛选条件
            isFirstLoad = true;
        } else {
            console.log('跳过非测点节点:', dataSource);
        }
        
        console.log('准备显示可视化组件，当前选中的测点:', Array.from(window.selectedDataPoints));
        
        // 如果组件已存在，同步其选中的测点
        if (dataViz.selectedPoints) {
            dataViz.selectedPoints = new Set(window.selectedDataPoints);
        }
        
        // 先显示组件，等待组件完全加载后再调用查询接口
        setTimeout(() => {
            const keepQueryConditions = !isFirstLoad;
            console.log('调用dataViz.show()，参数详情:');
            console.log('  - isFirstLoad:', isFirstLoad);
            console.log('  - keepQueryConditions:', keepQueryConditions);
            console.log('  - dataSource:', dataSource);
            console.log('  - selectedPoints:', Array.from(window.selectedDataPoints));
            
            // 检查组件是否已完全加载
            if (typeof dataViz.show === 'function') {
                dataViz.show(dataSource, Array.from(window.selectedDataPoints), null, keepQueryConditions);
            } else {
                console.error('dataViz.show 方法不存在，组件可能未完全加载');
                // 等待更长时间后重试
                setTimeout(() => {
                    if (typeof dataViz.show === 'function') {
                        dataViz.show(dataSource, Array.from(window.selectedDataPoints), null, keepQueryConditions);
                    } else {
                        console.error('重试后仍然无法找到 dataViz.show 方法');
                    }
                }, 500);
            }
            // 不在这里调用queryAndDisplayData，让组件自己处理数据加载
        }, 200); // 增加等待时间到200ms
    }

    // 查询并显示数据
    async function queryAndDisplayData(currentPath, selectedPoints, dataViz) {
        try {
            console.log('开始查询数据，当前路径:', currentPath, '选中测点:', selectedPoints);
            
            // 显示全局loading
            window.showGlobalLoading('正在查询数据...');
            
            // 从data-visualization组件中获取筛选参数
            let startTime = null;
            let endTime = null;
            let aggregateType = null;
            let precision = null;
            let timePrecision = 7; // 默认毫秒
            
            const startTimeInput = dataViz.shadowRoot.getElementById('startTime');
            const endTimeInput = dataViz.shadowRoot.getElementById('endTime');
            const aggregationSelect = dataViz.shadowRoot.getElementById('aggregationFunction');
            const precisionInput = dataViz.shadowRoot.getElementById('precision');
            const timePrecisionSelect = dataViz.shadowRoot.getElementById('timePrecision');
            
            // 处理时间参数
            if (startTimeInput && startTimeInput.value) {
                startTime = new Date(startTimeInput.value).getTime();
            }
            if (endTimeInput && endTimeInput.value) {
                endTime = new Date(endTimeInput.value).getTime();
            }
            
            // 如果没有设置时间，但有快速选择的时间，使用快速选择的时间
            if (startTime === null && endTime === null) {
                const activeQuickBtn = dataViz.shadowRoot.querySelector('.quick-time-btn.active');
                if (activeQuickBtn) {
                    const range = activeQuickBtn.dataset.range;
                    const endTimeDate = new Date();
                    const startTimeDate = new Date();
                    
                    switch (range) {
                        case '1h':
                            startTimeDate.setHours(startTimeDate.getHours() - 1);
                            break;
                        case '6h':
                            startTimeDate.setHours(startTimeDate.getHours() - 6);
                            break;
                        case '24h':
                            startTimeDate.setHours(startTimeDate.getHours() - 24);
                            break;
                        case '7d':
                            startTimeDate.setDate(startTimeDate.getDate() - 7);
                            break;
                    }
                    
                    startTime = startTimeDate.getTime();
                    endTime = endTimeDate.getTime();
                }
            }
            
            // 处理聚合函数参数
            if (aggregationSelect && aggregationSelect.value) {
                aggregateType = parseInt(aggregationSelect.value);
            }
            
            // 处理时间间隔参数
            if (precisionInput && precisionInput.value) {
                precision = parseInt(precisionInput.value);
            }
            
            // 处理时间单位参数
            if (timePrecisionSelect && timePrecisionSelect.value) {
                timePrecision = parseInt(timePrecisionSelect.value);
            }
            
            // 构建请求体
            const requestBody = {
                paths: selectedPoints,
                startTime: startTime,
                endTime: endTime,
                aggregateType: aggregateType,
                timePrecision: timePrecision
            };
            
            // 只有当precision不为null时才添加precision参数
            if (precision !== null) {
                requestBody.precision = precision;
            }
            
            console.log('从筛选框获取的查询参数:', requestBody);
            
            // 使用新的API配置
            const result = await window.AppConfig.post('data', 'query', requestBody);
            
            if (result.success && result.data) {
                console.log('数据查询成功:', result.data);
                
                // 显示数据可视化组件，传递查询结果
                dataViz.show(currentPath, selectedPoints, result.data);
            } else if (result.success && (!result.data || !result.data.records || result.data.records.length === 0)) {
                // 接口成功但没有数据
                console.log('查询成功但没有数据');
                dataViz.show(currentPath, selectedPoints, null);
            } else {
                // 接口返回错误
                console.error('数据查询失败:', result.message);
                dataViz.showError('数据查询失败: ' + (result.message || '未知错误'));
            }
        } catch (error) {
            console.error('查询数据时发生错误:', error);
            dataViz.showError('网络错误，无法查询数据');
        } finally {
            // 隐藏全局loading
            window.hideGlobalLoading();
        }
    }

// 通用显示组件函数
    function showComponent(componentId, ...args) {
        console.log(`显示组件: ${componentId}`, args);

        // 弹窗组件不需要清空工作区
        const modalComponents = ['registerEmbedded', 'importData', 'modelUpload', 'modelDownload', 'modelEdit'];
        if (!modalComponents.includes(componentId)) {
            // 先清空工作区
            clearWorkspace();
        }

        console.log(`🔍 尝试获取组件: ${componentId}`);
        const component = document.getElementById(componentId);
        console.log(`🔍 获取到的组件:`, component);
        console.log(`🔍 组件类型:`, component ? component.constructor.name : 'null');
        console.log(`🔍 组件是否有show方法:`, component ? typeof component.show : 'null');

        if (component && typeof component.show === 'function') {
            component.show(...args);
            console.log(`✅ 组件 ${componentId} 已显示`);
        } else {
            console.error(`❌ 未找到组件或show方法: ${componentId}`);
            console.error(`❌ 详细信息:`, {
                componentId,
                componentExists: !!component,
                componentType: component ? component.constructor.name : 'null',
                hasShowMethod: component ? typeof component.show : 'null',
                allElements: document.querySelectorAll('model-upload'),
                allCustomElements: window.customElements ? Array.from(window.customElements) : 'customElements not available'
            });
        }
    }

    // 将showComponent暴露到全局作用域
    window.showComponent = showComponent;

    function showDatabaseTable(tableName) {
        showComponent('databaseTable', tableName);
    }

    function showFileSystemBrowser(path) {
        showComponent('fileSystemBrowser', path);
    }

    function showKeyValueViewer(path) {
        const viewer = document.querySelector('key-value-viewer');
        // 检查是否为通配符路径（hash结构）
        if (path.includes('*')) {
            // hash结构：设置通配符路径并显示组件
            viewer.setWildcardPath(path);
            showComponent('keyValueViewer');
        } else {
            // 普通路径：传递path给showComponent
            showComponent('keyValueViewer', path);
        }
    }

    function showSemiStructuredViewer(path) {
        showComponent('semiStructuredViewer', path);
    }

    // 从树中获取所有可用的测点
    function getAvailablePointsFromTree() {
        const points = [];
        const leftSidebarTree = document.querySelector('.left-sidebar .tree');
        if (!leftSidebarTree) return points;
        
        // 获取当前选中的数据源节点
        const activeDataSourceNode = leftSidebarTree.querySelector('.tree-node.active');
        if (!activeDataSourceNode) {
            console.log('没有选中的数据源');
            return points;
        }
        
        // 只在当前选中的数据源节点内查找测点
        const dataSourceChildren = activeDataSourceNode.querySelectorAll('.tree-node');
        dataSourceChildren.forEach(node => {
            const hasChildren = node.querySelector('.tree-children');
            const nodeText = node.querySelector('span')?.textContent?.trim();
            
            // 只添加最后一级节点且是真正的测点
            if (!hasChildren && isActualDataPoint(nodeText)) {
                points.push(nodeText);
                console.log('添加测点:', nodeText);
            } else {
                console.log('跳过节点:', {
                    nodeText,
                    hasChildren: !!hasChildren,
                    isDataPoint: isActualDataPoint(nodeText)
                });
            }
        });
        
        console.log('从当前选中数据源获取到的测点:', points);
        return points;
    }
    
    // 判断节点是否为真正的测点
    function isActualDataPoint(nodeText) {
        console.log('isActualDataPoint 检查:', nodeText);
        
        if (!nodeText) {
            console.log('-> 空字符串，返回 false');
            return false;
        }
        
        // 排除IP:port格式的数据源节点
        if (nodeText.includes(':')) {
            console.log('-> 包含冒号，返回 false');
            return false;
        }
        
        // 排除emoji图标（这些是数据源父节点的图标）
        const emojis = ['🔌', '📊', '📈', '📁', '🗄', '🍃', '⚡'];
        if (emojis.includes(nodeText)) {
            console.log('-> 是emoji图标，返回 false');
            return false;
        }
        
        // 排除常见的父节点名称
        const parentNodes = ['root', 'car', 'database', 'table', 'schema'];
        if (parentNodes.includes(nodeText.toLowerCase())) {
            console.log('-> 是父节点名称，返回 false');
            return false;
        }
        
        // 排除空字符串和纯数字
        if (!nodeText.trim() || /^\d+$/.test(nodeText.trim())) {
            console.log('-> 是空字符串或纯数字，返回 false');
            return false;
        }
        
        console.log('-> 通过所有检查，返回 true');
        return true;
    }
    
    // 判断节点是否为数据源父节点（有data-type属性的节点）
    function isDataSourceParentNode(node) {
        return node.hasAttribute('data-type') || 
               node.parentElement?.hasAttribute('data-type') ||
               node.closest('[data-type]') !== null;
    }

    // 根据数据源获取模拟测点数据
    function getMockPointsForDataSource(dataSource) {
        const pointMap = {
            'X022-CQ-1': ['speed', 'rpm', 'temperature', 'pressure'],
            'X022-CQ-2': ['voltage', 'current', 'power', 'frequency'],
            'X022-CQ-4': ['position_x', 'position_y', 'velocity', 'acceleration'],
            'table1': ['flow_rate', 'level', 'density', 'viscosity'],
            's1': ['speed', 'fuel_consumption', 'engine_temp', 'tire_pressure'],
            'g1': ['longitude', 'latitude', 'altitude', 'heading'],
            'root': ['humidity', 'air_pressure', 'wind_speed', 'temperature'],
            'car': ['throttle', 'brake', 'steering', 'gear'],
            'pg_meta': ['connections', 'query_time', 'cache_hit_rate', 'cpu_usage'],
            'influx_local': ['write_rate', 'read_rate', 'disk_usage', 'memory_usage']
        };
        
        // 如果是s1或g1，返回它们自己作为测点
        if (dataSource === 's1') {
            return ['s1_speed', 's1_temp', 's1_pressure', 's1_flow'];
        }
        if (dataSource === 'g1') {
            return ['g1_x', 'g1_y', 'g1_z', 'g1_angle'];
        }
        
        return pointMap[dataSource] || ['value1', 'value2', 'value3'];
    }
    
    // 动态加载数据源树
    async function loadDataSourceTree() {
        try {
            // 显示全局loading
            window.showGlobalLoading('正在加载数据资源...');
            
            // 同时显示右侧loading
            const rightSidebarTree = document.querySelector('.right-sidebar .tree');
            if (rightSidebarTree) {
                rightSidebarTree.innerHTML = '<div class="loading-placeholder">正在同步数据集...</div>';
            }
            
            // 使用新的API配置
            const result = await window.AppConfig.get('datasource', 'tree');
            
            if (result.success && result.data) {
                renderDataSourceTree(result.data);
                // 同步filesystem数据到右侧数据集库
                syncFilesystemToModelAssets(result.data);
            } else {
                console.error('加载数据源树失败:', result.message);
                document.getElementById('dataSourceTree').innerHTML = '<div class="error-placeholder">加载数据源失败</div>';
            }
        } catch (error) {
            console.error('加载数据源树异常:', error);
            document.getElementById('dataSourceTree').innerHTML = '<div class="error-placeholder">网络错误，无法加载数据源</div>';
        } finally {
            // 隐藏全局loading
            window.hideGlobalLoading();
        }
    }
    
    // 将字符串数组或对象数组转换为树结构
    function buildTreeFromStringArray(data) {
        const tree = {};
        
        // 判断数据格式：如果是对象数组，使用path和dataType字段；如果是字符串数组，使用字符串本身
        data.forEach(item => {
            const path = typeof item === 'string' ? item : item.path;
            const dataType = typeof item === 'string' ? null : item.dataType;
            
            const parts = path.split('.');
            let current = tree;
            
            parts.forEach((part, index) => {
                if (!current[part]) {
                    current[part] = {
                        name: part,
                        children: {},
                        fullPath: parts.slice(0, index + 1).join('.'),
                        isLeaf: index === parts.length - 1,
                        dataType: index === parts.length - 1 ? dataType : null
                    };
                }
                current = current[part].children;
            });
        });
        
        return tree;
    }
    
    // 渲染树节点HTML
    function renderTreeNodes(treeData, level = 0) {
        let html = '';
        
        Object.values(treeData).forEach(node => {
            const hasChildren = Object.keys(node.children).length > 0;
            const expandedClass = level < 2 ? 'expanded' : '';
            const nodeClass = `tree-node ${expandedClass}`;
            
            // 根据节点类型选择图标
            let iconHtml = '';
            if (hasChildren) {
                // 有子节点：检查是否为relational开头的根节点，显示数据库图标
                if (level === 0 && (node.name.startsWith('relational'))) {
                    iconHtml = `<span class="tree-icon relational-icon">🗄️</span>`;
                } else if (level === 0 && (node.name.startsWith('file_system'))) {
                    // file_system 为文件系统图标
                    iconHtml = `<span class="tree-icon file-system-icon">📁</span>`;
                } else if (level === 0 && (node.name.startsWith('semi_structured'))) {
                    // semi_structured 为 mongodb 图标
                    iconHtml = `<span class="tree-icon mongo-icon">🍃</span>`;
                } else if (level === 0 && (node.name.startsWith('key_value'))) {
                    // key_value 为 redis 图标
                    iconHtml = `<span class="tree-icon redis-icon">⚡</span>`;
                } else if (level === 0 && (node.name.startsWith('time_series'))) {
                    // time_series 为时序数据图标
                    iconHtml = `<span class="tree-icon timeseries-icon">📈</span>`;
                } else {
                    iconHtml = `<span class="tree-icon folder-icon">📈</span>`;
                }
            } else {
                // 没有子节点的叶子节点：根据数据类型显示图标
                const dataTypeIcons = {
                    0: '🔘',      // BOOLEAN(0) - 开关
                    1: '📈',      // INTEGER(1) - 曲线图
                    2: '📈',      // LONG(2) - 曲线图
                    3: '📈',      // FLOAT(3) - 曲线图
                    4: '📈',      // DOUBLE(4) - 曲线图
                    5: '📦'       // BINARY(5) - 包裹
                };
                const icon = dataTypeIcons[node.dataType] || '📈';
                iconHtml = `<span class="tree-icon">${icon}</span>`;
            }
            
            html += `
                <div class="${nodeClass}" data-full-path="${node.fullPath}" data-is-leaf="${node.isLeaf}" data-type="${node.dataType || ''}">
                    ${iconHtml}
                    <span class="tree-node-text">${node.name}</span>
            `;
            
            if (hasChildren) {
                html += '<div class="tree-children">';
                html += renderTreeNodes(node.children, level + 1);
                html += '</div>';
            }
            
            html += '</div>';
        });
        
        return html;
    }
    
    // 渲染数据源树
    function renderDataSourceTree(dataSources) {
        const treeContainer = document.getElementById('dataSourceTree');
        if (!dataSources || dataSources.length === 0) {
            treeContainer.innerHTML = '<div class="empty-placeholder">暂无数据资源</div>';
            return;
        }
        
        // 过滤掉 datasets 开头的数据源（这些数据源会移动到右侧数据集库显示）
        const filteredDataSources = dataSources.filter(item => {
            const path = typeof item === 'string' ? item : item.path;
            return !path || !path.startsWith('datasets');
        });
        
        // 将过滤后的字符串数组转换为树结构
        const treeData = buildTreeFromStringArray(filteredDataSources);
        
        // 渲染树HTML
        const treeHTML = renderTreeNodes(treeData);
        
        treeContainer.innerHTML = treeHTML;
        
        // 重新绑定树节点点击事件
        bindTreeEvents();
    }
    
    // 根据存储引擎类型获取图标
    function getStorageEngineIcon(type) {
        // 返回文字标识而不是图标，更明显
        const textMap = {
            0: '🔌',      // unknown
            1: '📊',       // iotdb12
            2: '📈',      // influxdb
            3: '📁',        // filesystem
            4: '🗄️',          // relational (MySQL, PostgreSQL等)
            5: '🍃',       // mongodb
            6: '⚡'        // redis
        };
        const icon = textMap[type] || '🗄️';
        console.log(`🔍 getStorageEngineIcon(${type}) = ${icon}`);
        return icon;
    }
    
    // 重新绑定树节点事件
    function bindTreeEvents() {
        const leftSidebarTree = document.querySelector('.left-sidebar .tree');
        if (leftSidebarTree) {
            const treeNodes = leftSidebarTree.querySelectorAll('.tree-node');
            treeNodes.forEach(node => {
                node.addEventListener('click', function(e) {
                    e.stopPropagation();
                    
                    // 确保只处理左侧的节点
                    if (!this.closest('.left-sidebar')) {
                        return;
                    }
                    
                    // 先清除所有选中状态（仅限左侧）
                    leftSidebarTree.querySelectorAll('.tree-node.active').forEach(n => n.classList.remove('active'));
                    
                    // 设置当前选中
                    this.classList.add('active');
                    
                    // 获取节点的完整路径
                    const fullPath = this.getAttribute('data-full-path');
                    const isLeaf = this.getAttribute('data-is-leaf') === 'true';
                    
                    if (fullPath && isLeaf) {
                        selectedDataSource = fullPath;

                        // 检查是否为key或value节点，如果是则查询hash结构
                        const parts = fullPath.split('.');
                        const lastPart = parts[parts.length - 1];
                        if (lastPart === 'key' || lastPart === 'value') {
                            // 使用通配符模式查询hash结构
                            const parentPath = parts.slice(0, -1).join('.');
                            const wildcardPath = parentPath + '*';
                            showKeyValueViewer(wildcardPath);
                        } else if (fullPath.startsWith('relational')) {
                            // 获取父节点路径作为tableName
                            const pathParts = fullPath.split('.');
                            const parentPath = pathParts.slice(0, -1).join('.');
                            showDatabaseTable(parentPath);
                        } else if (fullPath.startsWith('time_series')) {
                            // time_series 使用 data-visualization 页面
                            showDataVisualization(fullPath);
                        } else if (fullPath.startsWith('file_system')) {
                            // file_system 使用 file-system-browser 页面
                            showFileSystemBrowser(fullPath);
                        } else if (fullPath.startsWith('key_value')) {
                            // key_value 使用 key-value-viewer 页面
                            showKeyValueViewer(fullPath);
                        } else if (fullPath.startsWith('semi_structured')) {
                            // semi_structured 使用 semi-structured-viewer 页面
                            showSemiStructuredViewer(fullPath);
                        } else {
                            // 其他类型也使用 data-visualization 页面
                            showDataVisualization(fullPath);
                        }
                        
                                                                        
                                                
                        // 如果是最后一级节点且不是文件夹/数据库图标类数据源，则显示“选择数据源”按钮
                                                
                        
                                            }
                    
                    // 展开收起（如果有子节点）
                    if (this.querySelector('.tree-children')) {
                        this.classList.toggle('expanded');
                    }
                });
            });
        }
    }
    
    // 同步filesystem数据到右侧数据集库
    function syncFilesystemToModelAssets(allData) {
        try {
            // 过滤出以"datasets"开头的路径数据
            const filesystemData = allData.filter(item => {
                const path = typeof item === 'string' ? item : item.path;
                return path && path.startsWith('datasets');
            });
            
            console.log('过滤出的datasets数据:', filesystemData);
            
            if (filesystemData.length > 0) {
                // 获取右侧树容器
                const rightSidebarTree = document.querySelector('.right-sidebar .tree');
                if (!rightSidebarTree) return;
                
                // 构建树结构
                const treeMap = {};
                filesystemData.forEach(item => {
                    const path = typeof item === 'string' ? item : item.path;
                    const parts = path.split('.');
                    
                    let current = treeMap;
                    for (let i = 0; i < parts.length; i++) {
                        const part = parts[i];
                        if (!current[part]) {
                            current[part] = {
                                name: part,
                                children: {},
                                fullPath: parts.slice(0, i + 1).join('.'),
                                isLeaf: i === parts.length - 1,
                                level: i
                            };
                        }
                        current = current[part].children;
                    }
                });
                
                // 递归创建DOM树节点
                function createTreeNodes(nodes, container, level = 0) {
                    Object.values(nodes).forEach(node => {
                        const hasChildren = Object.keys(node.children).length > 0;
                        
                        // 创建树节点
                        const treeNode = document.createElement('div');
                        treeNode.className = hasChildren ? 'tree-node expanded' : 'tree-node';
                        treeNode.setAttribute('data-full-path', node.fullPath);
                        treeNode.setAttribute('data-is-leaf', node.isLeaf.toString());
                        
                        // 只有父节点（有子节点的）才有图标，子节点（版本号）没有图标
                        if (hasChildren) {
                            const icon = document.createElement('span');
                            icon.className = 'tree-icon';
                            icon.textContent = '📦';
                            treeNode.appendChild(icon);
                        }

                        // 添加节点名称
                        const span = document.createElement('span');
                        span.className = 'tree-node-text';
                        span.textContent = node.name;
                        treeNode.appendChild(span);
                        
                        // 如果有子节点，创建子容器并递归
                        if (hasChildren) {
                            const childrenContainer = document.createElement('div');
                            childrenContainer.className = 'tree-children';
                            createTreeNodes(node.children, childrenContainer, level + 1);
                            treeNode.appendChild(childrenContainer);
                        }
                        
                        // 添加到容器
                        container.appendChild(treeNode);
                    });
                }
                
                // 清空容器并创建新树
                rightSidebarTree.innerHTML = '';
                createTreeNodes(treeMap, rightSidebarTree);
                
                // 重新绑定右侧树节点事件（保持原有逻辑）
                const rightTreeNodes = rightSidebarTree.querySelectorAll('.tree-node');
                rightTreeNodes.forEach(node => {
                    node.addEventListener('click', function(e) {
                        e.stopPropagation();

                        // 确保只处理右侧的节点
                        if (!this.closest('.right-sidebar')) {
                            return;
                        }

                        // 先清除所有选中状态（仅限右侧）
                        rightSidebarTree.querySelectorAll('.tree-node.active').forEach(n => n.classList.remove('active'));

                        // 设置当前选中
                        this.classList.add('active');

                        // 展开收起（如果有子节点）
                        if (this.querySelector('.tree-children')) {
                            this.classList.toggle('expanded');
                        }

                        // 检查是否是叶子节点
                        const isLeaf = this.getAttribute('data-is-leaf') === 'true';
                        if (!isLeaf) {
                            // 父级节点只负责展开和收起，不显示详情
                            return;
                        }

                        // 只有叶子节点才显示数据集详情
                        const selectedDataset = getSelectedDataset();
                        if (selectedDataset) {
                            console.log('显示数据集详情:', selectedDataset);
                            const datasetHistory = document.getElementById('datasetHistory');
                            if (datasetHistory) {
                                clearWorkspace();
                                datasetHistory.show(selectedDataset);
                            }
                            return;
                        }
                    });
                });
                
            } else {
                // 如果没有filesystem数据，显示空状态
                const rightSidebarTree = document.querySelector('.right-sidebar .tree');
                if (rightSidebarTree) {
                    rightSidebarTree.innerHTML = '<div class="empty-placeholder">暂无数据集</div>';
                }
            }
            
        } catch (error) {
            console.error('同步filesystem数据到数据集库失败:', error);
            const rightSidebarTree = document.querySelector('.right-sidebar .tree');
            if (rightSidebarTree) {
                rightSidebarTree.innerHTML = '<div class="error-placeholder">同步数据集失败</div>';
            }
        }
    }
    
    // 将loadDataSourceTree函数暴露到全局作用域，供其他组件调用
    window.loadDataSourceTree = loadDataSourceTree;
});

// 确保函数在全局作用域可用
window.loadDataSourceTree = async function() {
    console.log('🔄 loadDataSourceTree 被调用，开始重新加载数据源树...');
    try {
        // 显示全局loading
        window.showGlobalLoading('正在加载数据资源...');
        
        // 同时显示右侧loading
        const rightSidebarTree = document.querySelector('.right-sidebar .tree');
        if (rightSidebarTree) {
            rightSidebarTree.innerHTML = '<div class="loading-placeholder">正在同步数据集...</div>';
        }
        
        console.log('🔄 调用接口:', window.AppConfig.getApiUrl('datasource', 'tree'));
        const result = await window.AppConfig.get('datasource', 'tree');
        
        console.log('🔄 接口响应:', result);
        
        if (result.success && result.data) {
            renderDataSourceTree(result.data);
            // 同步filesystem数据到右侧数据集库
            syncFilesystemToModelAssets(result.data);
            console.log('🔄 数据源树重新加载完成');
        } else {
            console.error('加载数据源树失败:', result.message);
            document.getElementById('dataSourceTree').innerHTML = '<div class="error-placeholder">加载数据源失败</div>';
        }
    } catch (error) {
        console.error('加载数据源树异常:', error);
        document.getElementById('dataSourceTree').innerHTML = '<div class="error-placeholder">网络错误，无法加载数据源</div>';
    } finally {
        // 隐藏全局loading
        window.hideGlobalLoading();
    }
};

// 全局函数：显示修改密码弹窗
window.showChangePasswordModal = function() {
    const changePasswordComponent = document.querySelector('change-password');
    if (changePasswordComponent) {
        changePasswordComponent.show(); // 使用 show() 而不是 showModal()
    }
};

// 用户头像点击事件（修改密码）- 已移至 change-password 组件内部处理

// 全局函数：显示用户手册
window.showUserManual = function() {
    // 创建模态框
    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'modal-overlay';
    modalOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
    `;
    
    // 创建模态框内容容器
    const modalContainer = document.createElement('div');
    modalContainer.style.cssText = `
        width: 90%;
        height: 90%;
        max-width: 1400px;
        max-height: 900px;
        background: white;
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        overflow: hidden;
        position: relative;
        display: flex;
        flex-direction: column;
    `;
    
    // 加载用户手册内容
    fetch('./components/user-manual/user-manual.html')
        .then(response => response.text())
        .then(html => {
            modalContainer.innerHTML = html;
            
            // 获取用户手册容器并确保可以滚动
            const userManualContainer = modalContainer.querySelector('.user-manual-container');
            if (userManualContainer) {
                userManualContainer.style.overflowY = 'auto';
                userManualContainer.style.height = '100%';
            }
            
            // 适配暗黑模式
            if (document.documentElement.classList.contains('dark-mode')) {
                modalContainer.querySelector('.user-manual-container').classList.add('dark-mode');
            }
        })
        .catch(error => {
            console.error('加载用户手册失败:', error);
            modalContainer.innerHTML = `
                <div style="padding: 40px; text-align: center;">
                    <h3>加载用户手册失败</h3>
                    <p>请检查网络连接或稍后重试</p>
                    <button onclick="this.closest('.modal-overlay').remove()" style="
                        padding: 8px 16px;
                        background: #1890ff;
                        color: white;
                        border: none;
                        border-radius: 4px;
                        cursor: pointer;
                    ">关闭</button>
                </div>
            `;
        });
    
    // 点击遮罩关闭
    modalOverlay.addEventListener('click', function(e) {
        if (e.target === modalOverlay) {
            modalOverlay.remove();
        }
    });
    
    // 添加到页面
    modalOverlay.appendChild(modalContainer);
    document.body.appendChild(modalOverlay);
    
    // ESC键关闭
    const escHandler = function(e) {
        if (e.key === 'Escape') {
            modalOverlay.remove();
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);
};

// 全局函数：关闭用户手册
window.closeUserManual = function() {
    const modal = document.querySelector('.modal-overlay');
    if (modal) {
        modal.remove();
    }
};

// 全局函数：关闭关于对话框
window.closeAbout = function() {
    const modal = document.querySelector('.modal-overlay');
    if (modal) {
        modal.remove();
    }
};

// 全局函数：显示关于对话框
window.showAbout = function() {
    // 创建模态框
    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'modal-overlay';
    modalOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
    `;
    
    // 创建模态框内容容器
    const modalContainer = document.createElement('div');
    modalContainer.style.cssText = `
        width: 500px;
        max-width: 90vw;
        height: 600px;
        max-height: 90vh;
        background: white;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
        overflow: hidden;
        position: relative;
    `;
    
    // 加载关于页面内容
    fetch('./components/about/about.html')
        .then(response => response.text())
        .then(html => {
            modalContainer.innerHTML = html;
            
            // 适配暗黑模式
            if (document.documentElement.classList.contains('dark-mode')) {
                modalContainer.querySelector('.about-container').classList.add('dark-mode');
            }
        })
        .catch(error => {
            console.error('加载关于页面失败:', error);
            modalContainer.innerHTML = `
                <div style="padding: 40px; text-align: center; height: 100%; display: flex; flex-direction: column; justify-content: center;">
                    <h3>加载失败</h3>
                    <p>无法加载关于页面</p>
                    <button onclick="this.closest('.modal-overlay').remove()" style="
                        padding: 8px 16px;
                        background: #1890ff;
                        color: white;
                        border: none;
                        border-radius: 4px;
                        cursor: pointer;
                        margin-top: 20px;
                    ">关闭</button>
                </div>
            `;
        });
    
    // 点击遮罩关闭
    modalOverlay.addEventListener('click', function(e) {
        if (e.target === modalOverlay) {
            modalOverlay.remove();
        }
    });
    
    // 添加到页面
    modalOverlay.appendChild(modalContainer);
    document.body.appendChild(modalOverlay);
    
    // ESC键关闭
    const escHandler = function(e) {
        if (e.key === 'Escape') {
            modalOverlay.remove();
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);
};
