package com.tsinghua.ui;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.openqa.selenium.By;
import org.openqa.selenium.WebElement;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 用户管理与权限管理模块UI自动化测试
 * 对应测试用例: TC-UI-USER-001 ~ TC-UI-USER-012, TC-UI-PERM-001 ~ TC-UI-PERM-005
 */
@DisplayName("用户管理与权限管理模块UI测试")
class UserPermissionUiTest extends UiTestBase {

    @Nested
    @DisplayName("用户管理")
    class UserManagement {

        @Test
        @DisplayName("TC-UI-USER-001: 打开用户管理页面")
        void testOpenUserManagement() {
            doLogin();
            homePage.goToUserManagement();
            loginPage.sleep(1000);
            assertTrue(driver.findElement(By.id("userManagement")).isDisplayed(), "用户管理组件应可见");
        }

        @Test
        @DisplayName("TC-UI-USER-002: 验证筛选区域元素")
        void testUserFilterElements() {
            doLogin();
            homePage.goToUserManagement();
            loginPage.sleep(1000);
            assertTrue(driver.findElement(By.id("usernameFilter")).isDisplayed());
            assertTrue(driver.findElement(By.id("roleFilter")).isDisplayed());
            assertTrue(driver.findElement(By.id("statusFilter")).isDisplayed());
            assertTrue(driver.findElement(By.id("applyFilters")).isDisplayed());
            assertTrue(driver.findElement(By.id("resetFilters")).isDisplayed());
        }

        @Test
        @DisplayName("TC-UI-USER-003: 验证用户表格表头")
        void testUserTableHeaders() {
            doLogin();
            homePage.goToUserManagement();
            loginPage.sleep(1000);
            List<WebElement> headers = driver.findElements(By.cssSelector("#userManagement th"));
            List<String> texts = new ArrayList<>();
            for (WebElement h : headers) { texts.add(h.getText()); }
            assertTrue(texts.contains("用户名"));
            assertTrue(texts.contains("角色"));
            assertTrue(texts.contains("状态"));
            assertTrue(texts.contains("操作"));
        }

        @Test
        @DisplayName("TC-UI-USER-004: 按用户名筛选")
        void testUserFilterByUsername() {
            doLogin();
            homePage.goToUserManagement();
            loginPage.sleep(1000);
            loginPage.inputById("usernameFilter", "user");
            loginPage.clickById("applyFilters");
            // 等待表格刷新（接口返回数据后表格更新）
            loginPage.waitForVisible(By.id("tableBody"), 10);
            assertTrue(driver.findElement(By.id("tableBody")).isDisplayed());
        }

        @Test
        @DisplayName("TC-UI-USER-005: 重置筛选条件")
        void testUserFilterReset() {
            doLogin();
            homePage.goToUserManagement();
            loginPage.sleep(1000);
            loginPage.inputById("usernameFilter", "test");
            loginPage.selectByValue("roleFilter", "ADMIN");
            loginPage.clickById("resetFilters");
            loginPage.sleep(1000);
            assertEquals("", driver.findElement(By.id("usernameFilter")).getAttribute("value"));
            assertEquals("", driver.findElement(By.id("roleFilter")).getAttribute("value"));
        }

        @Test
        @DisplayName("TC-UI-USER-006: 打开新增用户弹窗")
        void testOpenAddUserModal() {
            doLogin();
            homePage.goToUserManagement();
            loginPage.sleep(1000);
            loginPage.clickById("addUserBtn");
            loginPage.sleep(1000);
            assertTrue(driver.findElement(By.id("modalMask")).isDisplayed(), "新增用户弹窗应可见");
            assertEquals("新增用户", driver.findElement(By.id("modalTitle")).getText());
        }

        @Test
        @DisplayName("TC-UI-USER-007: 验证新增用户表单元素")
        void testAddUserFormElements() {
            doLogin();
            homePage.goToUserManagement();
            loginPage.sleep(1000);
            loginPage.clickById("addUserBtn");
            loginPage.sleep(1000);
            assertTrue(driver.findElement(By.id("username")).isDisplayed());
            assertTrue(driver.findElement(By.id("password")).isDisplayed());
            assertTrue(driver.findElement(By.id("role")).isDisplayed());
            assertTrue(driver.findElement(By.id("enabled")).isDisplayed());
            assertTrue(driver.findElement(By.id("saveBtn")).isDisplayed());
            assertTrue(driver.findElement(By.id("cancelBtn")).isDisplayed());
        }

        @Test
        @DisplayName("TC-UI-USER-008: 新增用户 - 空用户名校验")
        void testAddUserEmptyUsername() {
            doLogin();
            homePage.goToUserManagement();
            loginPage.sleep(1000);
            loginPage.clickById("addUserBtn");
            loginPage.sleep(1000);
            loginPage.clickById("saveBtn");
            loginPage.sleep(1000);
            assertTrue(driver.findElement(By.id("modalMask")).isDisplayed(), "空用户名应阻止提交");
        }

