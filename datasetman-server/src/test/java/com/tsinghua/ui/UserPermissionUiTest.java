package com.tsinghua.ui;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.openqa.selenium.By;
import org.openqa.selenium.WebElement;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 用户管理与权限管理模块UI自动化测试
 * 对应测试用例: TC-UI-USER-001 ~ TC-UI-USER-012, TC-UI-CRUD-001 ~ TC-UI-CRUD-007,
 *              TC-UI-PWD-001 ~ TC-UI-PWD-006, TC-UI-PERM-001 ~ TC-UI-PERM-005
 */
@DisplayName("用户管理与权限管理模块UI测试")
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class UserPermissionUiTest extends UiTestBase {

    private static final String HOST_USER_MGMT = "user-management";
    private static final String HOST_PERM_MGMT = "permission-management";
    private static final String HOST_CHANGE_PWD = "change-password";
    private static final String NEW_USERNAME = "crudtest";
    private static final String NEW_PASSWORD = "CrudTest123!";
    private static final String UPDATED_PASSWORD = "Updated123!";

    // ===== 用户管理页面元素测试 =====

    @Test
    @Order(1)
    @DisplayName("TC-UI-USER-001: 打开用户管理页面")
    void testOpenUserManagement() {
        doLoginAsAdmin();
        homePage.goToUserManagement();
        loginPage.sleep(2000);
        WebElement host = loginPage.getShadowHost(HOST_USER_MGMT);
        assertTrue(host.isDisplayed(), "用户管理组件应可见");
    }

    @Test
    @Order(2)
    @DisplayName("TC-UI-USER-002: 验证筛选区域元素")
    void testUserFilterElements() {
        doLoginAsAdmin();
        homePage.goToUserManagement();
        loginPage.sleep(2000);
        assertTrue(loginPage.findInShadowById(HOST_USER_MGMT, "usernameFilter").isDisplayed());
        assertTrue(loginPage.findInShadowById(HOST_USER_MGMT, "roleFilter").isDisplayed());
        assertTrue(loginPage.findInShadowById(HOST_USER_MGMT, "statusFilter").isDisplayed());
        assertTrue(loginPage.findInShadowById(HOST_USER_MGMT, "applyFilters").isDisplayed());
        assertTrue(loginPage.findInShadowById(HOST_USER_MGMT, "resetFilters").isDisplayed());
    }

    @Test
    @Order(3)
    @DisplayName("TC-UI-USER-003: 验证用户表格表头")
    void testUserTableHeaders() {
        doLoginAsAdmin();
        homePage.goToUserManagement();
        loginPage.sleep(2000);
        List<WebElement> headers = loginPage.findsInShadow(HOST_USER_MGMT, "th");
        List<String> texts = new ArrayList<>();
        for (WebElement h : headers) { texts.add(h.getText()); }
        assertTrue(texts.contains("用户名"));
        assertTrue(texts.contains("角色"));
        assertTrue(texts.contains("状态"));
        assertTrue(texts.contains("操作"));
    }

    @Test
    @Order(4)
    @DisplayName("TC-UI-USER-004: 按用户名筛选")
    void testUserFilterByUsername() {
        doLoginAsAdmin();
        homePage.goToUserManagement();
        loginPage.sleep(2000);
        loginPage.inputInShadowById(HOST_USER_MGMT, "usernameFilter", "test");
        loginPage.clickInShadowById(HOST_USER_MGMT, "applyFilters");
        loginPage.sleep(2000);
        WebElement tableBody = loginPage.findInShadowById(HOST_USER_MGMT, "tableBody");
        assertTrue(tableBody.isDisplayed());
    }

    @Test
    @Order(5)
    @DisplayName("TC-UI-USER-005: 重置筛选条件")
    void testUserFilterReset() {
        doLoginAsAdmin();
        homePage.goToUserManagement();
        loginPage.sleep(2000);
        loginPage.inputInShadowById(HOST_USER_MGMT, "usernameFilter", "test");
        loginPage.selectInShadowById(HOST_USER_MGMT, "roleFilter", "ADMIN");
        loginPage.clickInShadowById(HOST_USER_MGMT, "resetFilters");
        loginPage.sleep(1000);
        assertEquals("", loginPage.findInShadowById(HOST_USER_MGMT, "usernameFilter").getAttribute("value"));
        assertEquals("", loginPage.findInShadowById(HOST_USER_MGMT, "roleFilter").getAttribute("value"));
    }

    @Test
    @Order(6)
    @DisplayName("TC-UI-USER-006: 打开新增用户弹窗")
    void testOpenAddUserModal() {
        doLoginAsAdmin();
        homePage.goToUserManagement();
        loginPage.sleep(2000);
        loginPage.clickInShadowById(HOST_USER_MGMT, "addUserBtn");
        loginPage.sleep(1000);
        assertTrue(loginPage.findInShadowById(HOST_USER_MGMT, "modalMask").isDisplayed(), "新增用户弹窗应可见");
        assertEquals("新增用户", loginPage.findInShadowById(HOST_USER_MGMT, "modalTitle").getText());
    }

    @Test
    @Order(7)
    @DisplayName("TC-UI-USER-007: 验证新增用户表单元素")
    void testAddUserFormElements() {
        doLoginAsAdmin();
        homePage.goToUserManagement();
        loginPage.sleep(2000);
        loginPage.clickInShadowById(HOST_USER_MGMT, "addUserBtn");
        loginPage.sleep(1000);
        assertTrue(loginPage.findInShadowById(HOST_USER_MGMT, "username").isDisplayed());
        assertTrue(loginPage.findInShadowById(HOST_USER_MGMT, "password").isDisplayed());
        assertTrue(loginPage.findInShadowById(HOST_USER_MGMT, "role").isDisplayed());
        assertTrue(loginPage.findInShadowById(HOST_USER_MGMT, "enabled").isDisplayed());
        assertTrue(loginPage.findInShadowById(HOST_USER_MGMT, "saveBtn").isDisplayed());
        assertTrue(loginPage.findInShadowById(HOST_USER_MGMT, "cancelBtn").isDisplayed());
    }

    @Test
    @Order(8)
    @DisplayName("TC-UI-USER-008: 新增用户 - 空用户名校验")
    void testAddUserEmptyUsername() {
        doLoginAsAdmin();
        homePage.goToUserManagement();
        loginPage.sleep(2000);
        loginPage.clickInShadowById(HOST_USER_MGMT, "addUserBtn");
        loginPage.sleep(1000);
        loginPage.clickInShadowById(HOST_USER_MGMT, "saveBtn");
        loginPage.sleep(1000);
        assertTrue(loginPage.findInShadowById(HOST_USER_MGMT, "modalMask").isDisplayed(), "空用户名应阻止提交");
    }

    @Test
    @Order(9)
    @DisplayName("TC-UI-USER-010: 新增用户 - 取消操作")
    void testAddUserCancel() {
        doLoginAsAdmin();
        homePage.goToUserManagement();
        loginPage.sleep(2000);
        loginPage.clickInShadowById(HOST_USER_MGMT, "addUserBtn");
        loginPage.sleep(1000);
        loginPage.inputInShadowById(HOST_USER_MGMT, "username", "tempuser");
        loginPage.clickInShadowById(HOST_USER_MGMT, "cancelBtn");
        loginPage.sleep(1000);
        assertFalse(loginPage.findInShadowById(HOST_USER_MGMT, "modalMask").isDisplayed(), "取消后弹窗应关闭");
    }

    @Test
    @Order(10)
    @DisplayName("TC-UI-USER-011: 新增用户 - 用户名长度限制")
    void testAddUserLongUsername() {
        doLoginAsAdmin();
        homePage.goToUserManagement();
        loginPage.sleep(2000);
        loginPage.clickInShadowById(HOST_USER_MGMT, "addUserBtn");
        loginPage.sleep(1000);
        StringBuilder longName = new StringBuilder();
        for (int i = 0; i < 60; i++) { longName.append("a"); }
        loginPage.inputInShadowById(HOST_USER_MGMT, "username", longName.toString());
        WebElement usernameInput = loginPage.findInShadowById(HOST_USER_MGMT, "username");
        assertTrue(usernameInput.getAttribute("value").length() <= 50,
                "用户名输入框应限制最大长度为50个字符");
    }

    @Test
    @Order(11)
    @DisplayName("TC-UI-USER-012: 通过X按钮关闭用户弹窗")
    void testCloseUserModalWithX() {
        doLoginAsAdmin();
        homePage.goToUserManagement();
        loginPage.sleep(2000);
        loginPage.clickInShadowById(HOST_USER_MGMT, "addUserBtn");
        loginPage.sleep(1000);
        loginPage.clickInShadowById(HOST_USER_MGMT, "modalClose");
        loginPage.sleep(1000);
        assertFalse(loginPage.findInShadowById(HOST_USER_MGMT, "modalMask").isDisplayed(), "X按钮应关闭弹窗");
    }

    // ===== CRUD: 创建用户 =====

    @Test
    @Order(12)
    @DisplayName("TC-UI-CRUD-001: admin登录 - 创建新用户")
    void testCreateUser() {
        doLoginAsAdmin();
        homePage.goToUserManagement();
        loginPage.sleep(2000);

        loginPage.clickInShadowById(HOST_USER_MGMT, "addUserBtn");
        loginPage.sleep(1000);

        WebElement modalMask = loginPage.findInShadowById(HOST_USER_MGMT, "modalMask");
        assertTrue(modalMask.isDisplayed(), "新增用户弹窗应可见");

        loginPage.inputInShadowById(HOST_USER_MGMT, "username", NEW_USERNAME);
        loginPage.inputInShadowById(HOST_USER_MGMT, "password", NEW_PASSWORD);
        loginPage.selectInShadowById(HOST_USER_MGMT, "role", "DATA_ENGINEER");
        loginPage.selectInShadowById(HOST_USER_MGMT, "enabled", "true");
        loginPage.clickInShadowById(HOST_USER_MGMT, "saveBtn");

        String toastMsg = loginPage.waitForSuccessToast(15);
        assertTrue(!toastMsg.isEmpty() || loginPage.waitForHiddenInShadow(HOST_USER_MGMT, "#modalMask", 10),
                "创建用户应成功（显示成功Toast或弹窗关闭）");
    }

    // ===== CRUD: 查询用户 =====

    @Test
    @Order(13)
    @DisplayName("TC-UI-CRUD-002: admin登录 - 查询新用户")
    void testQueryNewUser() {
        doLoginAsAdmin();
        homePage.goToUserManagement();
        loginPage.sleep(2000);

        loginPage.inputInShadowById(HOST_USER_MGMT, "usernameFilter", NEW_USERNAME);
        loginPage.clickInShadowById(HOST_USER_MGMT, "applyFilters");
        loginPage.sleep(2000);

        WebElement tableBody = loginPage.findInShadowById(HOST_USER_MGMT, "tableBody");
        assertTrue(tableBody.isDisplayed(), "表格应显示");

        boolean found = false;
        for (WebElement row : tableBody.findElements(By.tagName("tr"))) {
            if (row.getText().contains(NEW_USERNAME)) {
                found = true;
                break;
            }
        }
        assertTrue(found, "表格中应包含新创建的用户: " + NEW_USERNAME);
    }

    // ===== CRUD: 编辑用户 =====

    @Test
    @Order(14)
    @DisplayName("TC-UI-CRUD-003: admin登录 - 编辑用户角色和状态")
    void testEditUser() {
        doLoginAsAdmin();
        homePage.goToUserManagement();
        loginPage.sleep(2000);

        loginPage.inputInShadowById(HOST_USER_MGMT, "usernameFilter", NEW_USERNAME);
        loginPage.clickInShadowById(HOST_USER_MGMT, "applyFilters");
        loginPage.sleep(2000);

        WebElement editBtn = loginPage.findInShadow(HOST_USER_MGMT, ".action-btn.edit");
        loginPage.waitForClickable(editBtn);
        editBtn.click();
        loginPage.sleep(1000);

        WebElement modalTitle = loginPage.findInShadowById(HOST_USER_MGMT, "modalTitle");
        assertEquals("编辑用户", modalTitle.getText(), "弹窗标题应为编辑用户");

        WebElement usernameInput = loginPage.findInShadowById(HOST_USER_MGMT, "username");
        assertNotNull(usernameInput.getAttribute("disabled"), "编辑模式下用户名应为禁用状态");

        loginPage.selectInShadowById(HOST_USER_MGMT, "role", "ADMIN");
        loginPage.selectInShadowById(HOST_USER_MGMT, "enabled", "false");
        loginPage.clickInShadowById(HOST_USER_MGMT, "saveBtn");

        String toastMsg = loginPage.waitForSuccessToast(15);
        assertTrue(!toastMsg.isEmpty() || loginPage.waitForHiddenInShadow(HOST_USER_MGMT, "#modalMask", 10),
                "编辑用户应成功（显示成功Toast或弹窗关闭）");
    }

    @Test
    @Order(15)
    @DisplayName("TC-UI-CRUD-004: admin登录 - 重新启用用户")
    void testReEnableUser() {
        doLoginAsAdmin();
        homePage.goToUserManagement();
        loginPage.sleep(2000);

        loginPage.inputInShadowById(HOST_USER_MGMT, "usernameFilter", NEW_USERNAME);
        loginPage.clickInShadowById(HOST_USER_MGMT, "applyFilters");
        loginPage.sleep(2000);

        WebElement editBtn = loginPage.findInShadow(HOST_USER_MGMT, ".action-btn.edit");
        loginPage.waitForClickable(editBtn);
        editBtn.click();
        loginPage.sleep(1000);

        loginPage.selectInShadowById(HOST_USER_MGMT, "enabled", "true");
        loginPage.clickInShadowById(HOST_USER_MGMT, "saveBtn");

        String toastMsg = loginPage.waitForSuccessToast(15);
        assertTrue(!toastMsg.isEmpty() || loginPage.waitForHiddenInShadow(HOST_USER_MGMT, "#modalMask", 10),
                "重新启用用户应成功");
    }

    // ===== 修改密码测试（使用新创建的用户） =====

    @Test
    @Order(16)
    @DisplayName("TC-UI-PWD-001: 新用户登录 - 打开修改密码弹窗")
    void testOpenChangePasswordModal() {
        doLoginAs(NEW_USERNAME, NEW_PASSWORD);
        assertFalse(loginPage.isLoginPage(), "新账号应能登录成功");

        homePage.goToChangePassword();
        loginPage.sleep(2000);
        assertTrue(loginPage.findInShadow(HOST_CHANGE_PWD, ".change-password-container").isDisplayed(),
                "修改密码弹窗应可见");
    }

    @Test
    @Order(17)
    @DisplayName("TC-UI-PWD-002: 验证修改密码表单元素")
    void testChangePasswordFormElements() {
        doLoginAs(NEW_USERNAME, NEW_PASSWORD);
        homePage.goToChangePassword();
        loginPage.sleep(2000);
        assertTrue(loginPage.findInShadowById(HOST_CHANGE_PWD, "currentUsername").isDisplayed());
        assertTrue(loginPage.findInShadowById(HOST_CHANGE_PWD, "oldPassword").isDisplayed());
        assertTrue(loginPage.findInShadowById(HOST_CHANGE_PWD, "newPassword").isDisplayed());
        assertTrue(loginPage.findInShadowById(HOST_CHANGE_PWD, "confirmPassword").isDisplayed());
        assertTrue(loginPage.findInShadowById(HOST_CHANGE_PWD, "confirmChangePassword").isDisplayed());
        assertTrue(loginPage.findInShadowById(HOST_CHANGE_PWD, "cancelChangePassword").isDisplayed());
    }

    @Test
    @Order(18)
    @DisplayName("TC-UI-PWD-003: 验证用户名字段为只读且显示当前用户")
    void testChangePasswordUsernameReadonly() {
        doLoginAs(NEW_USERNAME, NEW_PASSWORD);
        homePage.goToChangePassword();
        loginPage.sleep(2000);
        WebElement currentUsername = loginPage.findInShadowById(HOST_CHANGE_PWD, "currentUsername");
        assertNotNull(currentUsername.getAttribute("readonly"), "用户名应为只读");
        assertEquals(NEW_USERNAME, currentUsername.getAttribute("value"), "用户名应显示当前登录用户");
    }

    @Test
    @Order(19)
    @DisplayName("TC-UI-PWD-004: 修改密码 - 空原密码校验")
    void testChangePasswordEmptyOld() {
        doLoginAs(NEW_USERNAME, NEW_PASSWORD);
        homePage.goToChangePassword();
        loginPage.sleep(2000);
        loginPage.inputInShadowById(HOST_CHANGE_PWD, "newPassword", "NewPass123!");
        loginPage.inputInShadowById(HOST_CHANGE_PWD, "confirmPassword", "NewPass123!");
        loginPage.clickInShadowById(HOST_CHANGE_PWD, "confirmChangePassword");
        loginPage.sleep(1000);
        assertNotNull(loginPage.findInShadowById(HOST_CHANGE_PWD, "oldPassword").getAttribute("required"));
    }

    @Test
    @Order(20)
    @DisplayName("TC-UI-PWD-005: 修改密码 - 新密码与确认密码不一致")
    void testChangePasswordMismatch() {
        doLoginAs(NEW_USERNAME, NEW_PASSWORD);
        homePage.goToChangePassword();
        loginPage.sleep(2000);
        loginPage.inputInShadowById(HOST_CHANGE_PWD, "oldPassword", NEW_PASSWORD);
        loginPage.inputInShadowById(HOST_CHANGE_PWD, "newPassword", "NewPass123!");
        loginPage.inputInShadowById(HOST_CHANGE_PWD, "confirmPassword", "DifferentPass456!");
        loginPage.clickInShadowById(HOST_CHANGE_PWD, "confirmChangePassword");
        String toastMsg = loginPage.waitForAnyToast(10);
        boolean modalStillVisible = loginPage.findInShadow(HOST_CHANGE_PWD, ".change-password-container").isDisplayed();
        assertTrue(!toastMsg.isEmpty() || modalStillVisible,
                "密码不一致应阻止提交（显示错误提示或弹窗保持打开）");
    }

    @Test
    @Order(21)
    @DisplayName("TC-UI-PWD-006: 修改密码 - 取消操作")
    void testChangePasswordCancel() {
        doLoginAs(NEW_USERNAME, NEW_PASSWORD);
        homePage.goToChangePassword();
        loginPage.sleep(2000);
        loginPage.inputInShadowById(HOST_CHANGE_PWD, "oldPassword", NEW_PASSWORD);
        loginPage.inputInShadowById(HOST_CHANGE_PWD, "newPassword", "NewPass123!");
        loginPage.clickInShadowById(HOST_CHANGE_PWD, "cancelChangePassword");
        loginPage.sleep(1000);
        assertTrue(loginPage.isShadowHostHidden(HOST_CHANGE_PWD),
                "取消后弹窗应关闭");
    }

    // ===== CRUD: 实际修改密码 =====

    @Test
    @Order(22)
    @DisplayName("TC-UI-CRUD-005: 新用户登录 - 实际修改密码")
    void testNewUserChangePassword() {
        doLoginAs(NEW_USERNAME, NEW_PASSWORD);
        assertFalse(loginPage.isLoginPage(), "新账号应能登录成功");

        homePage.goToChangePassword();
        loginPage.sleep(2000);

        WebElement container = loginPage.findInShadow(HOST_CHANGE_PWD, ".change-password-container");
        assertTrue(container.isDisplayed(), "修改密码弹窗应可见");

        WebElement currentUsername = loginPage.findInShadowById(HOST_CHANGE_PWD, "currentUsername");
        assertEquals(NEW_USERNAME, currentUsername.getAttribute("value"), "用户名应显示当前登录用户");

        loginPage.inputInShadowById(HOST_CHANGE_PWD, "oldPassword", NEW_PASSWORD);
        loginPage.inputInShadowById(HOST_CHANGE_PWD, "newPassword", UPDATED_PASSWORD);
        loginPage.inputInShadowById(HOST_CHANGE_PWD, "confirmPassword", UPDATED_PASSWORD);
        loginPage.clickInShadowById(HOST_CHANGE_PWD, "confirmChangePassword");

        String toastMsg = loginPage.waitForSuccessToast(15);
        assertTrue(!toastMsg.isEmpty(), "修改密码应显示成功提示");
    }

    @Test
    @Order(23)
    @DisplayName("TC-UI-CRUD-006: 新用户用修改后的密码重新登录")
    void testLoginWithUpdatedPassword() {
        doLoginAs(NEW_USERNAME, UPDATED_PASSWORD);
        assertFalse(loginPage.isLoginPage(), "使用修改后的密码应能登录成功");
    }

    // ===== CRUD: 删除用户 =====

    @Test
    @Order(24)
    @DisplayName("TC-UI-CRUD-007: admin登录 - 删除测试用户")
    void testDeleteUser() {
        doLoginAsAdmin();
        homePage.goToUserManagement();
        loginPage.sleep(2000);

        loginPage.inputInShadowById(HOST_USER_MGMT, "usernameFilter", NEW_USERNAME);
        loginPage.clickInShadowById(HOST_USER_MGMT, "applyFilters");
        loginPage.sleep(2000);

        WebElement deleteBtn = loginPage.findInShadow(HOST_USER_MGMT, ".action-btn.delete");
        loginPage.waitForClickable(deleteBtn);
        deleteBtn.click();
        loginPage.sleep(1000);

        WebElement confirmDeleteBtn = loginPage.findInShadow(HOST_USER_MGMT, "[data-action='delete']");
        loginPage.waitForClickable(confirmDeleteBtn);
        confirmDeleteBtn.click();

        String toastMsg = loginPage.waitForSuccessToast(15);
        assertTrue(!toastMsg.isEmpty(), "删除用户应显示成功提示");
    }

    // ===== 权限管理测试 =====

    @Test
    @Order(25)
    @DisplayName("TC-UI-PERM-001: 打开权限管理页面")
    void testOpenPermissionManagement() {
        doLoginAsAdmin();
        homePage.goToPermissionManagement();
        loginPage.sleep(2000);
        WebElement host = loginPage.getShadowHost(HOST_PERM_MGMT);
        assertTrue(host.isDisplayed(), "权限管理组件应可见");
    }

    @Test
    @Order(26)
    @DisplayName("TC-UI-PERM-002: 验证权限筛选区域元素")
    void testPermissionFilterElements() {
        doLoginAsAdmin();
        homePage.goToPermissionManagement();
        loginPage.sleep(2000);
        assertTrue(loginPage.findInShadowById(HOST_PERM_MGMT, "prefixFilter").isDisplayed());
        assertTrue(loginPage.findInShadowById(HOST_PERM_MGMT, "applyFilters").isDisplayed());
        assertTrue(loginPage.findInShadowById(HOST_PERM_MGMT, "resetFilters").isDisplayed());
    }

    @Test
    @Order(27)
    @DisplayName("TC-UI-PERM-003: 验证权限表格表头")
    void testPermissionTableHeaders() {
        doLoginAsAdmin();
        homePage.goToPermissionManagement();
        loginPage.sleep(2000);
        List<WebElement> headers = loginPage.findsInShadow(HOST_PERM_MGMT, "th");
        List<String> texts = new ArrayList<>();
        for (WebElement h : headers) { texts.add(h.getText()); }
        assertTrue(texts.contains("资源"));
        assertTrue(texts.contains("所有者"));
        assertTrue(texts.contains("公开可见"));
        assertTrue(texts.contains("操作"));
    }

    @Test
    @Order(28)
    @DisplayName("TC-UI-PERM-004: 权限筛选并重置")
    void testPermissionFilterAndReset() {
        doLoginAsAdmin();
        homePage.goToPermissionManagement();
        loginPage.sleep(2000);
        loginPage.inputInShadowById(HOST_PERM_MGMT, "prefixFilter", "test");
        loginPage.clickInShadowById(HOST_PERM_MGMT, "applyFilters");
        loginPage.sleep(2000);
        loginPage.clickInShadowById(HOST_PERM_MGMT, "resetFilters");
        loginPage.sleep(1000);
        assertEquals("", loginPage.findInShadowById(HOST_PERM_MGMT, "prefixFilter").getAttribute("value"));
    }

    @Test
    @Order(29)
    @DisplayName("TC-UI-PERM-005: 刷新权限列表")
    void testPermissionRefresh() {
        doLoginAsAdmin();
        homePage.goToPermissionManagement();
        loginPage.sleep(2000);
        loginPage.clickInShadowById(HOST_PERM_MGMT, "refreshBtn");
        loginPage.sleep(2000);
        WebElement tableBody = loginPage.findInShadowById(HOST_PERM_MGMT, "tableBody");
        assertTrue(tableBody.isDisplayed());
    }
}
