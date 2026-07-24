package com.tsinghua.ui;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 修改密码模块UI自动化测试
 * 对应测试用例: TC-UI-PWD-001 ~ TC-UI-PWD-007
 */
@DisplayName("修改密码模块UI测试")
class ChangePasswordUiTest extends UiTestBase {

    private static final String HOST = "change-password";

    @Test
    @DisplayName("TC-UI-PWD-001: 打开修改密码弹窗")
    void testOpenChangePasswordModal() {
        doLogin();
        homePage.goToChangePassword();
        loginPage.sleep(2000);
        assertTrue(loginPage.findInShadow(HOST, ".change-password-container").isDisplayed(),
                "修改密码弹窗应可见");
    }

    @Test
    @DisplayName("TC-UI-PWD-002: 验证修改密码表单元素")
    void testChangePasswordFormElements() {
        doLogin();
        homePage.goToChangePassword();
        loginPage.sleep(2000);
        assertTrue(loginPage.findInShadowById(HOST, "currentUsername").isDisplayed());
        assertTrue(loginPage.findInShadowById(HOST, "oldPassword").isDisplayed());
        assertTrue(loginPage.findInShadowById(HOST, "newPassword").isDisplayed());
        assertTrue(loginPage.findInShadowById(HOST, "confirmPassword").isDisplayed());
        assertTrue(loginPage.findInShadowById(HOST, "confirmChangePassword").isDisplayed());
        assertTrue(loginPage.findInShadowById(HOST, "cancelChangePassword").isDisplayed());
    }

    @Test
    @DisplayName("TC-UI-PWD-003: 验证用户名字段为只读")
    void testChangePasswordUsernameReadonly() {
        doLogin();
        homePage.goToChangePassword();
        loginPage.sleep(2000);
        assertNotNull(loginPage.findInShadowById(HOST, "currentUsername").getAttribute("readonly"),
                "用户名应为只读");
    }

    @Test
    @DisplayName("TC-UI-PWD-004: 修改密码 - 空原密码校验")
    void testChangePasswordEmptyOld() {
        doLogin();
        homePage.goToChangePassword();
        loginPage.sleep(2000);
        loginPage.inputInShadowById(HOST, "newPassword", "NewPass123!");
        loginPage.inputInShadowById(HOST, "confirmPassword", "NewPass123!");
        loginPage.clickInShadowById(HOST, "confirmChangePassword");
        loginPage.sleep(1000);
        assertNotNull(loginPage.findInShadowById(HOST, "oldPassword").getAttribute("required"));
    }

    @Test
    @DisplayName("TC-UI-PWD-005: 修改密码 - 新密码与确认密码不一致")
    void testChangePasswordMismatch() {
        doLogin();
        homePage.goToChangePassword();
        loginPage.sleep(2000);
        loginPage.inputInShadowById(HOST, "oldPassword", "test123");
        loginPage.inputInShadowById(HOST, "newPassword", "NewPass123!");
        loginPage.inputInShadowById(HOST, "confirmPassword", "DifferentPass456!");
        loginPage.clickInShadowById(HOST, "confirmChangePassword");
        String toastMsg = loginPage.waitForAnyToast(10);
        boolean modalStillVisible = loginPage.findInShadow(HOST, ".change-password-container").isDisplayed();
        assertTrue(!toastMsg.isEmpty() || modalStillVisible,
                "密码不一致应阻止提交（显示错误提示或弹窗保持打开）");
    }

    @Test
    @DisplayName("TC-UI-PWD-006: 修改密码 - 取消操作")
    void testChangePasswordCancel() {
        doLogin();
        homePage.goToChangePassword();
        loginPage.sleep(2000);
        loginPage.inputInShadowById(HOST, "oldPassword", "test123");
        loginPage.inputInShadowById(HOST, "newPassword", "NewPass123!");
        loginPage.clickInShadowById(HOST, "cancelChangePassword");
        loginPage.sleep(1000);
        assertFalse(loginPage.findInShadow(HOST, ".change-password-container").isDisplayed(),
                "取消后弹窗应关闭");
    }

    @Test
    @DisplayName("TC-UI-PWD-007: 修改密码 - 新密码过短边界测试")
    void testChangePasswordShortNew() {
        doLogin();
        homePage.goToChangePassword();
        loginPage.sleep(2000);
        loginPage.inputInShadowById(HOST, "oldPassword", "test123");
        loginPage.inputInShadowById(HOST, "newPassword", "1");
        loginPage.inputInShadowById(HOST, "confirmPassword", "1");
        loginPage.clickInShadowById(HOST, "confirmChangePassword");
        String toastMsg = loginPage.waitForAnyToast(10);
        boolean modalStillVisible = loginPage.findInShadow(HOST, ".change-password-container").isDisplayed();
        assertTrue(!toastMsg.isEmpty() || modalStillVisible,
                "短密码应被拒绝（显示错误提示或弹窗保持打开）");
    }
}