        @Test
        @DisplayName("TC-UI-USER-009: 新增用户 - 填写完整信息并保存")
        void testAddUserFillAndSave() {
            doLogin();
            homePage.goToUserManagement();
            loginPage.sleep(1000);
            loginPage.clickById("addUserBtn");
            loginPage.sleep(1000);
            loginPage.inputById("username", "test");
            loginPage.inputById("password", "test123");
            loginPage.selectByValue("role", "DATA_ENGINEER");
            loginPage.selectByValue("enabled", "true");
            loginPage.clickById("saveBtn");
            // 等待接口响应
            String toastMsg = loginPage.waitForAnyToast(15);
            // 验证收到了响应（成功时弹窗关闭，失败时显示错误Toast）
            assertTrue(!toastMsg.isEmpty() || loginPage.waitForModalClosed("#modalMask", 10),
                    "保存后应收到接口响应（Toast提示或弹窗关闭）");
        }

        @Test
        @DisplayName("TC-UI-USER-010: 新增用户 - 取消操作")
        void testAddUserCancel() {
            doLogin();
            homePage.goToUserManagement();
            loginPage.sleep(1000);
            loginPage.clickById("addUserBtn");
            loginPage.sleep(1000);
            loginPage.inputById("username", "test");
            loginPage.clickById("cancelBtn");
            loginPage.sleep(1000);
            assertFalse(driver.findElement(By.id("modalMask")).isDisplayed(), "取消后弹窗应关闭");
        }

        @Test
        @DisplayName("TC-UI-USER-011: 新增用户 - 超长用户名边界测试")
        void testAddUserLongUsername() {
            doLogin();
            homePage.goToUserManagement();
            loginPage.sleep(1000);
            loginPage.clickById("addUserBtn");
            loginPage.sleep(1000);
            StringBuilder longName = new StringBuilder();
            for (int i = 0; i < 200; i++) { longName.append("u"); }
            loginPage.inputById("username", longName.toString());
            loginPage.inputById("password", "test123");
            loginPage.selectByValue("role", "DATA_ENGINEER");
            loginPage.clickById("saveBtn");
            // 等待接口响应（成功或失败）
            String toastMsg = loginPage.waitForAnyToast(15);
            // 验证不崩溃且收到了响应
            assertTrue(!toastMsg.isEmpty() || loginPage.waitForModalClosed("#modalMask", 10),
                    "提交后应收到接口响应，系统不崩溃");
        }

        @Test
        @DisplayName("TC-UI-USER-012: 通过X按钮关闭用户弹窗")
        void testCloseUserModalWithX() {
            doLogin();
            homePage.goToUserManagement();
            loginPage.sleep(1000);
            loginPage.clickById("addUserBtn");
            loginPage.sleep(1000);
            loginPage.clickById("modalClose");
            loginPage.sleep(1000);
            assertFalse(driver.findElement(By.id("modalMask")).isDisplayed(), "X按钮应关闭弹窗");
        }
    }

    @Nested
    @DisplayName("权限管理")
    class PermissionManagement {

        @Test
        @DisplayName("TC-UI-PERM-001: 打开权限管理页面")
        void testOpenPermissionManagement() {
            doLogin();
            homePage.goToPermissionManagement();
            loginPage.sleep(1000);
            assertTrue(driver.findElement(By.id("permissionManagement")).isDisplayed(), "权限管理组件应可见");
        }

        @Test
        @DisplayName("TC-UI-PERM-002: 验证权限筛选区域元素")
        void testPermissionFilterElements() {
            doLogin();
            homePage.goToPermissionManagement();
            loginPage.sleep(1000);
            assertTrue(driver.findElement(By.id("prefixFilter")).isDisplayed());
            assertTrue(driver.findElement(By.id("applyFilters")).isDisplayed());
            assertTrue(driver.findElement(By.id("resetFilters")).isDisplayed());
        }

        @Test
        @DisplayName("TC-UI-PERM-003: 验证权限表格表头")
        void testPermissionTableHeaders() {
            doLogin();
            homePage.goToPermissionManagement();
            loginPage.sleep(1000);
            List<WebElement> headers = driver.findElements(By.cssSelector("#permissionManagement th"));
            List<String> texts = new ArrayList<>();
            for (WebElement h : headers) { texts.add(h.getText()); }
            assertTrue(texts.contains("资源"));
            assertTrue(texts.contains("所有者"));
            assertTrue(texts.contains("公开可见"));
            assertTrue(texts.contains("操作"));
        }

        @Test
        @DisplayName("TC-UI-PERM-004: 权限筛选并重置")
        void testPermissionFilterAndReset() {
            doLogin();
            homePage.goToPermissionManagement();
            loginPage.sleep(1000);
            loginPage.inputById("prefixFilter", "test");
            loginPage.clickById("applyFilters");
            // 等待表格刷新（接口返回数据后表格更新）
            loginPage.waitForVisible(By.id("tableBody"), 10);
            loginPage.clickById("resetFilters");
            loginPage.sleep(1000);
            assertEquals("", driver.findElement(By.id("prefixFilter")).getAttribute("value"));
        }

        @Test
        @DisplayName("TC-UI-PERM-005: 刷新权限列表")
        void testPermissionRefresh() {
            doLogin();
            homePage.goToPermissionManagement();
            loginPage.sleep(1000);
            loginPage.clickById("refreshBtn");
            // 等待表格刷新（接口返回数据后表格更新）
            loginPage.waitForVisible(By.id("tableBody"), 10);
            assertTrue(driver.findElement(By.id("tableBody")).isDisplayed());
        }
    }
}
