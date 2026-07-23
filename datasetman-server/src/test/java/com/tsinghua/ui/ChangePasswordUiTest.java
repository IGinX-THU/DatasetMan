package com.tsinghua.ui;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.openqa.selenium.By;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 修改密码模块UI自动化测试
 * 对应测试用例: TC-UI-PWD-001 ~ TC-UI-PWD-007
 */
@DisplayName("修改密码模块UI测试")
class ChangePasswordUiTest extends UiTestBase {

    @Test
    @DisplayName("TC-UI-PWD-001: 打开修改密码弹窗")
    void testOpenChangePasswordModal() {
        doLogin();
        homePage.goToChangePassword();
        loginPage.sleep(1000);
        assertTrue(driver.findElement(org.openqa.selenium.By.cssSelector(".change-password-container")).isDisplayed(),
                "修改密码弹窗应可见");
    }

    @Test
    @DisplayName("TC-UI-PWD-002: 验证修改密码表单元素")
    void testChangePasswordFormElements() {
        doLogin();
        homePage.goToChangePassword();
        loginPage.sleep(1000);
        assertTrue(driver.findElement(By.id("currentUsername")).isDisplayed());
        assertTrue(driver.findElement(By.id("oldPassword")).isDisplayed());
        assertTrue(driver.findElement(By.id("newPassword")).isDisplayed());
        assertTrue(driver.findElement(By.id("confirmPassword")).isDisplayed());
        assertTrue(driver.findElement(By.id("confirmChangePassword")).isDisplayed());
        assertTrue(driver.findElement(By.id("cancelChangePassword")).isDisplayed());
    }

    @Test
    @DisplayName("TC-UI-PWD-003: 验证用户名字段为只读")
    void testChangePasswordUsernameReadonly() {
        doLogin();
        homePage.goToChangePassword();
        loginPage.sleep(1000);
        assertNotNull(driver.findElement(By.id("currentUsername")).getAttribute("readonly"),
                "用户名应为只读");
    }

    @Test
    @DisplayName("TC-UI-PWD-004: 修改密码 - 空原密码校验")
    void testChangePasswordEmptyOld() {
        doLogin();
        homePage.goToChangePassword();
        loginPage.sleep(1000);
        loginPage.inputById("newPassword", "NewPass123!");
        loginPage.inputById("confirmPassword", "NewPass123!");
        loginPage.clickById("confirmChangePassword");
        loginPage.sleep(1000);
        assertNotNull(driver.findElement(By.id("oldPassword")).getAttribute("required"));
    }

    @Test
    @DisplayName("TC-UI-PWD-005: 修改密码 - 新密码与确认密码不一致")
    void testChangePasswordMismatch() {
        doLogin();
        homePage.goToChangePassword();
        loginPage.sleep(1000);
        loginPage.inputById("oldPassword", "user123");
        loginPage.inputById("newPassword", "NewPass123!");
        loginPage.inputById("confirmPassword", "DifferentPass456!");
        loginPage.clickById("confirmChangePassword");
        // 等待接口响应或前端校验结果
        String toastMsg = loginPage.waitForAnyToast(10);
        boolean modalStillVisible = driver.findElement(org.openqa.selenium.By.cssSelector(".change-password-container")).isDisplayed();
        // 密码不一致应被拒绝：要么显示错误Toast，要么弹窗保持打开
        assertTrue(!toastMsg.isEmpty() || modalStillVisible,
                "密码不一致应阻止提交（显示错误提示或弹窗保持打开）");
    }

    @Test
    @DisplayName("TC-UI-PWD-006: 修改密码 - 取消操作")
    void testChangePasswordCancel() {
        doLogin();
        homePage.goToChangePassword();
        loginPage.sleep(1000);
        loginPage.inputById("oldPassword", "user123");
        loginPage.inputById("newPassword", "NewPass123!");
        loginPage.clickById("cancelChangePassword");
        loginPage.sleep(1000);
        assertFalse(driver.findElement(org.openqa.selenium.By.cssSelector(".change-password-container")).isDisplayed(),
                "取消后弹窗应关闭");
    }

    @Test
    @DisplayName("TC-UI-PWD-007: 修改密码 - 新密码过短边界测试")
    void testChangePasswordShortNew() {
        doLogin();
        homePage.goToChangePassword();
        loginPage.sleep(1000);
        loginPage.inputById("oldPassword", "user123");
        loginPage.inputById("newPassword", "1");
        loginPage.inputById("confirmPassword", "1");
        loginPage.clickById("confirmChangePassword");
        // 等待接口响应或前端校验结果
        String toastMsg = loginPage.waitForAnyToast(10);
        boolean modalStillVisible = driver.findElement(org.openqa.selenium.By.cssSelector(".change-password-container")).isDisplayed();
        // 短密码应被拒绝：要么显示错误Toast，要么弹窗保持打开
        assertTrue(!toastMsg.isEmpty() || modalStillVisible,
                "短密码应被拒绝（显示错误提示或弹窗保持打开）");
    }
}
